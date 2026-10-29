/** ObjectExplorerControllerの公開操作と外部境界テスト */
@IsTest
private with sharing class ObjectExplorerControllerTest {
    /** 分類要求の変更状態 */
    public enum ChangeMode {
        UNCHANGED,
        CHANGE_STATUS
    }

    private static User testUser = new User(Id = UserInfo.getUserId());

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
            Assert.areEqual(2, mock.reads, '保存前後で最新値を照合');
            Test.stopTest();
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
            SaveMock mock = new SaveMock('Account', new Set<String>{ 'Name' }, 'conflict');
            Test.setMock(HttpCalloutMock.class, mock);
            List<Object> results = ObjectExplorerController.saveClassifyData(
                'Account',
                changes(new List<String>{ 'Name' }, ChangeMode.CHANGE_STATUS)
            );
            Assert.areEqual(false, ((Map<String, Object>) results[0]).get('success'), '編集基準不一致は失敗');
            Assert.areEqual(0, mock.writes, '競合した項目を送信しない');
            Test.setMock(HttpCalloutMock.class, new SaveMock('Account', new Set<String>{ 'Name' }, 'connectionError'));
            results = ObjectExplorerController.saveClassifyData(
                'Account',
                changes(new List<String>{ 'Name' }, ChangeMode.CHANGE_STATUS)
            );
            Assert.areEqual(false, ((Map<String, Object>) results[0]).get('success'), '組織確認失敗を結果へ返す');
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
            Assert.areEqual(1, mock.reads, '失敗確定後は再取得しない');
            Test.stopTest();
        }
    }

    /**
     * 画面と同じ四属性の変更要求
     * @param names 更新対象の項目名
     * @param requestedMode 分類要求の変更状態
     * @return 画面契約のJSON
     */
    public static String changes(List<String> names, ChangeMode requestedMode) {
        List<Object> result = new List<Object>();
        for (String name : names) {
            Map<String, Object> original = new Map<String, Object>{
                'complianceGroup' => '',
                'securityClassification' => '',
                'businessStatus' => '',
                'ownerId' => ''
            };
            Map<String, Object> draft = original.clone();
            if (requestedMode == ChangeMode.CHANGE_STATUS) {
                draft.put('businessStatus', 'Active');
            }
            result.add(new Map<String, Object>{ 'apiName' => name, 'original' => original, 'draft' => draft });
        }
        return JSON.serialize(result);
    }

    /** 永続データを変更せず取得・更新・再取得を再現 */
    public class SaveMock implements HttpCalloutMock {
        private String objectName;
        private String scenario;
        private Map<String, String> durableIds = new Map<String, String>();
        public Integer reads = 0;
        public Integer writes = 0;

        /**
         * 更新対象の実在する定義と模擬応答を対応付け
         * @param objectName テスト対象のオブジェクト
         * @param names 更新対象の項目名
         * @param scenario 再現する保存結果
         */
        public SaveMock(String objectName, Set<String> names, String scenario) {
            this.objectName = objectName;
            this.scenario = scenario;
            for (FieldDefinition field : new ObjectExplorerSelector().selectFieldsByNames(objectName, names)) {
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
                request.getEndpoint().startsWith('callout:MetadataApiIntegration/'),
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
                respondSoap(response);
            } else if (endpoint.contains('tooling/sobjects/CustomField/')) {
                respondCustom(request, response);
            } else {
                respondClassify(endpoint, response);
            }
            return response;
        }

        /**
         * 標準項目の送信と個別拒否を再現
         * @param response 返却する模擬応答
         */
        private void respondSoap(HttpResponse response) {
            writes++;
            if (scenario == 'soapError') {
                throw new CalloutException('SOAP通信を再現');
            }
            String results = '';
            for (String name : durableIds.keySet()) {
                Boolean success = !(scenario == 'rejectPhone' && name == 'Phone');
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
            String endpoint = request.getEndpoint();
            String name = new List<String>(durableIds.keySet())[0];
            Assert.isTrue(endpoint.endsWith(durableIds.get(name).substringAfter('.')), '取得した同じ項目IDだけへ通信');
            if (request.getMethod() == 'GET') {
                response.setBody(
                    JSON.serialize(
                        new Map<String, Object>{
                            'FullName' => objectName +
                            '.' +
                            name,
                            'Metadata' => new Map<String, Object>{ 'label' => '維持する定義', 'businessStatus' => null }
                        }
                    )
                );
            } else {
                writes++;
                if (scenario == 'customError') {
                    throw new CalloutException('カスタム更新通信を再現');
                }
                Map<String, Object> payload = (Map<String, Object>) JSON.deserializeUntyped(request.getBody());
                Map<String, Object> metadata = (Map<String, Object>) payload.get('Metadata');
                Assert.areEqual('維持する定義', metadata.get('label'), '分類以外の定義を保持');
                Assert.areEqual('Active', metadata.get('businessStatus'), '変更した分類を反映');
                response.setStatusCode(204);
            }
        }

        /**
         * 保存前後の分類を要求した名前だけで返す
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
                String status = scenario == 'conflict' || (writes > 0 && scenario != 'stale') ? 'Active' : null;
                rows.add(
                    new Map<String, Object>{
                        'DurableId' => durableIds.get(name),
                        'QualifiedApiName' => name,
                        'ComplianceGroup' => null,
                        'SecurityClassification' => null,
                        'BusinessStatus' => status,
                        'BusinessOwnerId' => null
                    }
                );
            }
            response.setBody(JSON.serialize(new Map<String, Object>{ 'done' => true, 'records' => rows }));
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
                request.getEndpoint().startsWith('callout:MetadataApiIntegration/'),
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
