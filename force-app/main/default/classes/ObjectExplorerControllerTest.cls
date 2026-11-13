/** ObjectExplorerControllerの公開操作と外部境界テスト */
@IsTest
private with sharing class ObjectExplorerControllerTest {
    /** 分類要求の変更状態 */
    public enum ChangeMode {
        UNCHANGED,
        CHANGE_STATUS
    }

    private static User testUser = new User(Id = UserInfo.getUserId());

    /** 不正JSONを更新前に拒否し公開エラーへ変換 */
    @IsTest
    static void rejectsMalformedSaveRequestBeforeCallout() {
        System.runAs(testUser) {
            Test.startTest();
            try {
                ObjectExplorerController.saveClassifyData('Account', '{');
                Assert.fail('不正JSONでは保存を開始しない');
            } catch (AuraHandledException e) {
                Assert.areEqual(
                    '保存要求の検証：変更内容が不正です。配列で指定してください。',
                    e.getMessage(),
                    '解析の内部情報を含めず入力の修正を案内'
                );
            }
            Assert.areEqual(0, Limits.getCallouts(), '不正な要求を外部APIへ送信しない');
            Assert.areEqual(0, Limits.getDmlStatements(), '不正な要求ではデータを変更しない');
            Test.stopTest();
        }
    }

    /** 標準認証APIがテストで利用できない場合も内部情報を公開しない */
    @IsTest
    static void returnsSafeAuthenticationState() {
        System.runAs(testUser) {
            Test.startTest();
            Map<String, Object> result = ObjectExplorerController.getApiAuthentication();
            Test.stopTest();
            Assert.areEqual(new Set<String>{'status', 'message'}, result.keySet(), '認証情報を公開しない');
            Assert.isTrue(new Set<String>{'AUTHENTICATED', 'REQUIRED', 'UNAVAILABLE'}.contains((String) result.get('status')), '公開状態だけを返す');
        }
    }

    /** カスタム項目日時取得と不要な通信の省略 */
    @IsTest
    static void returnsCustomFieldAudit() {
        System.runAs(testUser) {
            Test.startTest();
            AuditMock mock = new AuditMock();
            Test.setMock(HttpCalloutMock.class, mock);
            Map<String, Object> result = (Map<String, Object>) JSON.deserializeUntyped(
                JSON.serialize(ObjectExplorerController.getFieldAudit('Account'))
            );
            Assert.isTrue(result.containsKey('Active__c'), 'カスタム項目の日時を返す');
            Map<String, Object> field = (Map<String, Object>) result.get('Active__c');
            Assert.areEqual('2026-01-01T00:00:00.000Z', field.get('createdDate'), '作成日時を同じ項目へ対応');
            Assert.areEqual(String.valueOf(testUser.Id), field.get('createdById'), '可視な人物を同じIDで対応');
            Assert.areEqual(2, mock.calls, '接続先確認と日時の一括取得');
            Integer beforeCalls = Limits.getCallouts();
            Assert.isTrue(
                ((Map<String, Object>) JSON.deserializeUntyped(
                        JSON.serialize(ObjectExplorerController.getFieldAudit('Organization'))
                    ))
                    .isEmpty(),
                'カスタム項目のない対象は空'
            );
            Assert.areEqual(beforeCalls, Limits.getCallouts(), 'カスタム項目なしでAPIを呼ばない');
            Test.stopTest();
        }
    }

    /** 日時取得のconnectionを公開メッセージで確認 */
    @IsTest
    static void reportsAuditConnectionFailure() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new AuditFailureMock('connection'));
            String message = auditFailureMessage();
            Assert.isTrue(message.contains('API接続・接続先組織の確認：[OE-API-CONNECTION]'), '失敗した段階と公開可能な理由を返す');
            Assert.isFalse(message.contains('PRIVATE_RESPONSE'), '内部の応答本文を公開しない');
            Test.stopTest();
        }
    }

    /** 日時取得のunauthorizedを公開メッセージで確認 */
    @IsTest
    static void reportsAuditAuthenticationRejection() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new AuditFailureMock('unauthorized'));
            String message = auditFailureMessage();
            Assert.isTrue(message.contains('API接続・接続先組織の確認：[OE-AUTH-401]'), '失敗した段階と公開可能な理由を返す');
            Assert.isFalse(message.contains('PRIVATE_RESPONSE'), '内部の応答本文を公開しない');
            Test.stopTest();
        }
    }

    /** 日時取得のwrongOrgを公開メッセージで確認 */
    @IsTest
    static void reportsAuditWrongOrganization() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new AuditFailureMock('wrongOrg'));
            String message = auditFailureMessage();
            Assert.isTrue(message.contains('API接続・接続先組織の確認：[OE-ORG-MISMATCH]'), '失敗した段階と公開可能な理由を返す');
            Assert.isFalse(message.contains('PRIVATE_RESPONSE'), '内部の応答本文を公開しない');
            Test.stopTest();
        }
    }

    /** 日時取得のtoolingForbiddenを公開メッセージで確認 */
    @IsTest
    static void reportsAuditToolingRejection() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new AuditFailureMock('toolingForbidden'));
            String message = auditFailureMessage();
            Assert.isTrue(message.contains('項目の作成・更新情報のAPI取得：[OE-API-HTTP-403]'), '失敗した段階と公開可能な理由を返す');
            Assert.isFalse(message.contains('PRIVATE_RESPONSE'), '内部の応答本文を公開しない');
            Test.stopTest();
        }
    }

    /** 日時取得のincompleteを公開メッセージで確認 */
    @IsTest
    static void reportsIncompleteAudit() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new AuditFailureMock('incomplete'));
            String message = auditFailureMessage();
            Assert.isTrue(message.contains('項目の作成・更新情報のAPI取得：項目の作成・更新情報をすべて取得できませんでした。'), '失敗した段階と公開可能な理由を返す');
            Assert.isFalse(message.contains('PRIVATE_RESPONSE'), '内部の応答本文を公開しない');
            Test.stopTest();
        }
    }

    /** 日時取得のmalformedを公開メッセージで確認 */
    @IsTest
    static void hidesUnexpectedAuditResponse() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new AuditFailureMock('malformed'));
            String message = auditFailureMessage();
            Assert.isTrue(message.contains('項目の作成・更新情報のAPI取得：[OE-API-RESPONSE]'), '失敗した段階と公開可能な理由を返す');
            Assert.isFalse(message.contains('PRIVATE_RESPONSE'), '内部の応答本文を公開しない');
            Test.stopTest();
        }
    }

    /**
     * 日時取得の公開例外だけを取り出して比較可能にする
     * @return 画面へ公開されるエラーメッセージ
     */
    private static String auditFailureMessage() {
        try {
            ObjectExplorerController.getFieldAudit('Account');
            Assert.fail('失敗を正常応答にしない');
        } catch (AuraHandledException error) {
            return error.getMessage();
        }
        return '';
    }

    /** 構造・項目・分類一覧の公開契約 */
    @IsTest
    static void readsStructureAndClassify() {
        System.runAs(testUser) {
            Test.startTest();
            Map<String, Object> structure = (Map<String, Object>) JSON.deserializeUntyped(
                JSON.serialize(ObjectExplorerController.getObjectInfo('Account', 'classify'))
            );
            Assert.areEqual('Account', structure.get('apiName'), '指定対象を返す');
            Assert.isTrue(((List<Object>) structure.get('relations')).isEmpty(), '分類画面で関連を探索しない');
            Assert.isFalse(((List<Object>) structure.get('fields')).isEmpty(), '項目定義を返す');
            Assert.isFalse(
                ((List<Object>) JSON.deserializeUntyped(
                        JSON.serialize(ObjectExplorerController.searchObjects('Account'))
                    ))
                    .isEmpty(),
                '検索を公開'
            );
            Map<String, Object> classified = (Map<String, Object>) JSON.deserializeUntyped(
                JSON.serialize(ObjectExplorerController.getClassifyData('Account'))
            );
            Assert.isTrue(((Map<String, Object>) classified.get('rows')).containsKey('Name'), '同じ項目名で分類を返す');
            Assert.isTrue(
                ((Map<String, Object>) classified.get('options')).containsKey('BusinessStatus'),
                '組織の分類候補を返す'
            );
            Assert.areEqual(0, Limits.getCallouts(), '通常の一覧取得に外部APIを使わない');
            Test.stopTest();
        }
    }
    /** 検索とCSV所有者照合の接続 */
    @IsTest
    static void resolvesOwnersById() {
        System.runAs(testUser) {
            Test.startTest();
            Map<String, Object> owners = (Map<String, Object>) JSON.deserializeUntyped(
                JSON.serialize(
                    ObjectExplorerController.resolveClassifyOwners(JSON.serialize(new List<Id>{ testUser.Id }))
                )
            );
            Assert.isTrue(owners.containsKey(String.valueOf(testUser.Id)), '要求したIDの所有者を返す');
            Assert.isTrue(
                ((List<Object>) JSON.deserializeUntyped(
                        JSON.serialize(ObjectExplorerController.searchClassifyOwners(null))
                    ))
                    .isEmpty(),
                '空検索語では候補を取得しない'
            );
            Assert.areEqual(0, Limits.getCallouts(), '所有者の検索に外部APIを使わない');
            Test.stopTest();
        }
    }

    /** 入力の構文エラーで解析詳細を利用者へ公開しない */
    @IsTest
    static void hidesMalformedOwnerJsonDetails() {
        System.runAs(testUser) {
            Test.startTest();
            try {
                ObjectExplorerController.resolveClassifyOwners('{');
                Assert.fail('所有者要求の不正な構文を拒否');
            } catch (AuraHandledException error) {
                Assert.areEqual(
                    'CSVの所有者ID要求が不正です。配列で指定してください。',
                    error.getMessage(),
                    'JSON本文や解析情報を公開しない'
                );
            }
            Test.stopTest();
        }
    }
    /** カスタム更新の通信失敗を同じ項目へ反映 */
    @IsTest
    static void rejectsCustomUpdateTransportFailure() {
        System.runAs(testUser) {
            Test.startTest();
            SaveMock mock = new SaveMock('Account', new Set<String>{ 'Active__c' }, 'customError');
            Test.setMock(HttpCalloutMock.class, mock);
            List<Object> result = ObjectExplorerController.saveClassifyData(
                'Account',
                changes(new List<String>{ 'Active__c' }, ChangeMode.CHANGE_STATUS)
            );
            Assert.areEqual(
                false,
                ((Map<String, Object>) result[0]).get('success'),
                'カスタム項目の通信失敗を保存結果へ反映'
            );
            Assert.areEqual(1, mock.writes, '一回の更新要求が失敗');
            Test.stopTest();
        }
    }

    /** 標準項目の保存と再取得の接続 */
    @IsTest
    static void savesStandardFieldAndVerifies() {
        System.runAs(testUser) {
            Test.startTest();
            SaveMock mock = new SaveMock('Account', new Set<String>{ 'Name' }, 'success');
            Test.setMock(HttpCalloutMock.class, mock);
            List<Object> results = ObjectExplorerController.saveClassifyData(
                'Account',
                changes(new List<String>{ 'Name' }, ChangeMode.CHANGE_STATUS)
            );
            Map<String, Object> result = (Map<String, Object>) results[0];
            Assert.areEqual(
                true,
                result.get('success'),
                '再取得値が一致した項目を成功にする: ' + result.get('message')
            );
            Assert.areEqual('Name', result.get('apiName'), '成功は要求した項目に対応');
            Assert.areEqual(1, mock.writes, '標準項目を一括送信');
            Assert.areEqual(1, mock.reads, '保存後だけAPIで最新値を照合');
            Assert.areEqual(2, Limits.getCallouts(), 'バッチ内は一括更新・保存後照会の2回だけ通信');
            Test.stopTest();
        }
    }

    /** 標準・カスタム混在の上限件数を同じ対象へ保存して照合 */
    @IsTest
    static void savesMixedBatchWithoutDuplicateReads() {
        System.runAs(testUser) {
            List<String> names = new List<String>{'Name', 'Phone', 'AccountNumber', 'Active__c', 'CustomerPriority__c',
                'NumberofLocations__c', 'SLA__c', 'SLAExpirationDate__c', 'SLASerialNumber__c', 'UpsellOpportunity__c'};
            SaveMock mock = new SaveMock('Account', new Set<String>(names), 'success');
            Test.setMock(HttpCalloutMock.class, mock);
            String request = changes(names, ChangeMode.CHANGE_STATUS);
            Test.startTest();
            List<Object> results = ObjectExplorerController.saveClassifyData('Account', request);
            Assert.areEqual(names.size(), results.size(), '全対象の結果を返す');
            Assert.areEqual(false, JSON.serialize(results).contains('"success":false'), '全項目で保存後照合が成功');
            Assert.areEqual(1, mock.writes, '標準・カスタムを同じ一括更新で送る');
            Assert.areEqual(1, mock.reads, '保存後だけ分類をAPI再取得');
            Assert.areEqual(3, Limits.getCallouts(), 'バッチ内は定義一括取得・一括更新・保存後照会の3回');
            Test.stopTest();
        }
    }

    /** 標準・カスタム混在でカスタム項目の拒否だけを失敗として保持 */
    @IsTest
    static void preservesMixedPartialSuccess() {
        System.runAs(testUser) {
            List<String> names = new List<String>{'Name','Active__c','CustomerPriority__c'};
            SaveMock mock = new SaveMock('Account', new Set<String>(names), 'rejectCustom');
            Test.setMock(HttpCalloutMock.class, mock);
            Test.startTest();
            List<Object> results = ObjectExplorerController.saveClassifyData('Account', changes(names, ChangeMode.CHANGE_STATUS));
            Test.stopTest();
            Assert.areEqual(true, ((Map<String,Object>)results[0]).get('success'), '標準項目の成功を維持');
            Assert.areEqual(false, ((Map<String,Object>)results[1]).get('success'), '拒否されたカスタム項目だけ失敗');
            Assert.areEqual(true, ((Map<String,Object>)results[2]).get('success'), '他カスタム項目の成功を維持');
            Assert.areEqual(1, mock.definitionReads, 'カスタム定義を一回だけ取得');
            Assert.areEqual(1, mock.writes, '混在しても一回だけ更新');
        }
    }

    /** 変更なしのカスタム項目では定義取得も更新もしない */
    @IsTest
    static void skipsUnchangedCustomDefinitions() {
        System.runAs(testUser) {
            List<String> names = new List<String>{'Active__c'};
            SaveMock mock = new SaveMock('Account', new Set<String>(names), 'success');
            Test.setMock(HttpCalloutMock.class, mock);
            Test.startTest();
            List<Object> results = ObjectExplorerController.saveClassifyData('Account', changes(names, ChangeMode.UNCHANGED));
            Test.stopTest();
            Assert.areEqual(true, ((Map<String,Object>)results[0]).get('success'), '変更なしは現在値の照合で成功');
            Assert.areEqual(0, mock.definitionReads, '変更なしの定義を取得しない');
            Assert.areEqual(0, mock.writes, '変更なしを更新しない');
        }
    }

    /** 変更なしで更新要求を省略 */
    @IsTest
    static void skipsUnchangedWrites() {
        System.runAs(testUser) {
            Test.startTest();
            SaveMock mock = new SaveMock('Account', new Set<String>{ 'Name' }, 'success');
            Test.setMock(HttpCalloutMock.class, mock);
            List<Object> results = ObjectExplorerController.saveClassifyData(
                'Account',
                changes(new List<String>{ 'Name' }, ChangeMode.UNCHANGED)
            );
            Assert.areEqual(
                true,
                ((Map<String, Object>) results[0]).get('success'),
                '変更なしの現状を照合: ' + ((Map<String, Object>) results[0]).get('message')
            );
            Assert.areEqual(0, mock.writes, '変更なしは更新しない');
            Test.stopTest();
        }
    }

    /** 応答順に依存せず個別拒否を維持 */
    @IsTest
    static void preservesPerFieldRejection() {
        System.runAs(testUser) {
            Test.startTest();
            SaveMock mock = new SaveMock('Account', new Set<String>{ 'Name', 'Phone' }, 'rejectPhone');
            Test.setMock(HttpCalloutMock.class, mock);
            List<Object> results = ObjectExplorerController.saveClassifyData(
                'Account',
                changes(new List<String>{ 'Phone', 'Name' }, ChangeMode.CHANGE_STATUS)
            );
            Assert.areEqual('Phone', ((Map<String, Object>) results[0]).get('apiName'), '入力順を保持');
            Assert.areEqual(false, ((Map<String, Object>) results[0]).get('success'), '拒否された項目だけ失敗');
            Assert.areEqual(true, ((Map<String, Object>) results[1]).get('success'), '別項目の成功を維持');
            Assert.areEqual(1, mock.writes, '複数の標準項目を一括送信');
            Test.stopTest();
        }
    }

    /** 保存後の不一致を成功扱いしない */
    @IsTest
    static void doesNotConfirmUnverifiedSave() {
        System.runAs(testUser) {
            Test.startTest();
            SaveMock mock = new SaveMock('Account', new Set<String>{ 'Name' }, 'stale');
            Test.setMock(HttpCalloutMock.class, mock);
            List<Object> results = ObjectExplorerController.saveClassifyData(
                'Account',
                changes(new List<String>{ 'Name' }, ChangeMode.CHANGE_STATUS)
            );
            Assert.areEqual(
                false,
                ((Map<String, Object>) results[0]).get('success'),
                '保存後の値が一致しなければ成功にしない'
            );
            Assert.areEqual(1, mock.writes, '実際に更新要求を送った後の不一致を検証');
            Test.stopTest();
        }
    }

    /** 更新前の競合と通信失敗の接続 */
    @IsTest
    static void isolatesPreparationAndTransportFailures() {
        System.runAs(testUser) {
            Test.startTest();
            SaveMock mock = new SaveMock('Account', new Set<String>{ 'Name' }, 'success');
            Test.setMock(HttpCalloutMock.class, mock);
            List<Object> results = ObjectExplorerController.saveClassifyData(
                'Account',
                changes(new List<String>{ 'Name' }, ChangeMode.CHANGE_STATUS).replace('"securityClassification":"', '"securityClassification":"Conflict')
            );
            Assert.areEqual(false, ((Map<String, Object>) results[0]).get('success'), '編集基準不一致は失敗');
            Assert.areEqual(0, mock.writes, '競合した項目を送信しない');
            Assert.isTrue(String.valueOf(((Map<String, Object>)results[0]).get('message')).contains('編集中に分類が変更'), 'ネイティブの現在値と編集基準の競合を検知');
            Test.setMock(HttpCalloutMock.class, new SaveMock('Account', new Set<String>{ 'Name' }, 'connectionError'));
            results = ObjectExplorerController.saveClassifyData(
                'Account',
                changes(new List<String>{ 'Name' }, ChangeMode.CHANGE_STATUS)
            );
            Assert.areEqual(false, ((Map<String, Object>) results[0]).get('success'), '更新時の通信失敗を結果へ返す');
            Assert.isTrue(String.valueOf(((Map<String, Object>) results[0]).get('message')).contains('更新送信後の確認'), '項目別の失敗にも段階を返す');
            Test.stopTest();
        }
    }

    /** カスタム定義の取得と保持更新の接続 */
    @IsTest
    static void savesCustomFieldWithoutDroppingMetadata() {
        System.runAs(testUser) {
            Test.startTest();
            SaveMock mock = new SaveMock('Account', new Set<String>{ 'Active__c' }, 'success');
            Test.setMock(HttpCalloutMock.class, mock);
            List<Object> results = ObjectExplorerController.saveClassifyData(
                'Account',
                changes(new List<String>{ 'Active__c' }, ChangeMode.CHANGE_STATUS)
            );
            Assert.areEqual(
                true,
                ((Map<String, Object>) results[0]).get('success'),
                'カスタム項目を再取得して照合: ' + ((Map<String, Object>) results[0]).get('message')
            );
            Assert.areEqual(1, mock.writes, '同じカスタム項目へ一回更新');
            Assert.areEqual(3, Limits.getCallouts(), 'バッチ内は定義取得・更新・保存後照会の3回だけ通信');
            Test.stopTest();
        }
    }

    /** 標準項目の通信失敗を結果へ反映 */
    @IsTest
    static void rejectsSoapTransportFailure() {
        System.runAs(testUser) {
            Test.startTest();
            SaveMock mock = new SaveMock('Account', new Set<String>{ 'Name' }, 'soapError');
            Test.setMock(HttpCalloutMock.class, mock);
            List<Object> results = ObjectExplorerController.saveClassifyData(
                'Account',
                changes(new List<String>{ 'Name' }, ChangeMode.CHANGE_STATUS)
            );
            Assert.areEqual(false, ((Map<String, Object>) results[0]).get('success'), 'SOAP通信失敗を成功にしない');
            Assert.areEqual(0, mock.reads, '保存前の重複照会と失敗確定後の再取得をしない');
            Test.stopTest();
        }
    }

    /** 接続・定義取得・事前照合の失敗では更新要求を送らない */
    @IsTest
    static void rejectsFailuresBeforeMetadataUpdate() {
        System.runAs(testUser) {
            String request = changes(new List<String>{ 'Active__c' }, ChangeMode.CHANGE_STATUS);
            Test.startTest();
            assertPrecheckFailure(request, 'connectionError');
            assertPrecheckFailure(request, 'definitionError');
            assertPrecheckFailure(request, 'definitionConflict');
            Assert.areEqual(3, Limits.getCallouts(), '各要求の定義読取だけを行い更新を送らない');
            Test.stopTest();
        }
    }

    /** 事前失敗に共通する未更新と公開情報の契約を確認
     * @param request 一項目の変更要求
     * @param scenario 模擬応答の失敗段階
     */
    private static void assertPrecheckFailure(String request, String scenario) {
        SaveMock mock = new SaveMock('Account', new Set<String>{ 'Active__c' }, scenario);
        Test.setMock(HttpCalloutMock.class, mock);
        List<Object> results = ObjectExplorerController.saveClassifyData('Account', request);
        Map<String, Object> result = (Map<String, Object>)results[0];
        Assert.areEqual(false, result.get('success'), '事前確認の失敗を保存成功にしない');
        Assert.areEqual(0, mock.writes, '定義を確認できなければ更新しない');
        Assert.isFalse(JSON.serialize(result).contains('PRIVATE_RESPONSE'), '通信の内部本文を公開しない');
    }

    /**
     * 画面と同じ四属性の変更要求
     * @param names 更新対象の項目名
     * @param requestedMode 分類要求の変更状態
     * @return 画面契約のJSON
     */
    public static String changes(List<String> names, ChangeMode requestedMode) {
        List<Object> result = new List<Object>();
        Map<String, Map<String, Object>> rows = new ObjectExplorerApiProtocol.RecordReader().createFieldRows(
            new ObjectExplorerSelector().selectFieldsByNames('Account', new Set<String>(names)));
        for (String name : names) {
            Map<String, Object> row = rows.get(name);
            List<String> compliance = new List<String>(new Set<String>(((String)row.get('ComplianceGroup') ?? '').split(';')));
            compliance.sort();
            Map<String, Object> original = new Map<String, Object>{
                'complianceGroup' => String.join(compliance, ';'),
                'securityClassification' => row.get('SecurityClassification') ?? '',
                'businessStatus' => row.get('BusinessStatus') ?? '',
                'ownerId' => row.get('BusinessOwnerId') ?? ''
            };
            Map<String, Object> draft = original.clone();
            if (requestedMode == ChangeMode.CHANGE_STATUS) {
                draft.put('businessStatus', alternateStatus((String) original.get('businessStatus')));
            }
            result.add(new Map<String, Object>{ 'apiName' => name, 'original' => original, 'draft' => draft });
        }
        return JSON.serialize(result);
    }

    /** 現在値と異なる利用状況を要求と模擬応答で共用
     * @param currentStatus 元の利用状況
     * @return 変更後の利用状況
     */
    private static String alternateStatus(String currentStatus) {
        return currentStatus == 'Active' ? 'Hidden' : 'Active';
    }

    /** 永続データを変更せず取得・更新・再取得を再現 */
    public class SaveMock implements HttpCalloutMock {
        private String objectName;
        private String scenario;
        private Map<String, String> durableIds = new Map<String, String>();
        private Map<String, Map<String, Object>> originalRows;
        public Integer reads = 0;
        public Integer writes = 0;
        public Integer definitionReads = 0;

        /**
         * 更新対象の実在する定義と模擬応答を対応付け
         * @param objectName テスト対象のオブジェクト
         * @param names 更新対象の項目名
         * @param scenario 再現する保存結果
         */
        public SaveMock(String objectName, Set<String> names, String scenario) {
            this.objectName = objectName;
            this.scenario = scenario;
            List<FieldDefinition> definitions = new ObjectExplorerSelector().selectFieldsByNames(objectName, names);
            originalRows = new ObjectExplorerApiProtocol.RecordReader().createFieldRows(definitions);
            for (FieldDefinition field : definitions) {
                durableIds.put(field.QualifiedApiName, field.DurableId);
            }
            Assert.areEqual(names, durableIds.keySet(), 'テスト対象の項目定義が存在');
        }

        /**
         * 要求先に対応するモック応答を返す
         * @param request 検証対象のHTTP要求
         * @return 模擬応答
         */
        public HttpResponse respond(HttpRequest request) {
            Assert.isTrue(
                request.getEndpoint().startsWith('callout:InternalSalesforceApi/'),
                '指定ログイン情報の固定名を使用'
            );
            HttpResponse response = new HttpResponse();
            response.setStatusCode(200);
            String endpoint = request.getEndpoint();
            if (scenario == 'connectionError') {
                throw new CalloutException('通信を再現');
            }
            if (endpoint.endsWith('query/?q=SELECT+Id+FROM+Organization')) {
                response.setBody(
                    JSON.serialize(
                        new Map<String, Object>{
                            'records' => new List<Object>{
                                new Map<String, Object>{ 'Id' => UserInfo.getOrganizationId() }
                            }
                        }
                    )
                );
            } else if (endpoint.contains('/services/Soap/')) {
                respondSoap(request, response);

            } else {
                respondClassify(endpoint, response);
            }
            return response;
        }

        /**
         * 標準項目の送信と個別拒否を再現
         * @param request 検証対象の要求
         * @param response 返却する模擬応答
         */
        private void respondSoap(HttpRequest request, HttpResponse response) {
            if (request.getBody().contains('readMetadata')) {
                respondCustom(request, response);
                return;
            }
            writes++;
            if (new Set<String>{ 'soapError', 'customError' }.contains(scenario)) {
                throw new CalloutException('SOAP通信を再現');
            }
            String results = '';
            Dom.Document document = new Dom.Document();
            document.load(request.getBody());
            List<Dom.XmlNode> fields = document.getRootElement().getChildElement('Body', 'http://schemas.xmlsoap.org/soap/envelope/').getChildElement('updateMetadata', 'http://soap.sforce.com/2006/04/metadata').getChildElements();
            for (Dom.XmlNode field : fields) {
                String name = field.getChildElement('fullName', 'http://soap.sforce.com/2006/04/metadata').getText().substringAfter('.');
                Assert.isTrue(durableIds.containsKey(name), '要求した標準項目だけを一括更新');
                assertCustomDefinition(field, name);
                Boolean success = !new Set<String>{'rejectPhone:Phone','rejectCustom:Active__c'}.contains(scenario + ':' + name);
                results +=
                    '<result><fullName>' +
                    objectName +
                    '.' +
                    name +
                    '</fullName><success>' +
                    String.valueOf(success) +
                    '</success>' +
                    (success ? '' : '<errors><statusCode>INVALID_FIELD</statusCode></errors>') +
                    '</result>';
            }
            response.setBody(
                '<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><updateMetadataResponse xmlns="http://soap.sforce.com/2006/04/metadata">' +
                    results +
                    '</updateMetadataResponse></env:Body></env:Envelope>'
            );
        }

        /** カスタム項目の分類以外の定義も更新要求へ保持
         * @param field 送信する一項目のXML
         * @param name 項目API名
         */
        private void assertCustomDefinition(Dom.XmlNode field, String name) {
            if (name.endsWith('__c')) {
                Assert.areEqual('維持する定義', field.getChildElement('label', 'http://soap.sforce.com/2006/04/metadata').getText(), 'カスタム定義のラベルを保持');
                Assert.areEqual(changedStatus(name), field.getChildElement('businessStatus', 'http://soap.sforce.com/2006/04/metadata').getText(), 'カスタム分類を変更');
            }
        }

        /**
         * カスタム定義の保持と同じIDへの更新を確認
         * @param request 検証対象の要求
         * @param response 返却する模擬応答
         */
        private void respondCustom(HttpRequest request, HttpResponse response) {
            definitionReads++;
            if (scenario == 'definitionError') {
                response.setStatusCode(500);
                response.setBody('PRIVATE_RESPONSE');
                return;
            }
            String ns = 'http://soap.sforce.com/2006/04/metadata';
            Dom.Document document = new Dom.Document(); document.load(request.getBody());
            List<Dom.XmlNode> names = document.getRootElement().getChildElement('Body', 'http://schemas.xmlsoap.org/soap/envelope/').getChildElement('readMetadata', ns).getChildElements();
            Assert.areEqual('CustomField', names.remove(0).getText(), '読取対象の型を固定');
            String records = '';
            for (Dom.XmlNode node : names) {
                Assert.areEqual('fullNames', node.getName(), '完全名だけを列挙');
                String fullName = node.getText();
                records = createCustomRecord(fullName) + records;
            }
            response.setBody('<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><readMetadataResponse xmlns="http://soap.sforce.com/2006/04/metadata"><result>' + records + '</result></readMetadataResponse></env:Body></env:Envelope>');
        }

        /**
         * 一項目の模擬定義を完全名で対応付け
         * @param fullName 取得対象の完全名
         * @return 分類とラベルを含む模擬XML
         */
        private String createCustomRecord(String fullName) {
            String name = fullName.substringAfter('.');
            Assert.isTrue(durableIds.containsKey(name), '可視な同じ項目の定義を取得');
            Map<String, Object> metadata = customMetadata(name);
            String values = '';
            for (String key : metadata.keySet()) { values += '<' + key + '>' + String.valueOf(metadata.get(key) ?? '').escapeXml() + '</' + key + '>'; }
            return '<records><fullName>' + fullName + '</fullName>' + values + '<type>Text</type></records>';
        }

        /**
         * 現在値と異なる許可済み利用状況を選択
         * @param name 対象項目
         * @return 変更後の利用状況
         */
        private String changedStatus(String name) {
            return alternateStatus((String) originalRows.get(name).get('BusinessStatus'));
        }

        /**
         * ネイティブ分類と一致するカスタム定義を生成
         * @param name 対象項目
         * @return 分類以外の属性も含む模擬定義
         */
        private Map<String, Object> customMetadata(String name) {
            Map<String, Object> row = originalRows.get(name);
            String ownerId = (String)row.get('BusinessOwnerId') ?? '';
            Set<Id> ids = new Set<Id>{(Id)row.get('BusinessOwnerId')};
            ids.remove(null);
            ObjectExplorerSelector selector = new ObjectExplorerSelector();
            List<SObject> owners = new List<SObject>();
            owners.addAll(selector.selectOwnerUsers(ids));
            owners.addAll(selector.selectOwnerGroups(ids));
            Map<String, Object> metadata = new ObjectExplorerOwnerService().createMetadataDraft(new Map<String, Object>{
                'complianceGroup' => row.get('ComplianceGroup') ?? '', 'securityClassification' => row.get('SecurityClassification') ?? '',
                'businessStatus' => row.get('BusinessStatus') ?? '', 'ownerId' => ownerId
            }, owners);
            if (scenario == 'definitionConflict') { metadata.put('businessStatus', changedStatus(name)); }
            metadata.put('label', '維持する定義');
            return metadata;
        }

        /**
         * 保存後の分類を要求した名前だけで返す
         * @param endpoint 要求先のAPIパス
         * @param response 返却する模擬応答
         */
        private void respondClassify(String endpoint, HttpResponse response) {
            Assert.isTrue(endpoint.contains('/query/?q='), '分類クエリのみを許可');
            reads++;
            String query = EncodingUtil.urlDecode(endpoint.substringAfter('?q='), 'UTF-8');
            List<Object> rows = new List<Object>();
            for (String name : durableIds.keySet()) {
                if (!query.contains('\'' + name + '\'')) {
                    continue;
                }
                Map<String, Object> original = originalRows.get(name);
                String status = writes > 0 && scenario != 'stale' ? changedStatus(name) : (String)original.get('BusinessStatus');
                rows.add(
                    new Map<String, Object>{
                        'DurableId' => durableIds.get(name),
                        'QualifiedApiName' => name,
                        'ComplianceGroup' => original.get('ComplianceGroup'),
                        'SecurityClassification' => original.get('SecurityClassification'),
                        'BusinessStatus' => status,
                        'BusinessOwnerId' => original.get('BusinessOwnerId')
                    }
                );
            }
            response.setBody(JSON.serialize(new Map<String, Object>{ 'done' => true, 'records' => rows }));
        }
    }

    /** 日時取得の接続と応答異常を再現するHTTPモック */
    public class AuditFailureMock implements HttpCalloutMock {
        private String mode;

        /**
         * 再現する失敗段階を指定
         * @param mode 接続またはAPI応答の異常種別
         */
        public AuditFailureMock(String mode) {
            this.mode = mode;
        }

        /**
         * 認証先確認と項目照会を区別して模擬応答を生成
         * @param request 日時取得のHTTP要求
         * @return 指定した段階のHTTP応答
         */
        public HttpResponse respond(HttpRequest request) {
            Boolean organization = request.getEndpoint().endsWith('query/?q=SELECT+Id+FROM+Organization');
            if (this.mode == 'connection') { throw new CalloutException('PRIVATE_RESPONSE'); }
            HttpResponse response = new HttpResponse();
            response.setStatusCode(200);
            if (this.mode == 'unauthorized' || (!organization && this.mode == 'toolingForbidden')) {
                response.setStatusCode(this.mode == 'unauthorized' ? 401 : 403);
                response.setBody('PRIVATE_RESPONSE');
            } else if (organization) {
                response.setBody(JSON.serialize(new Map<String, Object>{'done' => true, 'records' => new List<Object>{new Map<String, Object>{'Id' => this.mode == 'wrongOrg' ? '' : UserInfo.getOrganizationId()}}}));
            } else {
                response.setBody(this.auditBody());
            }
            return response;
        }

        /**
         * 日時照会の不完全応答と不正形式を分離
         * @return 指定した異常応答の本文
         */
        private String auditBody() {
            return this.mode == 'incomplete' ? '{"done":false,"records":[]}' : 'PRIVATE_RESPONSE';
        }

    }

    /** カスタム項目の日時だけを返すHTTPモック */
    public class AuditMock implements HttpCalloutMock {
        private List<FieldDefinition> definitions = new ObjectExplorerSelector()
            .selectFieldAuditTargets('Account');
        public Integer calls = 0;

        /**
         * 対象IDの日時と人物を返す
         * @param request 日時取得のHTTP要求
         * @return 完了したクエリ応答
         */
        public HttpResponse respond(HttpRequest request) {
            Assert.isTrue(
                request.getEndpoint().startsWith('callout:InternalSalesforceApi/'),
                '指定ログイン情報の固定名を使用'
            );
            calls++;
            List<Object> rows = new List<Object>();
            if (request.getEndpoint().endsWith('query/?q=SELECT+Id+FROM+Organization')) {
                rows.add(new Map<String, Object>{ 'Id' => UserInfo.getOrganizationId() });
            } else {
                String query = EncodingUtil.urlDecode(request.getEndpoint().substringAfter('?q='), 'UTF-8');
                for (FieldDefinition field : definitions) {
                    String idValue = field.DurableId.substringAfter('.');
                    if (!idValue.startsWith('00N') || !query.contains(idValue)) {
                        continue;
                    }
                    rows.add(
                        new Map<String, Object>{
                            'Id' => idValue,
                            'CreatedDate' => '2026-01-01T00:00:00.000Z',
                            'LastModifiedDate' => '2026-01-02T00:00:00.000Z',
                            'CreatedById' => String.valueOf(testUser.Id),
                            'LastModifiedById' => String.valueOf(testUser.Id)
                        }
                    );
                }
                Assert.isFalse(rows.isEmpty(), '要求したカスタム項目が存在');
            }
            HttpResponse response = new HttpResponse();
            response.setStatusCode(200);
            response.setBody(JSON.serialize(new Map<String, Object>{ 'done' => true, 'records' => rows }));
            return response;
        }
    }
}
