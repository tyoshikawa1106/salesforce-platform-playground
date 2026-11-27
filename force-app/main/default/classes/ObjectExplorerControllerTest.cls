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

    /** 保存後のHTTP失敗でも確定済みの項目別拒否を維持 */
    @IsTest
    static void preservesRejectedFieldWhenVerificationRequestFails() {
        System.runAs(testUser) {
            Test.startTest();
            String message = assertVerificationFailure(503, 'PRIVATE_RESPONSE');
            Assert.isTrue(message.contains('保存結果の再取得・照合：'), '再取得段階の通信失敗を案内');
            Assert.isTrue(message.contains('[OE-API-HTTP-503]'), '安全なHTTPステータスを案内');
            Test.stopTest();
        }
    }

    /** 保存後の不正な応答型を安全な確認不能として通知 */
    @IsTest
    static void hidesMalformedVerificationResponse() {
        System.runAs(testUser) {
            Test.startTest();
            String message = assertVerificationFailure(200, '{"done":true,"records":"PRIVATE_RESPONSE"}');
            Assert.isTrue(message.contains('保存結果の再取得・照合：分類の取得結果に不足があります。'), '不正な応答型を参照前に拒否し再取得段階の失敗を案内');
            Test.stopTest();
        }
    }

    /** 再取得失敗と更新時の確定済み拒否を区別
     * @param statusCode 再取得APIの応答ステータス
     * @param body 再取得APIの応答本文
     * @return 再取得に失敗した項目の公開メッセージ
     */
    private static String assertVerificationFailure(Integer statusCode, String body) {
        SaveMock writes = new SaveMock('Account', new Set<String>{'Name', 'Phone'}, 'rejectPhone');
        HttpResponse failedRead = new HttpResponse();
        failedRead.setStatusCode(statusCode);
        failedRead.setBody(body);
        writes.verificationResponse = failedRead;
        Test.setMock(HttpCalloutMock.class, writes);
        List<Object> results = ObjectExplorerController.saveClassifyData(
            'Account', changes(new List<String>{'Name', 'Phone'}, ChangeMode.CHANGE_STATUS)
        );
        Assert.areEqual(2, results.size(), '元の二項目の結果を保持');
        Map<String, Object> pending = (Map<String, Object>) results[0];
        Map<String, Object> rejected = (Map<String, Object>) results[1];
        Assert.areEqual('Name', pending.get('apiName'), '確認不能の項目を要求順で対応');
        Assert.areEqual(false, pending.get('success'), '更新受付だけで成功と扱わない');
        String message = (String) pending.get('message');
        Assert.isTrue(message.contains('[OE-SAVE-UNCONFIRMED]'), '更新送信後の確認不能として通知');
        Assert.areEqual('Phone', rejected.get('apiName'), '拒否された項目を保持');
        Assert.areEqual(false, rejected.get('success'), '確定済みの拒否を成功へ変更しない');
        Assert.isTrue(((String) rejected.get('message')).contains('[OE-SAVE-REJECTED]'), '確定済み拒否を再取得失敗で上書きしない');
        Assert.isFalse(JSON.serialize(results).contains('PRIVATE_RESPONSE'), '外部応答の内部情報を公開しない');
        Assert.areEqual(1, writes.writes, '更新は一括で一回だけ送信');
        Assert.areEqual(1, writes.reads, '保存後に一回だけ再取得');
        Assert.areEqual(0, Limits.getDmlStatements(), '保存データなしで応答処理を検証');
        return message;
    }

    /** 組織に作成せず、確認済みの監査対象とTooling応答に同じIDを使用する。
     * @return 監査対象のIDと正式名
     */
    private static Map<Id, String> auditTargets() {
        return new Map<Id, String>{Id.valueOf('00N' + '1'.leftPad(12, '0')) => 'Example1__c'};
    }

    /** カスタム項目日時取得と不要な通信の省略 */
    @IsTest
    static void returnsCustomFieldAudit() {
        System.runAs(testUser) {
            Test.startTest();
            Id fieldId = new List<Id>(auditTargets().keySet())[0];
            Map<String, Object> row = new Map<String, Object>{
                'Id' => fieldId, 'CreatedDate' => '2026-01-01T00:00:00.000Z', 'LastModifiedDate' => '2026-01-02T00:00:00.000Z',
                'CreatedById' => testUser.Id, 'LastModifiedById' => testUser.Id
            };
            AuditMock mock = new AuditMock();
            mock.responses.add(httpResponse(200, JSON.serialize(new Map<String, Object>{'done' => true, 'records' => new List<Object>{row}})));
            Test.setMock(HttpCalloutMock.class, mock);
            Map<String, Object> result = (Map<String, Object>) JSON.deserializeUntyped(
                JSON.serialize(new ObjectExplorerController().readFieldAudit(auditTargets()))
            );
            Assert.isTrue(result.containsKey('Example1__c'), 'カスタム項目の日時を返す');
            Map<String, Object> field = (Map<String, Object>) result.get('Example1__c');
            Assert.areEqual('2026-01-01T00:00:00.000Z', field.get('createdDate'), '作成日時を同じ項目へ対応');
            Assert.areEqual(String.valueOf(testUser.Id), field.get('createdById'), '可視な人物を同じIDで対応');
            Assert.areEqual(2, mock.requests.size(), '接続先確認と日時の一括取得');
            Assert.isTrue(EncodingUtil.urlDecode(mock.requests[1].getEndpoint(), 'UTF-8').contains(String.valueOf(fieldId)), '可視な項目のIDで日時を照会');
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

    /** 監査APIの各失敗段階を呼び出し元に示し、外部応答の本文は公開しない。 */
    @IsTest
    static void reportsAuditFailuresByStage() {
        System.runAs(testUser) {
            Test.startTest();
            // 接続先組織の確認とTooling照会のどちらで失敗したかを公開メッセージで区別する
            assertAuditFailure(new List<HttpResponse>{null}, 'API接続・接続先組織の確認：[OE-API-CONNECTION]');
            assertAuditFailure(new List<HttpResponse>{httpResponse(401, 'PRIVATE_RESPONSE')}, 'API接続・接続先組織の確認：[OE-AUTH-401]');
            assertAuditFailure(new List<HttpResponse>{httpResponse(200, '{"done":true,"records":[{"Id":""}]}')}, 'API接続・接続先組織の確認：[OE-ORG-MISMATCH]');
            assertAuditFailure(new List<HttpResponse>{organizationResponse(), httpResponse(403, 'PRIVATE_RESPONSE')}, '項目の作成・更新情報のAPI取得：[OE-API-HTTP-403]');
            assertAuditFailure(new List<HttpResponse>{organizationResponse(), httpResponse(200, '{"done":false,"records":[]}')}, '項目の作成・更新情報のAPI取得：項目の作成・更新情報をすべて取得できませんでした。');
            assertAuditFailure(new List<HttpResponse>{organizationResponse(), httpResponse(200, 'PRIVATE_RESPONSE')}, '項目の作成・更新情報のAPI取得：[OE-API-RESPONSE]');
            Assert.areEqual(9, Limits.getCallouts(), '接続先確認に成功した3件だけTooling APIに到達');
            Test.stopTest();
        }
    }

    /**
     * 日時取得の公開例外だけを取り出して比較可能にする
     * @param responses 接続先確認からの応答順
     * @param expected 失敗段階と公開可能な理由
     */
    private static void assertAuditFailure(List<HttpResponse> responses, String expected) {
        AuditMock mock = new AuditMock();
        mock.responses = responses;
        Test.setMock(HttpCalloutMock.class, mock);
        try {
            new ObjectExplorerController().readFieldAudit(auditTargets());
            Assert.fail('失敗を正常応答にしない');
        } catch (AuraHandledException error) {
            Assert.isTrue(error.getMessage().contains(expected), '段階と理由を表示：' + expected);
            Assert.isFalse(error.getMessage().contains('PRIVATE_RESPONSE'), '内部情報を公開しない');
        }
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

    /** 標準・カスタム混在でカスタム項目の拒否だけを失敗として保持 */
    @IsTest
    static void preservesMixedPartialSuccess() {
        System.runAs(testUser) {
            List<String> names = new List<String>{'Name', 'Example1__c', 'Example2__c'};
            SaveMock mock = new SaveMock('Account', new Set<String>(names), 'rejectCustom');
            Test.setMock(HttpCalloutMock.class, mock);
            Test.startTest();
            List<Object> results = mock.saveDefinedFields(changes(names, ChangeMode.CHANGE_STATUS));
            Test.stopTest();
            Assert.areEqual(names.size(), results.size(), '標準項目とカスタム2項目の結果をすべて返す');
            for (Integer i = 0; i < names.size(); i++) {
                Map<String, Object> row = (Map<String, Object>)results[i];
                Assert.areEqual(names[i], row.get('apiName'), '入力と同じ位置に結果を返す');
                Assert.areEqual(i != 1, row.get('success'), '拒否された項目だけが失敗');
            }
            Assert.areEqual(1, mock.reads, '成功候補をまとめて再取得');
            Assert.isTrue(mock.updateBody.contains('維持する定義'), '混在更新でもカスタム項目の定義を保持');
            Assert.areEqual(1, mock.definitionReads, 'カスタム定義を一回だけ取得');
            Assert.areEqual(1, mock.writes, '混在しても一回だけ更新');
        }
    }

    /** 変更なしのカスタム項目では定義取得も更新もしない */
    @IsTest
    static void skipsUnchangedCustomDefinitions() {
        System.runAs(testUser) {
            List<String> names = new List<String>{'Example1__c'};
            SaveMock mock = new SaveMock('Account', new Set<String>(names), 'success');
            Test.setMock(HttpCalloutMock.class, mock);
            Test.startTest();
            List<Object> results = mock.saveDefinedFields(changes(names, ChangeMode.UNCHANGED));
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
            SaveMock failed = new SaveMock('Account', new Set<String>{ 'Name' }, 'connectionError');
            Test.setMock(HttpCalloutMock.class, failed);
            results = ObjectExplorerController.saveClassifyData(
                'Account',
                changes(new List<String>{ 'Name' }, ChangeMode.CHANGE_STATUS)
            );
            Assert.areEqual(false, ((Map<String, Object>) results[0]).get('success'), '更新時の通信失敗を結果へ返す');
            Assert.isTrue(String.valueOf(((Map<String, Object>) results[0]).get('message')).contains('更新送信後の確認'), '項目別の失敗にも段階を返す');
            Assert.areEqual(0, failed.reads, '更新要求の通信失敗後に再取得しない');
            Test.stopTest();
        }
    }

    /** 接続・定義取得・事前照合の失敗では更新要求を送らない */
    @IsTest
    static void rejectsFailuresBeforeMetadataUpdate() {
        System.runAs(testUser) {
            String request = changes(new List<String>{ 'Example1__c' }, ChangeMode.CHANGE_STATUS);
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
        SaveMock mock = new SaveMock('Account', new Set<String>{ 'Example1__c' }, scenario);
        Test.setMock(HttpCalloutMock.class, mock);
        List<Object> results = mock.saveDefinedFields(request);
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
            testDefinitions('Account', new Set<String>(names)));
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

    /**
     * 標準項目には組織の現在値を使用し、テスト用カスタム項目はメモリ上で定義する。
     * @param objectName 対象オブジェクト
     * @param names テストで使用する項目名
     * @return 模擬要求と応答に共通の項目定義
     */
    private static List<FieldDefinition> testDefinitions(String objectName, Set<String> names) {
        Set<String> standardNames = new Set<String>{'Name', 'Phone'};
        standardNames.retainAll(names);
        Set<String> simulatedNames = new Set<String>(names);
        simulatedNames.removeAll(standardNames);
        List<Object> custom = new List<Object>();
        for (String name : simulatedNames) {
            String suffix = name.substringBetween('Example', '__c');
            custom.add(new Map<String, Object>{'QualifiedApiName' => name,
                'DurableId' => objectName + '.00N' + suffix.leftPad(12, '0')});
        }
        List<FieldDefinition> definitions = new ObjectExplorerSelector().selectFieldsByNames(objectName, standardNames);
        definitions.addAll((List<FieldDefinition>)JSON.deserialize(JSON.serialize(custom), List<FieldDefinition>.class));
        return definitions;
    }

    /** 永続データを変更せず取得・更新・再取得を再現 */
    public class SaveMock implements HttpCalloutMock {
        private String objectName;
        private String scenario;
        private List<FieldDefinition> definitions;
        private Map<String, Map<String, Object>> originalRows;
        public Integer reads = 0;
        public String updateBody;
        public Integer writes = 0;
        public Integer definitionReads = 0;
        public HttpResponse verificationResponse;

        /**
         * 更新対象の標準・カスタム定義と模擬応答を対応付け
         * @param objectName テスト対象のオブジェクト
         * @param names 更新対象の項目名
         * @param scenario 再現する保存結果
         */
        public SaveMock(String objectName, Set<String> names, String scenario) {
            this.objectName = objectName;
            this.scenario = scenario;
            definitions = testDefinitions(objectName, names);
            originalRows = new ObjectExplorerApiProtocol.RecordReader().createFieldRows(definitions);
            Assert.areEqual(names, originalRows.keySet(), '全項目の定義を用意');
        }

        /**
         * Describe後の対象に模擬定義を渡し、保存・再照合を実際の処理で確認する。
         * @param request 更新内容
         * @return 項目別の保存結果
         */
        public List<Object> saveDefinedFields(String request) {
            List<Object> changes = new ObjectExplorerAccessPolicy.RequestValidator().parseChanges(request);
            List<ObjectExplorerClassifyService.FieldContext> contexts = new List<ObjectExplorerClassifyService.FieldContext>();
            for (Object item : changes) {
                Map<String, Object> change = (Map<String, Object>)item;
                ObjectExplorerClassifyService.FieldContext context = new ObjectExplorerClassifyService.FieldContext();
                context.objectName = objectName;
                context.fieldName = (String)change.get('apiName');
                context.customField = context.fieldName.endsWith('__c');
                context.change = change;
                contexts.add(context);
            }
            return new ObjectExplorerController().saveDefinedFields(changes, contexts, definitions);
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
            if (endpoint.contains('/services/Soap/')) {
                respondSoap(request, response);
                return response;
            }
            respondClassify(endpoint, response);
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
            updateBody = request.getBody();
            String results = '';
            Dom.Document document = new Dom.Document();
            document.load(request.getBody());
            List<Dom.XmlNode> fields = document.getRootElement().getChildElement('Body', 'http://schemas.xmlsoap.org/soap/envelope/').getChildElement('updateMetadata', 'http://soap.sforce.com/2006/04/metadata').getChildElements();
            for (Dom.XmlNode field : fields) {
                String name = field.getChildElement('fullName', 'http://soap.sforce.com/2006/04/metadata').getText().substringAfter('.');
                Assert.isTrue(originalRows.containsKey(name), '要求した標準項目だけを一括更新');
                Boolean success = !new Set<String>{'rejectPhone:Phone','rejectCustom:Example1__c'}.contains(scenario + ':' + name);
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
            Assert.isTrue(originalRows.containsKey(name), '可視な同じ項目の定義を取得');
            String status = scenario == 'definitionConflict' ? '<businessStatus>Active</businessStatus>' : '';
            return '<records><fullName>' + fullName + '</fullName><label>維持する定義</label>' + status + '<type>Text</type></records>';
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
         * 保存後の分類を要求した名前だけで返す
         * @param endpoint 要求先のAPIパス
         * @param response 返却する模擬応答
         */
        private void respondClassify(String endpoint, HttpResponse response) {
            Assert.isTrue(endpoint.contains('/query/?q='), '分類クエリのみを許可');
            reads++;
            if (verificationResponse != null) {
                response.setStatusCode(verificationResponse.getStatusCode());
                response.setBody(verificationResponse.getBody());
                return;
            }
            String query = EncodingUtil.urlDecode(endpoint.substringAfter('?q='), 'UTF-8');
            List<Object> rows = new List<Object>();
            Matcher names = Pattern.compile('\'([A-Za-z0-9_]+)\'').matcher(query.substringAfter('QualifiedApiName IN ('));
            Boolean reflectWrite = writes > 0 && scenario != 'stale';
            while (names.find()) {
                String name = names.group(1);
                Map<String, Object> row = originalRows.get(name).clone();
                if (reflectWrite) { row.put('BusinessStatus', changedStatus(name)); }
                rows.add(row);
            }
            response.setBody(JSON.serialize(new Map<String, Object>{ 'done' => true, 'records' => rows }));
        }
    }

    /** HTTPモックへ返す応答を組み立てる。
     * @param status HTTPステータス
     * @param body 応答本文
     * @return 模擬HTTP応答
     */
    private static HttpResponse httpResponse(Integer status, String body) {
        HttpResponse response = new HttpResponse();
        response.setStatusCode(status);
        response.setBody(body);
        return response;
    }

    /** 接続先が実行組織と一致する応答を返す。
     * @return 組織確認用のREST応答
     */
    private static HttpResponse organizationResponse() {
        return httpResponse(200, JSON.serialize(new Map<String, Object>{
            'done' => true, 'records' => new List<Object>{new Map<String, Object>{'Id' => UserInfo.getOrganizationId()}}
        }));
    }

    /** 監査APIの要求順を記録し、各ケースで指定した応答を順番に返す。 */
    private class AuditMock implements HttpCalloutMock {
        public List<HttpResponse> responses = new List<HttpResponse>{organizationResponse()};
        public List<HttpRequest> requests = new List<HttpRequest>();

        /**
         * 各要求に対して準備済みの応答を消費する。
         * @param request 実際に送信された監査または認証要求
         * @return 指定順のAPI応答
         */
        public HttpResponse respond(HttpRequest request) {
            requests.add(request);
            HttpResponse response = responses.remove(0);
            if (response == null) { throw new CalloutException('PRIVATE_RESPONSE'); }
            return response;
        }
    }

    /** 保存済み状態と実接続の結果から公開認証状態を決定 */
    @IsTest
    static void verifiesAuthenticationStates() {
        System.runAs(testUser) {
            CredentialMock mock = new CredentialMock();
            SalesforceApiClient.credentialAccess = mock;
            Test.setMock(HttpCalloutMock.class, new AuditMock());
            Test.startTest();
            Map<String, Object> result = ObjectExplorerController.getApiAuthentication();
            Assert.areEqual(new Map<String, Object>{ 'status' => 'AUTHENTICATED', 'message' => '' }, result, '同一組織の認証済み状態を返す');
            Assert.areEqual(1, Limits.getCallouts(), '認証済みでも接続先を確認');
            mock.status = ConnectApi.CredentialAuthenticationStatus.NotConfigured;
            result = ObjectExplorerController.getApiAuthentication();
            Assert.areEqual(new Map<String, Object>{ 'status' => 'REQUIRED', 'message' => 'Salesforce APIを使用します。認証ボタンをクリックしてください。' }, result, '未設定は認証開始を案内');
            Assert.areEqual(1, Limits.getCallouts(), '未設定では接続確認を追加しない');
            mock.status = ConnectApi.CredentialAuthenticationStatus.Configured;
            AuditMock denied = new AuditMock();
            denied.responses = new List<HttpResponse>{httpResponse(401, 'PRIVATE_RESPONSE')};
            Test.setMock(HttpCalloutMock.class, denied);
            result = ObjectExplorerController.getApiAuthentication();
            Assert.areEqual('REQUIRED', result.get('status'), '保存済みでも実接続の拒否を優先して再認証へ変換');
            Assert.isFalse(JSON.serialize(result).contains('PRIVATE'), '通信の内部情報を公開しない');
            Test.stopTest();
        }
    }

    /** 認証URLを検証して本人用資格情報の解除を委譲 */
    @IsTest
    static void validatesUrlAndRevokesCredential() {
        System.runAs(testUser) {
            CredentialMock mock = new CredentialMock();
            SalesforceApiClient.credentialAccess = mock;
            Test.startTest();
            Assert.areEqual(mock.authenticationUrl, ObjectExplorerController.getApiAuthenticationUrl(), '同じ組織の標準URLを返す');
            Assert.areEqual(1, mock.urlRequests, 'URLを一度だけ取得');
            mock.authenticationUrl = 'https://example.invalid/auth';
            try {
                ObjectExplorerController.getApiAuthenticationUrl();
                Assert.fail('別ホストの認証URLを拒否');
            } catch (AuraHandledException e) {
                Assert.areEqual('[OE-AUTH-URL] API認証の開始URLを取得できませんでした。管理者に確認してください。', e.getMessage(), 'URLの値を公開しない');
            }
            Assert.areEqual(2, mock.urlRequests, '拒否したURLも標準APIから取得');
            ObjectExplorerController.revokeApiAuthentication();
            Assert.areEqual(1, mock.revocations, '解除を一度だけ委譲');
            Assert.areEqual(2, mock.urlRequests, '解除時に新しい認証を開始しない');
            Test.stopTest();
        }
    }

    /** 公開入口から実際の認証設定を変更しないための標準API境界 */
    private class CredentialMock extends SalesforceApiClient.CredentialAccess {
        private ConnectApi.CredentialAuthenticationStatus status = ConnectApi.CredentialAuthenticationStatus.Configured;
        private String authenticationUrl = Url.getOrgDomainUrl().toExternalForm() + '/auth';
        private Integer urlRequests = 0;
        private Integer revocations = 0;

        /** 指定した認証状態を取得
         * @return 標準認証状態
         */
        public override ConnectApi.CredentialAuthenticationStatus getStatus() {
            return status;
        }

        /** 指定した認証URLを取得
         * @return 模擬する認証URL
         */
        public override String getUrl() {
            urlRequests++;
            return authenticationUrl;
        }

        /** 実際の資格情報を変更せず解除要求を記録 */
        public override void revoke() {
            revocations++;
        }
    }

}