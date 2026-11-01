/** 項目分類APIの対象照合・保存と既存定義の保持 */
@IsTest
private with sharing class ObjectExplorerApiClientTest {
    private static User testUser = new User(Id = UserInfo.getUserId());
    private static ObjectExplorerApiClient fields = new ObjectExplorerApiClient();

    /** 項目監査の固定クエリと入力境界 */
    @IsTest
    static void readsFieldAudit() {
        System.runAs(testUser) {
            Test.startTest();
            for (Set<Id> ids : new List<Set<Id>>{new Set<Id>(), new Set<Id>{UserInfo.getOrganizationId()}}) {
                try {
                    fields.readFieldAudit(ids);
                    Assert.fail('不正な監査対象を拒否');
                } catch (SalesforceApiClient.IntegrationException error) {
                    Assert.isTrue(String.isNotBlank(error.getMessage()), '不正な対象の理由を返却');
                }
            }
            Assert.areEqual(0, Limits.getCallouts(), '不正な対象は送信しない');
            Test.setMock(HttpCalloutMock.class, new AuditMock());
            Map<String,Object> result = fields.readFieldAudit(new Set<Id>{(Id)('00N' + '000000000001')});
            Assert.areEqual(true, result.get('done'), '監査応答を処理側へ返却');
            Test.stopTest();
        }
    }

    /** 監査クエリの対象と取得属性を確認するモック */
    private class AuditMock implements HttpCalloutMock {
        /**
         * 固定のToolingクエリだけを受け付ける
         * @param request 監査要求
         * @return 完了済みの模擬応答
         */
        public HttpResponse respond(HttpRequest request) {
            Assert.isTrue(request.getEndpoint().startsWith('callout:SalesforceApiIntegration/services/data/v68.0/tooling/query/'), 'Tooling照会先を固定');
            String query = EncodingUtil.urlDecode(request.getEndpoint().substringAfter('?q='), 'UTF-8');
            Assert.isTrue(query.contains('FROM CustomField WHERE Id IN'), '監査対象を限定');
            Assert.isTrue(query.contains('CreatedById, LastModifiedDate, LastModifiedById'), '監査属性だけを取得');
            HttpResponse response = new HttpResponse();
            response.setStatusCode(200);
            response.setBody('{"done":true,"records":[]}');
            return response;
        }
    }

    /** SOAPの認証拒否をXML解析エラーと混同しない */
    @IsTest
    static void distinguishesSoapAuthenticationRejection() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new AuthenticationMock());
            try {
                fields.updateStandardFields(new Map<String, Map<String, Object>>{'Account.Name' => new Map<String, Object>{'fullName' => 'Account.Name', 'businessStatus' => 'Active'}});
                Assert.fail('認証拒否を成功にしない');
            } catch (SalesforceApiClient.RejectedUpdateException error) {
                Assert.isTrue(error.getMessage().contains('[OE-AUTH-401]'), 'API認証拒否として通知');
                Assert.isFalse(error.getMessage().contains('PRIVATE'), '本文を公開しない');
            }
            Test.stopTest();
        }
    }

    /** 組織照合と分類クエリの接続 */
    @IsTest
    static void readsClassifyData() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new ResponseMock('classify'));
            Map<String, Map<String, Object>> rows = fields.readClassifyData('Account', new Set<String>{ 'Name' });
            Assert.areEqual('Account.Name', rows.get('Name').get('DurableId'), '要求した定義を同じ名前へ返す');
            Test.stopTest();
        }
    }

    /** 分類解除と分類以外の定義の保持 */
    @IsTest
    static void readsAndUpdatesCustomMetadata() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new ResponseMock('customRead'));
            Assert.areEqual(
                'Account.Example__c',
                fields.readCustomField('Account.00N000000000001').get('FullName'),
                '完全名付き定義を取得'
            );
            Map<String, Object> metadata = new Map<String, Object>{
                'label' => '維持',
                'unused' => null,
                'nested' => new Map<String, Object>{ 'keep' => '値', 'empty' => null },
                'values' => new List<Object>{ new Map<String, Object>{ 'value' => 'x', 'empty' => null }, 'plain' },
                'businessStatus' => null
            };
            Test.setMock(HttpCalloutMock.class, new ResponseMock('customWrite'));
            fields.updateCustomField('Account.00N000000000001', metadata);
            Assert.isTrue(metadata.containsKey('unused'), '入力の定義自体は変更しない');
            Test.stopTest();
        }
    }

    /** SOAP生成・HTTP・結果検証の接続 */
    @IsTest
    static void updatesStandardMetadata() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new ResponseMock('soap'));
            Map<String, String> result = fields.updateStandardFields(
                new Map<String, Map<String, Object>>{
                    'Account.Name' => new Map<String, Object>{
                        'fullName' => 'Account.Name',
                        'businessStatus' => 'Active'
                    }
                }
            );
            Assert.areEqual('', result.get('Account.Name'), '同じ完全名の成功を返す');
            Test.stopTest();
        }
    }

    /** 不正対象を通信前に拒否 */
    @IsTest
    static void rejectsUnsafeTargetsBeforeCallout() {
        System.runAs(testUser) {
            Test.startTest();
            for (String target : new List<String>{ 'Account.Name', 'Account.001000000000001', 'Account.Name/' }) {
                try {
                    fields.readCustomField(target);
                    Assert.fail('カスタム項目IDだけを許可');
                } catch (SalesforceApiClient.IntegrationException error) {
                    Assert.isTrue(error.getMessage().contains('不正'), '識別子不正を通知');
                }
            }
            try {
                fields.readClassifyData('Account', new Set<String>());
                Assert.fail('空件数を拒否');
            } catch (SalesforceApiClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('1～10'), '件数制限を通知');
            }
            try {
                fields.readClassifyData('Account', new Set<String>{ 'Name/invalid' });
                Assert.fail('識別子以外を拒否');
            } catch (SalesforceApiClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('不正'), 'クエリ断片を拒否');
            }
            Assert.areEqual(0, Limits.getCallouts(), '不正な要求は送信しない');
            Test.stopTest();
        }
    }

    /**
     * 分類応答の必須属性を用意
     * @return 未設定の分類応答
     */
    private static Map<String, Object> classifyRow() {
        return new Map<String, Object>{
            'DurableId' => 'Account.Name',
            'QualifiedApiName' => 'Name',
            'ComplianceGroup' => null,
            'SecurityClassification' => null,
            'BusinessStatus' => null,
            'BusinessOwnerId' => null
        };
    }

    /** SOAP拒否の伝播だけを確認するモック */
    private class AuthenticationMock implements HttpCalloutMock {
        /**
         * 認証拒否を返却
         * @param request 標準分類のSOAP要求
         * @return HTTP 401
         */
        public HttpResponse respond(HttpRequest request) {
            HttpResponse result = new HttpResponse();
            result.setStatusCode(401);
            result.setBody('PRIVATE_VALUE');
            return result;
        }
    }

    /** 実通信せずHTTP契約を検証 */
    private class ResponseMock implements HttpCalloutMock {
        private String scenario;
        /**
         * 通信契約の検証ケースを選択
         * @param scenario 再現する応答種別
         */
        ResponseMock(String scenario) {
            this.scenario = scenario;
        }

        /**
         * HTTP契約を検証して模擬応答を返す
         * @param request 検証対象のHTTP要求
         * @return 模擬応答
         */
        public HttpResponse respond(HttpRequest request) {
            Assert.isTrue(
                request.getEndpoint().startsWith('callout:SalesforceApiIntegration/'),
                '指定ログイン情報の固定名を使用'
            );
            HttpResponse response = new HttpResponse();
            response.setStatusCode(200);
            if (new Set<String>{ 'organization', 'classify', 'customRead' }.contains(scenario)) {
                respondRead(request, response);
            } else {
                respondWrite(request, response);
            }
            return response;
        }

        /**
         * 読み取り要求の対象と応答を確認
         * @param request 検証対象の要求
         * @param response 返却する模擬応答
         */
        private void respondRead(HttpRequest request, HttpResponse response) {
            if (scenario == 'organization') {
                Assert.isTrue(
                    request.getEndpoint().endsWith('query/?q=SELECT+Id+FROM+Organization'),
                    '組織確認だけを問い合わせる'
                );
                response.setBody(
                    JSON.serialize(
                        new Map<String, Object>{
                            'records' => new List<Object>{
                                new Map<String, Object>{ 'Id' => UserInfo.getOrganizationId() }
                            }
                        }
                    )
                );
            } else if (scenario == 'classify') {
                String query = EncodingUtil.urlDecode(request.getEndpoint().substringAfter('?q='), 'UTF-8');
                Assert.isTrue(
                    query.contains('EntityDefinition.QualifiedApiName = \'Account\''),
                    '対象オブジェクトを限定'
                );
                Assert.isTrue(query.contains('QualifiedApiName IN (\'Name\')'), '対象項目を限定');
                response.setBody(
                    JSON.serialize(
                        new Map<String, Object>{ 'done' => true, 'records' => new List<Object>{ classifyRow() } }
                    )
                );
            } else if (scenario == 'customRead') {
                Assert.areEqual('GET', request.getMethod(), '定義の読み取り');
                Assert.isTrue(
                    request.getEndpoint().endsWith('tooling/sobjects/CustomField/00N000000000001'),
                    '検証済みIDの固定パス'
                );
                response.setBody('{"FullName":"Account.Example__c"}');
            }
        }

        /**
         * 更新要求と失敗応答を確認
         * @param request 検証対象の要求
         * @param response 返却する模擬応答
         */
        private void respondWrite(HttpRequest request, HttpResponse response) {
            if (scenario == 'customWrite') {
                Assert.areEqual('PATCH', request.getMethod(), '同じ定義を更新');
                Map<String, Object> payload = (Map<String, Object>) JSON.deserializeUntyped(request.getBody());
                Map<String, Object> metadata = (Map<String, Object>) payload.get('Metadata');
                Assert.areEqual('維持', metadata.get('label'), '既存ラベルを保持');
                Assert.isFalse(metadata.containsKey('unused'), '不要なnull複合属性を除く');
                Assert.areEqual(new Map<String, Object>{ 'keep' => '値' }, metadata.get('nested'), '入れ子の値を保持');
                Assert.areEqual(
                    new List<Object>{ new Map<String, Object>{ 'value' => 'x' }, 'plain' },
                    metadata.get('values'),
                    '配列内も値を保持'
                );
                Assert.isTrue(
                    metadata.keySet()
                        .containsAll(
                            new Set<String>{
                                'businessOwnerUser',
                                'businessOwnerGroup',
                                'businessStatus',
                                'complianceGroup',
                                'securityClassification'
                            }
                        ),
                    '分類解除のnullキーを保持'
                );
                response.setStatusCode(204);
            } else if (scenario == 'expression') {
                Assert.isFalse(request.getBody().contains('{!'), '入力内の差し込み式をエスケープ');
                Assert.areEqual(
                    new Map<String, Object>{ 'value' => '{!input}' },
                    JSON.deserializeUntyped(request.getBody()),
                    'JSON値としては保持'
                );
                response.setStatusCode(204);
            } else if (scenario == 'soap') {
                Assert.areEqual('POST', request.getMethod(), 'SOAPで送信');
                Assert.areEqual('updateMetadata', request.getHeader('SOAPAction'), '更新操作を指定');
                Assert.areEqual('text/xml; charset=UTF-8', request.getHeader('Content-Type'), 'XML本文');
                Assert.isTrue(
                    request.getBody().contains('<met:fullName>Account.Name</met:fullName>'),
                    '同じ項目を送信'
                );
                response.setBody(
                    '<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><updateMetadataResponse xmlns="http://soap.sforce.com/2006/04/metadata"><result><fullName>Account.Name</fullName><success>true</success></result></updateMetadataResponse></env:Body></env:Envelope>'
                );
            } else if (scenario == 'httpError') {
                response.setStatusCode(403);
                response.setBody('private-response');
            } else if (scenario == 'connectionError') {
                throw new CalloutException('private-response');
            } else {
                Assert.fail('未定義の通信を許可しない');
            }
        }
    }
}