/** 資格情報管理の入力・状態検証と公開情報の選別 */
@IsTest
private with sharing class ExternalClientAppManagerServiceTest {
    private static ExternalClientAppManagerService service = new ExternalClientAppManagerService();
    private static ExternalClientAppManagerService.Stages stages = new ExternalClientAppManagerService.Stages();
    private static ExternalClientAppManagerService.View view = new ExternalClientAppManagerService.View();
    private static User testUser = new User(Id = UserInfo.getUserId());
    private static final String APP_ID = '0xI' + '0'.repeat(11) + '1';
    private static final String CONSUMER_ID = '888' + '0'.repeat(11) + '1';
    private static final String STAGE_ID = '0ug' + '0'.repeat(11) + '1';

    /** 不正な操作・ID・確認値を処理前に拒否 */
    @IsTest
    static void validatesRequestBoundaries() {
        System.runAs(testUser) {
            Test.startTest();

            try {
                service.requireApplication(new List<Object>(), new Map<String, String>{ 'appId' => '../secret' });
                Assert.fail('パス改ざんを拒否');
            } catch (ExternalClientAppManagerService.ValidationException malformedIdError) {
                Assert.isTrue(malformedIdError.getMessage().contains('形式'), 'ID形式を検証');
            }

            try {
                service.requireRequest(null);
                Assert.fail('操作欠落を拒否');
            } catch (ExternalClientAppManagerService.ValidationException missingRequestError) {
                Assert.isTrue(missingRequestError.getMessage().contains('操作'), '必須入力を案内');
            }

            try {
                service.requireRequest(new Map<String, String>{ 'action' => 'deleteStage', 'stageId' => STAGE_ID });
                Assert.fail('状態なしの削除を拒否');
            } catch (ExternalClientAppManagerService.ValidationException missingStageError) {
                Assert.isTrue(missingStageError.getMessage().contains('操作対象'), '再取得を案内');
            }

            for (String action : new List<String>{ 'apply', 'deleteStage' }) {
                for (String unsupportedState : new List<String>{ null, '', 'unknown' }) {
                    try {
                        service.requireRequest(
                            new Map<String, String>{
                                'action' => action,
                                'stageId' => STAGE_ID,
                                'stageState' => unsupportedState
                            }
                        );
                        Assert.fail('未対応状態を拒否');
                    } catch (ExternalClientAppManagerService.ValidationException unsupportedStateError) {
                        Assert.isTrue(unsupportedStateError.getMessage().contains('操作対象'), '対象を再確認');
                    }
                }
            }
            Test.stopTest();
        }
    }

    /** 未適用だけを適用対象とし、適用後のID・状態・件数を照合 */
    @IsTest
    static void validatesAppliedStageResults() {
        System.runAs(testUser) {
            Test.startTest();

            try {
                stages.requireRotated(new Map<String, Object>{ 'state' => 'active' });
                Assert.fail('未適用を成功にしない');
            } catch (ExternalClientAppManagerService.ValidationException unappliedError) {
                Assert.isTrue(unappliedError.getMessage().contains('適用'), '適用結果不明を案内');
            }

            try {
                stages.requireRetiredStage(rows('rotated'), '0ug' + '0'.repeat(11) + '2');
                Assert.fail('別IDのステージを適用完了としない');
            } catch (ExternalClientAppManagerService.ValidationException differentStageError) {
                Assert.isTrue(differentStageError.getMessage().contains('変更'), '並行変更を案内');
            }

            try {
                stages.requireRetiredStage(new List<Object>(), STAGE_ID);
                Assert.fail('適用後の欠落を検知');
            } catch (ExternalClientAppManagerService.ValidationException missingStageError) {
                Assert.isTrue(missingStageError.getMessage().contains('一意'), '適用結果の対象不明を案内');
            }

            stages.requireApplicable(rows('active'), new Map<String, String>{ 'stageId' => STAGE_ID });
            for (String inapplicableState : new List<String>{ 'rotated', 'expired', 'unknown' }) {
                try {
                    stages.requireApplicable(rows(inapplicableState), new Map<String, String>{ 'stageId' => STAGE_ID });
                    Assert.fail('未適用以外を拒否');
                } catch (ExternalClientAppManagerService.ValidationException inapplicableStateError) {
                    Assert.isTrue(inapplicableStateError.getMessage().contains('未適用'), '適用条件を案内');
                }
            }
            Test.stopTest();
        }
    }

    /** 残存ステージを拒否し、生成・適用した同じIDと状態を確認 */
    @IsTest
    static void validatesGenerationResults() {
        System.runAs(testUser) {
            Test.startTest();

            stages.requireEmptyStages(new List<Object>());
            for (String remainingState : new List<String>{ 'active', 'rotated', 'expired', 'unknown' }) {
                try {
                    stages.requireEmptyStages(new List<Object>{ new Map<String, Object>{ 'state' => remainingState } });
                    Assert.fail('資格情報が残った生成を拒否');
                } catch (ExternalClientAppManagerService.ValidationException remainingStageError) {
                    Assert.isTrue(remainingStageError.getMessage().contains('手動で削除'), '手動整理を案内');
                }
            }

            List<Object> generatedAndRetiredStages = rows('rotated');
            ((Map<String, Object>) generatedAndRetiredStages[0]).put('id', '0ug' + '0'.repeat(11) + '2');
            generatedAndRetiredStages.addAll(rows('ACTIVE'));
            Assert.areEqual(STAGE_ID, stages.generatedStageId(generatedAndRetiredStages), '今回の未適用だけを特定');
            ((Map<String, Object>) generatedAndRetiredStages[1]).put('state', 'rotated');
            stages.requireRetiredStage(generatedAndRetiredStages, STAGE_ID);
            Assert.areEqual(2, generatedAndRetiredStages.size(), '旧資格情報を保持');

            try {
                stages.generatedStageId(new List<Object>());
                Assert.fail('生成応答欠落を拒否');
            } catch (ExternalClientAppManagerService.ValidationException missingGenerationError) {
                Assert.isTrue(missingGenerationError.getMessage().contains('一意'), '生成結果不明を案内');
            }

            try {
                stages.generatedStageId(rows('expired'));
                Assert.fail('期限切れを新規生成成功にしない');
            } catch (ExternalClientAppManagerService.ValidationException expiredGenerationError) {
                Assert.isTrue(expiredGenerationError.getMessage().contains('状態'), '生成状態を検証');
            }

            List<Object> duplicateStages = rows('active');
            duplicateStages.addAll(rows('active'));
            try {
                stages.generatedStageId(duplicateStages);
                Assert.fail('生成候補の重複を拒否');
            } catch (ExternalClientAppManagerService.ValidationException duplicateStageError) {
                Assert.isTrue(duplicateStageError.getMessage().contains('一意'), '重複を案内');
            }
            try {
                stages.requireRetiredStage(duplicateStages, STAGE_ID);
                Assert.fail('同じIDの重複を拒否');
            } catch (ExternalClientAppManagerService.ValidationException duplicateStageError) {
                Assert.isTrue(duplicateStageError.getMessage().contains('一意'), '適用確認の重複を案内');
            }
            Test.stopTest();
        }
    }

    /** 部分応答からも管理対象の公開属性だけを返し、一覧欠落は拒否 */
    @IsTest
    static void validatesPublishedCollections() {
        System.runAs(testUser) {
            Test.startTest();

            List<Object> publishedStages = view.stages(
                new Map<String, Object>{
                    'stagedCredentials' => new List<Object>{
                        new Map<String, Object>{
                            'id' => STAGE_ID,
                            'state' => 'active',
                            'key' => 'PRIVATE',
                            'secret' => 'PRIVATE',
                            'expirationDate' => '2026-12-01T00:00:00Z'
                        }
                    }
                }
            );
            Assert.areEqual(1, publishedStages.size(), 'ステージの公開情報');
            Assert.areEqual(
                new Set<String>{ 'id', 'state', 'expirationDate' },
                ((Map<String, Object>) publishedStages[0]).keySet(),
                '許可項目だけを公開'
            );
            Assert.isFalse(JSON.serialize(publishedStages).contains('PRIVATE'), '鍵・秘密を返さない');

            List<Object> eligibleApplications = view.applications(
                new Map<String, Object>{
                    'done' => false,
                    'totalSize' => 201,
                    'records' => new List<Object>{
                        new Map<String, Object>{
                            'Id' => APP_ID,
                            'DeveloperName' => 'ExternalClientAppManager',
                            'DistributionState' => 'Local'
                        },
                        new Map<String, Object>{
                            'Id' => APP_ID,
                            'DeveloperName' => 'Package',
                            'DistributionState' => 'Packaged'
                        },
                        new Map<String, Object>{
                            'Id' => APP_ID,
                            'DeveloperName' => 'Target',
                            'MasterLabel' => '対象',
                            'DistributionState' => 'Local'
                        }
                    }
                }
            );
            Assert.areEqual(1, eligibleApplications.size(), '全体が200件を超える部分応答でも、取得済みの管理対象を返す');
            Assert.areEqual(
                'Target',
                ((Map<String, Object>) eligibleApplications[0]).get('name'),
                '管理用認証元を除外'
            );

            try {
                view.stages(new Map<String, Object>());
                Assert.fail('欠落応答を拒否');
            } catch (ExternalClientAppManagerService.ValidationException missingStagesError) {
                Assert.isTrue(missingStagesError.getMessage().contains('API応答'), '一覧の再取得を案内');
            }

            try {
                view.applications(null);
                Assert.fail('欠落応答を拒否');
            } catch (ExternalClientAppManagerService.ValidationException missingApplicationsError) {
                Assert.isTrue(missingApplicationsError.getMessage().contains('API応答'), '確認不能を明示');
            }

            try {
                view.consumers(new Map<String, Object>{ 'consumers' => 'invalid' });
                Assert.fail('不正な一覧を拒否');
            } catch (ExternalClientAppManagerService.ValidationException invalidConsumersError) {
                Assert.isTrue(invalidConsumersError.getMessage().contains('API応答'), '一覧の再取得を案内');
            }
            Test.stopTest();
        }
    }

    /** 15桁と18桁の同一IDを許可し、不一致を拒否 */
    @IsTest
    static void validatesConfirmationId() {
        System.runAs(testUser) {
            List<Object> apps = new List<Object>{ new Map<String, Object>{ 'id' => APP_ID, 'name' => 'Target' } };
            Map<String, String> input = new Map<String, String>{
                'appId' => APP_ID,
                'confirmation' => 'Target',
                'confirmationId' => String.valueOf((Id) APP_ID)
            };
            Test.startTest();
            Assert.isNotNull(service.requireApplication(apps, input), '18桁の同じIDを許可');
            input.put('confirmationId', APP_ID);
            Assert.isNotNull(service.requireApplication(apps, input), '15桁の同じIDを許可');
            for (String invalidId : new List<String>{ '0xI' + '0'.repeat(11) + '2', '', '../secret' }) {
                input.put('confirmationId', invalidId);
                try {
                    service.requireApplication(apps, input);
                    Assert.fail('一致しないIDは拒否');
                } catch (ExternalClientAppManagerService.ValidationException error) {
                    Assert.isTrue(
                        new Set<String>{
                                '識別子の形式が不正です。',
                                '選択したアプリと入力したIDが一致しません。IDを確認してください。'
                            }
                            .contains(error.getMessage()),
                        '不一致または不正IDの理由を案内'
                    );
                }
            }
            Test.stopTest();
        }
    }

    /** 応答URLに依存せず対象IDから固定パスを構築 */
    @IsTest
    static void constructsStagePathWithoutReturnedUrl() {
        System.runAs(testUser) {
            Test.startTest();
            String path = service.stagePath(
                APP_ID,
                view.consumers(
                    new Map<String, Object>{
                        'consumers' => new List<Object>{
                            new Map<String, Object>{ 'id' => CONSUMER_ID, 'key' => 'PRIVATE' }
                        }
                    }
                )
            );
            Assert.areEqual(
                '/services/data/v68.0/apps/oauth/credentials/' + APP_ID + '/' + CONSUMER_ID + '/staged',
                path,
                'URL欠落時も識別子で構築'
            );
            Test.stopTest();
        }
    }

    /** コンシューマーが見つからなければ処理を停止 */
    @IsTest
    static void rejectsMissingConsumer() {
        System.runAs(testUser) {
            Test.startTest();
            try {
                service.stagePath(APP_ID, new List<Object>());
                Assert.fail('対象不明を拒否');
            } catch (ExternalClientAppManagerService.ValidationException error) {
                Assert.isTrue(error.getMessage().contains('一意'), 'コンシューマー不明を案内');
            }
            Test.stopTest();
        }
    }

    /** 削除対象が一覧に残る場合は完了としない */
    @IsTest
    static void rejectsRemainingDeletedStage() {
        System.runAs(testUser) {
            Test.startTest();
            try {
                stages.requireDeleted(rows('rotated'), STAGE_ID);
                Assert.fail('残っているステージを削除完了にしない');
            } catch (ExternalClientAppManagerService.ValidationException error) {
                Assert.isTrue(error.getMessage().contains('削除完了'), '再取得を案内');
            }
            Test.stopTest();
        }
    }

    /** 確認したAPI名と取得したアプリが異なれば拒否 */
    @IsTest
    static void rejectsUnmatchedApplication() {
        System.runAs(testUser) {
            List<Object> apps = new List<Object>{ new Map<String, Object>{ 'id' => APP_ID, 'name' => 'Target' } };
            Map<String, String> input = new Map<String, String>{
                'appId' => APP_ID,
                'confirmationId' => APP_ID,
                'confirmation' => 'Other'
            };
            Test.startTest();
            try {
                service.requireApplication(apps, input);
                Assert.fail('確認したAPI名が異なれば拒否');
            } catch (ExternalClientAppManagerService.ValidationException error) {
                Assert.isTrue(error.getMessage().contains('対象名'), '対象確認を案内');
            }
            Test.stopTest();
        }
    }

    /** コンシューマーが一意に決まらなければ拒否 */
    @IsTest
    static void rejectsMultipleConsumers() {
        System.runAs(testUser) {
            Test.startTest();
            try {
                service.stagePath(
                    APP_ID,
                    new List<Object>{
                        new Map<String, Object>{ 'id' => CONSUMER_ID },
                        new Map<String, Object>{ 'id' => CONSUMER_ID }
                    }
                );
                Assert.fail('複数候補を拒否');
            } catch (ExternalClientAppManagerService.ValidationException error) {
                Assert.isTrue(error.getMessage().contains('一意'), '候補の確認を案内');
            }
            Test.stopTest();
        }
    }

    private static List<Object> rows(String state) {
        return new List<Object>{ new Map<String, Object>{ 'id' => STAGE_ID, 'state' => state } };
    }
}