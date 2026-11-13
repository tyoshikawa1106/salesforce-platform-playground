/** 資格情報更新の公開入口・工程結果・秘密非公開 */
@IsTest
private with sharing class ExternalClientAppManagerControllerTest {
    private static final String APP_ID = '0xI' + '0'.repeat(11) + '1';
    private static final String CONSUMER_ID = '888' + '0'.repeat(11) + '1';
    private static final String STAGE_ID = '0ug' + '0'.repeat(11) + '1';
    private static final String OTHER_APP_ID = '0xI' + '0'.repeat(11) + '2';
    private static final String OTHER_STAGE_ID = '0ug' + '0'.repeat(11) + '2';
    private static final String CONSUMER_PATH = '/services/data/v68.0/apps/oauth/credentials/' + APP_ID;
    private static final String STAGE_PATH = CONSUMER_PATH + '/' + CONSUMER_ID + '/staged';
    private static final String APPLICATION_QUERY = 'SELECT Id,DeveloperName,MasterLabel,DistributionState FROM ExternalClientApplication'
        + ' WHERE DistributionState = \'Local\' AND DeveloperName != \'ExternalClientAppManager\'';

    private static User testUser = new User(Id = UserInfo.getUserId());

    /** 既存の権限セット名へ依存せず機能利用権限を準備 */
    private static void grantFeatureAccess() {
        if (FeatureManagement.checkPermission('ManageExternalClientAppCredentials')) { return; }
        List<CustomPermission> permissions = [SELECT Id FROM CustomPermission WHERE DeveloperName = 'ManageExternalClientAppCredentials'];
        PermissionSet access = new PermissionSet(Name = 'ExternalClientManagerTestAccess', Label = '外部クライアント管理テスト');
        insert access;
        insert new SetupEntityAccess(ParentId = access.Id, SetupEntityId = permissions[0].Id);
        insert new PermissionSetAssignment(AssigneeId = testUser.Id, PermissionSetId = access.Id);
    }

    /** 一覧参照では変更要求や変更完了日時を返さない */
    @IsTest
    static void readsStagesWithoutMutation() {
        grantFeatureAccess();

        System.runAs(testUser) {
            RequestQueue mock = stageQueue(stageBody('active'));
            Test.setMock(HttpCalloutMock.class, mock);
            Test.startTest();
            Map<String, String> request = input('stages');
            request.put('confirmationId', String.valueOf((Id) APP_ID));
            Map<String, Object> result = ExternalClientAppManagerController.execute(request);
            Test.stopTest();
            mock.assertConsumed();
            Assert.areEqual(1, ((List<Object>) result.get('stages')).size(), '確認済み対象の一覧を取得');
            Assert.isFalse(JSON.serialize(result).contains('PRIVATE'), '一覧参照も秘密を非公開');
            Assert.isFalse(result.containsKey('confirmedAt'), '変更の完了結果と区別');
        }
    }

    /** 対象IDや確認IDの不備では変更要求を送らない */
    @IsTest
    static void rejectsUnconfirmedApplicationTargets() {
        grantFeatureAccess();

        System.runAs(testUser) {
            Test.startTest();

            RequestQueue differentIdRequests = applicationQueue(APPLICATION_QUERY + ' AND Id = \'' + APP_ID + '\'');
            Map<String, String> differentIdInput = input('generate');
            differentIdInput.put('confirmationId', OTHER_APP_ID);
            Test.setMock(HttpCalloutMock.class, differentIdRequests);
            Map<String, Object> differentIdResult = ExternalClientAppManagerController.execute(differentIdInput);
            differentIdRequests.assertConsumed();
            Assert.areEqual('notStarted', differentIdResult.get('state'), '操作結果を確認');
            Assert.isFalse(JSON.serialize(differentIdResult).contains('PRIVATE'), '内部情報は非公開');

            RequestQueue missingIdRequests = applicationQueue(APPLICATION_QUERY + ' AND Id = \'' + APP_ID + '\'');
            Map<String, String> missingIdInput = input('generate');
            missingIdInput.put('confirmationId', null);
            Test.setMock(HttpCalloutMock.class, missingIdRequests);
            Map<String, Object> missingIdResult = ExternalClientAppManagerController.execute(missingIdInput);
            missingIdRequests.assertConsumed();
            Assert.areEqual('notStarted', missingIdResult.get('state'), '操作結果を確認');
            Assert.isFalse(JSON.serialize(missingIdResult).contains('PRIVATE'), '内部情報は非公開');

            RequestQueue differentNameRequests = applicationQueue(APPLICATION_QUERY + ' AND Id = \'' + APP_ID + '\'');
            Map<String, String> differentNameInput = input('generate');
            differentNameInput.put('confirmation', 'Other');
            Test.setMock(HttpCalloutMock.class, differentNameRequests);
            Map<String, Object> differentNameResult = ExternalClientAppManagerController.execute(differentNameInput);
            differentNameRequests.assertConsumed();
            Assert.areEqual('notStarted', differentNameResult.get('state'), '操作結果を確認');
            Assert.isFalse(JSON.serialize(differentNameResult).contains('PRIVATE'), '内部情報は非公開');
            Test.stopTest();
        }
    }

    /** 生成後の一覧を確認できなければ完了としない */
    @IsTest
    static void rejectsInconsistentGenerationResults() {
        grantFeatureAccess();

        System.runAs(testUser) {
            Test.startTest();
            RequestQueue changedIdRequests = stageQueue(stageBody(null));
            changedIdRequests.add('POST', STAGE_PATH, response(200, stageBody('active')));
            changedIdRequests.add(
                'GET',
                STAGE_PATH,
                response(200, stageBody('active').replace(STAGE_ID, OTHER_STAGE_ID))
            );
            Test.setMock(HttpCalloutMock.class, changedIdRequests);
            Map<String, Object> changedIdResult = ExternalClientAppManagerController.execute(
                stageInput('generate', 'active')
            );
            changedIdRequests.assertConsumed();
            Assert.areEqual(
                new Map<String, Object>{ 'state' => 'unconfirmed' },
                changedIdResult,
                '未確認では日時や秘密を返さない'
            );

            RequestQueue missingGenerationRequests = stageQueue(stageBody(null));
            missingGenerationRequests.add('POST', STAGE_PATH, response(200, '{}'));
            Test.setMock(HttpCalloutMock.class, missingGenerationRequests);
            Map<String, Object> missingGenerationResult = ExternalClientAppManagerController.execute(
                stageInput('generate', 'active')
            );
            missingGenerationRequests.assertConsumed();
            Assert.areEqual(
                new Map<String, Object>{ 'state' => 'unconfirmed' },
                missingGenerationResult,
                '未確認では日時や秘密を返さない'
            );

            Test.stopTest();
        }
    }

    /** 適用後のID・状態が一致しなければ完了としない */
    @IsTest
    static void rejectsInconsistentApplicationResults() {
        grantFeatureAccess();

        System.runAs(testUser) {
            Test.startTest();
            RequestQueue unexpectedStateRequests = stageQueue(stageBody('active'));
            unexpectedStateRequests.add('PATCH', STAGE_PATH + '/' + STAGE_ID, response(200, '{"state":"active"}'));
            Test.setMock(HttpCalloutMock.class, unexpectedStateRequests);
            Map<String, Object> unexpectedStateResult = ExternalClientAppManagerController.execute(
                stageInput('apply', 'active')
            );
            unexpectedStateRequests.assertConsumed();
            Assert.areEqual(
                new Map<String, Object>{ 'state' => 'unconfirmed' },
                unexpectedStateResult,
                '未確認では日時や秘密を返さない'
            );

            RequestQueue unchangedStageRequests = stageQueue(stageBody('active'));
            unchangedStageRequests.add('PATCH', STAGE_PATH + '/' + STAGE_ID, response(200, '{"state":"rotated"}'));
            unchangedStageRequests.add('GET', STAGE_PATH, response(200, stageBody('active')));
            Test.setMock(HttpCalloutMock.class, unchangedStageRequests);
            Map<String, Object> unchangedStageResult = ExternalClientAppManagerController.execute(
                stageInput('apply', 'active')
            );
            unchangedStageRequests.assertConsumed();
            Assert.areEqual(
                new Map<String, Object>{ 'state' => 'unconfirmed' },
                unchangedStageResult,
                '未確認では日時や秘密を返さない'
            );

            RequestQueue missingStageRequests = stageQueue(stageBody('active'));
            missingStageRequests.add('PATCH', STAGE_PATH + '/' + STAGE_ID, response(200, '{"state":"rotated"}'));
            missingStageRequests.add('GET', STAGE_PATH, response(200, stageBody(null)));
            Test.setMock(HttpCalloutMock.class, missingStageRequests);
            Map<String, Object> missingStageResult = ExternalClientAppManagerController.execute(
                stageInput('apply', 'active')
            );
            missingStageRequests.assertConsumed();
            Assert.areEqual(
                new Map<String, Object>{ 'state' => 'unconfirmed' },
                missingStageResult,
                '未確認では日時や秘密を返さない'
            );

            Test.stopTest();
        }
    }

    /** 削除後に対象が残っていれば完了としない */
    @IsTest
    static void rejectsUnconfirmedDeletion() {
        grantFeatureAccess();

        System.runAs(testUser) {
            Test.startTest();
            RequestQueue remainingStageRequests = stageQueue(stageBody('rotated'));
            remainingStageRequests.add('DELETE', STAGE_PATH + '/' + STAGE_ID, response(200, ''));
            remainingStageRequests.add('GET', STAGE_PATH, response(200, stageBody('rotated')));
            Test.setMock(HttpCalloutMock.class, remainingStageRequests);
            Map<String, Object> remainingStageResult = ExternalClientAppManagerController.execute(
                stageInput('deleteStage', 'rotated')
            );
            remainingStageRequests.assertConsumed();
            Assert.areEqual(
                new Map<String, Object>{ 'state' => 'unconfirmed' },
                remainingStageResult,
                '未確認では日時や秘密を返さない'
            );
            Test.stopTest();
        }
    }

    /** 変更後の一覧取得に失敗したら結果不明として停止 */
    @IsTest
    static void stopsAfterVerificationReadFailures() {
        grantFeatureAccess();

        System.runAs(testUser) {
            Test.startTest();

            RequestQueue generationReadRequests = stageQueue(stageBody(null));
            generationReadRequests.add('POST', STAGE_PATH, response(200, stageBody('active')));
            generationReadRequests.add('GET', STAGE_PATH, response(503, 'PRIVATE'));
            Test.setMock(HttpCalloutMock.class, generationReadRequests);
            Map<String, Object> generationReadResult = ExternalClientAppManagerController.execute(input('generate'));
            generationReadRequests.assertConsumed();
            Assert.areEqual(
                new Map<String, Object>{ 'state' => 'unconfirmed' },
                generationReadResult,
                '未確認では日時や秘密を返さない'
            );

            RequestQueue applicationReadRequests = stageQueue(stageBody('active'));
            applicationReadRequests.add('PATCH', STAGE_PATH + '/' + STAGE_ID, response(200, '{"state":"rotated"}'));
            applicationReadRequests.add('GET', STAGE_PATH, response(503, 'PRIVATE'));
            Test.setMock(HttpCalloutMock.class, applicationReadRequests);
            Map<String, Object> applicationReadResult = ExternalClientAppManagerController.execute(input('apply'));
            applicationReadRequests.assertConsumed();
            Assert.areEqual(
                new Map<String, Object>{ 'state' => 'unconfirmed' },
                applicationReadResult,
                '未確認では日時や秘密を返さない'
            );

            RequestQueue deletionReadRequests = stageQueue(stageBody('rotated'));
            deletionReadRequests.add('DELETE', STAGE_PATH + '/' + STAGE_ID, response(200, ''));
            deletionReadRequests.add('GET', STAGE_PATH, response(503, 'PRIVATE'));
            Test.setMock(HttpCalloutMock.class, deletionReadRequests);
            Map<String, Object> deletionReadResult = ExternalClientAppManagerController.execute(
                stageInput('deleteStage', 'rotated')
            );
            deletionReadRequests.assertConsumed();
            Assert.areEqual(
                new Map<String, Object>{ 'state' => 'unconfirmed' },
                deletionReadResult,
                '未確認では日時や秘密を返さない'
            );
            Test.stopTest();
        }
    }

    /** 変更要求の失敗後に再送や後続操作を行わない */
    @IsTest
    static void stopsAfterMutationFailures() {
        grantFeatureAccess();

        System.runAs(testUser) {
            Test.startTest();

            RequestQueue generationFailureRequests = stageQueue(stageBody(null));
            generationFailureRequests.add('POST', STAGE_PATH, response(503, 'PRIVATE'));
            Test.setMock(HttpCalloutMock.class, generationFailureRequests);
            Map<String, Object> generationFailureResult = ExternalClientAppManagerController.execute(input('generate'));
            generationFailureRequests.assertConsumed();
            Assert.areEqual(
                new Map<String, Object>{ 'state' => 'unconfirmed' },
                generationFailureResult,
                '未確認では日時や秘密を返さない'
            );

            RequestQueue applicationFailureRequests = stageQueue(stageBody('active'));
            applicationFailureRequests.add('PATCH', STAGE_PATH + '/' + STAGE_ID, response(503, 'PRIVATE'));
            Test.setMock(HttpCalloutMock.class, applicationFailureRequests);
            Map<String, Object> applicationFailureResult = ExternalClientAppManagerController.execute(input('apply'));
            applicationFailureRequests.assertConsumed();
            Assert.areEqual(
                new Map<String, Object>{ 'state' => 'unconfirmed' },
                applicationFailureResult,
                '未確認では日時や秘密を返さない'
            );

            RequestQueue deletionFailureRequests = stageQueue(stageBody('rotated'));
            deletionFailureRequests.add('DELETE', STAGE_PATH + '/' + STAGE_ID, response(503, 'PRIVATE'));
            Test.setMock(HttpCalloutMock.class, deletionFailureRequests);
            Map<String, Object> deletionFailureResult = ExternalClientAppManagerController.execute(
                stageInput('deleteStage', 'rotated')
            );
            deletionFailureRequests.assertConsumed();
            Assert.areEqual(
                new Map<String, Object>{ 'state' => 'unconfirmed' },
                deletionFailureResult,
                '未確認では日時や秘密を返さない'
            );
            Test.stopTest();
        }
    }

    /** 残存ステージの検証結果を公開し、生成APIを呼ばずに停止 */
    @IsTest
    static void rejectsGenerationWithRemainingStage() {
        grantFeatureAccess();

        System.runAs(testUser) {
            Test.startTest();

            RequestQueue activeStageRequests = stageQueue(stageBody('active'));
            Test.setMock(HttpCalloutMock.class, activeStageRequests);
            Map<String, Object> activeStageResult = ExternalClientAppManagerController.execute(input('generate'));
            activeStageRequests.assertConsumed();
            Assert.areEqual('notStarted', activeStageResult.get('state'), '操作結果を確認');
            Assert.isFalse(JSON.serialize(activeStageResult).contains('PRIVATE'), '内部情報は非公開');

            Test.stopTest();
        }
    }

    /** 生成・適用・削除は各一回の変更と事後確認で完了 */
    @IsTest
    static void executesOneMutationPerOperation() {
        grantFeatureAccess();

        System.runAs(testUser) {
            Test.startTest();

            RequestQueue generationRequests = stageQueue(stageBody(null));
            generationRequests.add('POST', STAGE_PATH, response(201, stageBody('active')));
            generationRequests.add('GET', STAGE_PATH, response(200, stageBody('active')));
            Test.setMock(HttpCalloutMock.class, generationRequests);
            Map<String, Object> generationResult = ExternalClientAppManagerController.execute(input('generate'));
            generationRequests.assertConsumed();
            Assert.areEqual('complete', generationResult.get('state'), '操作結果を確認');
            Assert.isFalse(JSON.serialize(generationResult).contains('PRIVATE'), '内部情報は非公開');
            Assert.isNotNull(generationResult.get('confirmedAt'), '再取得の確認日時');

            RequestQueue applicationRequests = stageQueue(stageBody('active'));
            applicationRequests.add(
                'PATCH',
                STAGE_PATH + '/' + STAGE_ID,
                response(200, '{"state":"rotated","secret":"PRIVATE"}')
            );
            Map<String, Object> applied = (Map<String, Object>) JSON.deserializeUntyped(stageBody('rotated'));
            ((List<Object>) applied.get('stagedCredentials'))
                .add(new Map<String, Object>{ 'id' => OTHER_STAGE_ID, 'state' => 'rotated', 'secret' => 'PRIVATE' });
            applicationRequests.add('GET', STAGE_PATH, response(200, JSON.serialize(applied)));
            Test.setMock(HttpCalloutMock.class, applicationRequests);
            Map<String, Object> applicationResult = ExternalClientAppManagerController.execute(input('apply'));
            applicationRequests.assertConsumed();
            Assert.areEqual('complete', applicationResult.get('state'), '操作結果を確認');
            Assert.isFalse(JSON.serialize(applicationResult).contains('PRIVATE'), '内部情報は非公開');
            Assert.isNotNull(applicationResult.get('confirmedAt'), '再取得の確認日時');
            Assert.areEqual(2, ((List<Object>) applicationResult.get('stages')).size(), '今回と既存の旧資格情報を保持');

            RequestQueue deletionRequests = stageQueue(stageBody('active'));
            deletionRequests.add('DELETE', STAGE_PATH + '/' + STAGE_ID, response(204, ''));
            deletionRequests.add('GET', STAGE_PATH, response(200, stageBody(null)));
            Test.setMock(HttpCalloutMock.class, deletionRequests);
            Map<String, Object> deletionResult = ExternalClientAppManagerController.execute(input('deleteStage'));
            deletionRequests.assertConsumed();
            Assert.areEqual('complete', deletionResult.get('state'), '操作結果を確認');
            Assert.isFalse(JSON.serialize(deletionResult).contains('PRIVATE'), '内部情報は非公開');
            Assert.isNotNull(deletionResult.get('confirmedAt'), '再取得の確認日時');
            Test.stopTest();
        }
    }

    /** アプリ候補の取得では鍵・秘密を公開しない */
    @IsTest
    static void listsWithoutCredentials() {
        grantFeatureAccess();

        System.runAs(testUser) {
            RequestQueue mock = applicationQueue(APPLICATION_QUERY);
            Test.setMock(HttpCalloutMock.class, mock);
            Test.startTest();
            Map<String, Object> result = ExternalClientAppManagerController.execute(
                new Map<String, String>{ 'action' => 'list' }
            );
            Test.stopTest();
            mock.assertConsumed();
            Assert.areEqual(1, ((List<Object>) result.get('applications')).size(), '候補だけを公開');
            Assert.isFalse(JSON.serialize(result).contains('PRIVATE'), '秘密を非公開');
        }
    }

    /** 検索語を候補取得のラベル・API名条件へ渡す */
    @IsTest
    static void searchesApplicationLabelsAndNames() {
        grantFeatureAccess();

        System.runAs(testUser) {
            RequestQueue mock = applicationQueue(
                APPLICATION_QUERY + ' AND (MasterLabel LIKE \'%Target%\' OR DeveloperName LIKE \'%Target%\')'
            );
            Test.setMock(HttpCalloutMock.class, mock);
            Test.startTest();
            Map<String, Object> result = ExternalClientAppManagerController.execute(
                new Map<String, String>{ 'action' => 'list', 'term' => ' Target ' }
            );
            Test.stopTest();
            mock.assertConsumed();
            Assert.areEqual(1, ((List<Object>) result.get('applications')).size(), 'サーバー検索の結果を公開');
        }
    }

    /** 適用済みステージへの再適用を変更前に拒否 */
    @IsTest
    static void rejectsRotatedApply() {
        grantFeatureAccess();

        System.runAs(testUser) {
            RequestQueue mock = stageQueue(stageBody('rotated'));
            Test.setMock(HttpCalloutMock.class, mock);
            Test.startTest();
            Map<String, Object> result = ExternalClientAppManagerController.execute(stageInput('apply', 'rotated'));
            Test.stopTest();
            mock.assertConsumed();
            Assert.areEqual('notStarted', result.get('state'), '操作結果を確認');
            Assert.isFalse(JSON.serialize(result).contains('PRIVATE'), '内部情報は非公開');
        }
    }

    /** 確認時から状態が変わったステージを削除しない */
    @IsTest
    static void rejectsStaleStage() {
        grantFeatureAccess();

        System.runAs(testUser) {
            RequestQueue mock = stageQueue(stageBody('rotated'));
            Test.setMock(HttpCalloutMock.class, mock);
            Test.startTest();
            Map<String, Object> result = ExternalClientAppManagerController.execute(input('deleteStage'));
            Test.stopTest();
            mock.assertConsumed();
            Assert.areEqual('notStarted', result.get('state'), '操作結果を確認');
            Assert.isFalse(JSON.serialize(result).contains('PRIVATE'), '内部情報は非公開');
        }
    }

    /** 参照APIの権限拒否を設定案内へ変換して停止 */
    @IsTest
    static void rejectsForbiddenBeforeMutation() {
        grantFeatureAccess();

        System.runAs(testUser) {
            RequestQueue mock = consumerQueue();
            mock.add('GET', STAGE_PATH, response(403, 'PRIVATE'));
            Test.setMock(HttpCalloutMock.class, mock);
            Test.startTest();
            Map<String, Object> result = ExternalClientAppManagerController.execute(input('generate'));
            Test.stopTest();
            mock.assertConsumed();
            Assert.areEqual('notStarted', result.get('state'), '操作結果を確認');
            Assert.isFalse(JSON.serialize(result).contains('PRIVATE'), '内部情報は非公開');
            Assert.isTrue(((String) result.get('message')).contains('コンシューマーの秘密'), '設定案内');
        }
    }

    /** 接続先の本人性を確認できなければ変更を拒否 */
    @IsTest
    static void rejectsWrongIdentity() {
        grantFeatureAccess();

        System.runAs(testUser) {
            RequestQueue mock = new RequestQueue();
            mock.add('GET', '/services/data/v68.0/', response(200, '{}'));
            mock.add(
                'GET',
                '/services/oauth2/userinfo',
                response(200, '{"organization_id":"other","user_id":"other"}')
            );
            Test.setMock(HttpCalloutMock.class, mock);
            Test.startTest();
            Map<String, Object> result = ExternalClientAppManagerController.execute(input('generate'));
            Test.stopTest();
            mock.assertConsumed();
            Assert.areEqual('notStarted', result.get('state'), '操作結果を確認');
            Assert.isFalse(JSON.serialize(result).contains('PRIVATE'), '内部情報は非公開');
        }
    }

    /** 一覧参照の失敗で内部情報を公開しない */
    @IsTest
    static void rejectsReadFailureSafely() {
        grantFeatureAccess();

        System.runAs(testUser) {
            RequestQueue mock = consumerQueue();
            mock.add('GET', STAGE_PATH, response(500, 'PRIVATE'));
            Test.setMock(HttpCalloutMock.class, mock);
            Test.startTest();
            try {
                ExternalClientAppManagerController.execute(input('stages'));
                Assert.fail('参照失敗を通知');
            } catch (AuraHandledException error) {
                Assert.isFalse(error.getMessage().contains('PRIVATE'), '本文を公開しない');
            }
            Test.stopTest();
            mock.assertConsumed();
        }
    }

    /** 廃止した一括操作を公開入口で拒否 */
    @IsTest
    static void rejectsLegacyCombinedAction() {
        grantFeatureAccess();

        System.runAs(testUser) {
            RequestQueue mock = new RequestQueue();
            Test.setMock(HttpCalloutMock.class, mock);
            Test.startTest();
            try {
                ExternalClientAppManagerController.execute(input('replace'));
                Assert.fail('非公開操作を拒否');
            } catch (AuraHandledException error) {
                Assert.isTrue(error.getMessage().contains('操作'), '入力エラーを案内');
            }
            Test.stopTest();
            mock.assertConsumed();
        }
    }

    /** 接続状態と独立して標準認証URLを取得 */
    @IsTest
    static void providesStandardAuthenticationUrl() {
        grantFeatureAccess();

        System.runAs(testUser) {
            ExternalClientAppManagerApiClient.credentialAccess = new CredentialMock(false);
            RequestQueue mock = new RequestQueue();
            mock.add('GET', '/services/data/v68.0/', response(401, 'PRIVATE'));
            Test.setMock(HttpCalloutMock.class, mock);
            Test.startTest();
            Map<String, Object> result = ExternalClientAppManagerController.getAuthentication();
            String authenticationUrl = ExternalClientAppManagerController.getAuthenticationUrl();
            Test.stopTest();
            Assert.areEqual('REQUIRED', result.get('status'), '未認証の接続状態を返す');
            Assert.isFalse(result.containsKey('url'), '接続状態とURL取得を分離');
            Assert.areEqual(Url.getOrgDomainUrl().toExternalForm() + '/auth', authenticationUrl, '接続確認と独立して標準URLを使用');
        }
    }

    /** 接続状態の確認失敗を公開用の案内へ変換 */
    @IsTest
    static void hidesAuthenticationApiFailure() {
        grantFeatureAccess();

        System.runAs(testUser) {
            ExternalClientAppManagerApiClient.credentialAccess = new CredentialMock(true);
            RequestQueue mock = new RequestQueue();
            mock.add('GET', '/services/data/v68.0/', response(403, 'PRIVATE'));
            Test.setMock(HttpCalloutMock.class, mock);
            Test.startTest();
            Map<String, Object> result = ExternalClientAppManagerController.getAuthentication();
            Test.stopTest();
            Assert.areEqual(
                new Map<String, Object>{ 'status' => 'UNAVAILABLE' },
                result,
                '秘密を含まない状態だけを公開'
            );
        }
    }

    /** 本人の管理用資格情報の解除を標準APIへ委譲 */
    @IsTest
    static void revokesOwnManagementAuthentication() {
        grantFeatureAccess();

        System.runAs(testUser) {
            CredentialMock mock = new CredentialMock(false);
            ExternalClientAppManagerApiClient.credentialAccess = mock;
            Test.startTest();
            ExternalClientAppManagerController.revokeAuthentication();
            Test.stopTest();
            Assert.isTrue(mock.revoked, '本人の標準認証解除だけを呼ぶ');
        }
    }

    /** 認証解除の失敗で内部例外を公開しない */
    @IsTest
    static void hidesRevokeFailure() {
        grantFeatureAccess();

        System.runAs(testUser) {
            ExternalClientAppManagerApiClient.credentialAccess = new CredentialMock(true);
            Test.startTest();
            try {
                ExternalClientAppManagerController.revokeAuthentication();
                Assert.fail('解除失敗を通知');
            } catch (AuraHandledException error) {
                Assert.isFalse(error.getMessage().contains('PRIVATE'), '内部例外を公開しない');
            }
            Test.stopTest();
        }
    }

    /** 認証URLの取得失敗を固定の案内へ変換 */
    @IsTest
    static void hidesAuthenticationUrlFailure() {
        grantFeatureAccess();

        System.runAs(testUser) {
            ExternalClientAppManagerApiClient.credentialAccess = new CredentialMock(true);
            Test.startTest();
            try {
                ExternalClientAppManagerController.getAuthenticationUrl();
                Assert.fail('URL取得失敗を通知');
            } catch (AuraHandledException error) {
                Assert.isTrue(error.getMessage().contains('認証を開始できません'), '公開案内を表示');
                Assert.isFalse(error.getMessage().contains('PRIVATE'), '内部情報を公開しない');
            }
            Test.stopTest();
        }
    }

    /** 標準認証APIの呼び出し境界を固定 */
    private class CredentialMock extends ExternalClientAppManagerApiClient.CredentialAccess {
        private Boolean fail;
        private Boolean revoked = false;
        /** 成功・失敗を指定
         * @param fail 標準APIの例外を再現するか
         */
        private CredentialMock(Boolean fail) {
            this.fail = fail;
        }
        /** 未設定を返す
         * @return 標準認証状態
         */
        public override ConnectApi.CredentialAuthenticationStatus getStatus() {
            if (fail) {
                throw new CalloutException('PRIVATE');
            }
            return ConnectApi.CredentialAuthenticationStatus.NotConfigured;
        }
        /** 模擬の標準URL
         * @return 現在組織のURL
         */
        public override String getUrl() {
            if (fail) { throw new CalloutException('PRIVATE'); }
            return Url.getOrgDomainUrl().toExternalForm() + '/auth';
        }
        /** 実資格情報を解除せず呼び出しを記録 */
        public override void revoke() {
            if (fail) {
                throw new CalloutException('PRIVATE');
            }
            revoked = true;
        }
    }

    private static HttpResponse response(Integer status, String body) {
        HttpResponse result = new HttpResponse();
        result.setStatusCode(status);
        result.setBody(body);
        return result;
    }

    private static Map<String, String> input(String action) {
        return stageInput(action, 'active');
    }

    private static Map<String, String> stageInput(String action, String state) {
        return new Map<String, String>{
            'action' => action,
            'appId' => APP_ID,
            'confirmation' => 'Target',
            'confirmationId' => APP_ID,
            'stageId' => STAGE_ID,
            'stageState' => state
        };
    }

    private static String stageBody(String state) {
        List<Object> rows = new List<Object>();
        if (state != null) {
            rows.add(
                new Map<String, Object>{ 'id' => STAGE_ID, 'state' => state, 'key' => 'PRIVATE', 'secret' => 'PRIVATE' }
            );
        }
        return JSON.serialize(new Map<String, Object>{ 'stagedCredentials' => rows });
    }

    private static RequestQueue applicationQueue(String query) {
        RequestQueue mock = new RequestQueue();
        mock.add('GET', '/services/data/v68.0/', response(200, '{}'));
        mock.add(
            'GET',
            '/services/oauth2/userinfo',
            response(
                200,
                JSON.serialize(
                    new Map<String, Object>{
                        'organization_id' => UserInfo.getOrganizationId(),
                        'user_id' => UserInfo.getUserId()
                    }
                )
            )
        );
        mock.add(
            'GET',
            '/services/data/v68.0/tooling/query/?q=' + EncodingUtil.urlEncode(
                query + ' ORDER BY DeveloperName LIMIT 200',
                'UTF-8'
            ),
            response(
                200,
                JSON.serialize(
                    new Map<String, Object>{
                        'done' => true,
                        'records' => new List<Object>{
                            new Map<String, Object>{
                                'Id' => APP_ID,
                                'DeveloperName' => 'Target',
                                'MasterLabel' => '対象',
                                'DistributionState' => 'Local'
                            }
                        }
                    }
                )
            )
        );
        return mock;
    }

    private static RequestQueue consumerQueue() {
        RequestQueue mock = applicationQueue(APPLICATION_QUERY + ' AND Id = \'' + APP_ID + '\'');
        mock.add(
            'GET',
            CONSUMER_PATH,
            response(
                200,
                JSON.serialize(
                    new Map<String, Object>{
                        'consumers' => new List<Object>{
                            new Map<String, Object>{ 'id' => CONSUMER_ID, 'key' => 'PRIVATE' }
                        }
                    }
                )
            )
        );
        return mock;
    }

    private static RequestQueue stageQueue(String body) {
        RequestQueue mock = consumerQueue();
        mock.add('GET', STAGE_PATH, response(200, body));
        return mock;
    }

    /** 期待する通信一件の契約と模擬応答 */
    private class ExpectedRequest {
        private String method;
        private String path;
        private HttpResponse response;
        /** 検証する要求と返す応答を設定
         * @param method HTTPメソッド
         * @param path 組織内パス
         * @param response 模擬応答
         */
        private ExpectedRequest(String method, String path, HttpResponse response) {
            this.method = method;
            this.path = path;
            this.response = response;
        }
    }

    /** 想定外の要求・順序・再送を検出する通信モック */
    private class RequestQueue implements HttpCalloutMock {
        private List<ExpectedRequest> expected = new List<ExpectedRequest>();
        private Integer consumed = 0;

        private void add(String method, String path, HttpResponse response) {
            expected.add(new ExpectedRequest(method, path, response));
        }

        private void assertConsumed() {
            Assert.areEqual(expected.size(), consumed, '予定した要求だけを順番に実行');
        }

        /** 専用接続・要求本文・順序を照合し、指定した応答だけを返す
         * @param request 実行されたHTTP要求
         * @return 次の模擬応答
         */
        public HttpResponse respond(HttpRequest request) {
            Assert.isTrue(consumed < expected.size(), '予定外の要求や再送を拒否');
            ExpectedRequest step = expected[consumed++];
            Assert.areEqual(step.method, request.getMethod(), '要求の順序とメソッド');
            Assert.areEqual('callout:ExternalClientAppManager' + step.path, request.getEndpoint(), '対象パス');
            Assert.areEqual('application/json', request.getHeader('Accept'), 'JSONを要求');
            Assert.areEqual('application/json', request.getHeader('Content-Type'), 'JSON本文');
            if (step.method == 'POST') {
                Assert.areEqual('{}', request.getBody(), '生成本文');
            } else if (step.method == 'PATCH') {
                Assert.areEqual('{"command":"rotate"}', request.getBody(), '適用本文');
            } else {
                Assert.isTrue(String.isBlank(request.getBody()), '不要な本文や秘密を送らない');
            }
            return step.response;
        }
    }
}