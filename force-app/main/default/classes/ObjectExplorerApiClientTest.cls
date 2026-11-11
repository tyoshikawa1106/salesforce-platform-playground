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
            Assert.isTrue(request.getEndpoint().startsWith('callout:InternalSalesforceApi/services/data/v68.0/tooling/query/'), 'Tooling照会先を固定');
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
                fields.updateFields(new Map<String, Map<String, Object>>{'Account.Name' => new Map<String, Object>{'fullName' => 'Account.Name', 'businessStatus' => 'Active'}}, new Set<String>());
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
                fields.readCustomFields(new Set<String>{'Account.Example__c'}).get('Account.Example__c').get('FullName'),
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
            fields.updateFields(new Map<String, Map<String, Object>>{'Account.Example__c' => metadata}, new Set<String>{'Account.Example__c'});
            Assert.isTrue(metadata.containsKey('unused'), '入力の定義自体は変更しない');
            Integer sent = Limits.getCallouts();
            try {
                fields.updateFields(new Map<String, Map<String, Object>>{'Account.Example__c' => metadata}, new Set<String>{'Account.Example__c'});
                Assert.fail('取得済みの古い定義で再送信しない');
            } catch (SalesforceApiClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('一致'), '新たな読取なしの更新を拒否');
            }
            Assert.areEqual(sent, Limits.getCallouts(), '二度目の更新要求を送信しない');
            Test.stopTest();
        }
    }

    /** カスタム10項目の取得・更新は各1回で個別拒否を保持 */
    @IsTest
    static void batchesTenCustomFieldsWithPartialFailure() {
        System.runAs(testUser) {
            Set<String> names = new Set<String>();
            for (Integer i = 0; i < 10; i++) { names.add('Account.Field' + i + '__c'); }
            Test.setMock(HttpCalloutMock.class, new BulkMock(names));
            Test.startTest();
            Map<String, Map<String, Object>> records = fields.readCustomFields(names);
            Map<String, Map<String, Object>> updates = new Map<String, Map<String, Object>>();
            for (String name : names) {
                Map<String, Object> metadata = (Map<String, Object>)records.get(name).get('Metadata');
                metadata.put('businessStatus', 'Active');
                updates.put(name, metadata);
            }
            Map<String, String> results = fields.updateFields(updates, names);
            Assert.areEqual(2, Limits.getCallouts(), '10項目でも定義取得1回と更新1回だけ通信');
            Test.stopTest();
            Assert.areEqual(names, results.keySet(), '全項目を同じ完全名へ対応付け');
            Assert.isTrue(results.get('Account.Field0__c').contains('INVALID_FIELD'), '拒否した項目のAPIコードを保持');
            Assert.areEqual('', results.get('Account.Field9__c'), '他項目の成功を保持');
        }
    }

    /** 一括SOAP要求の件数・完全名・定義保持を検証 */
    private class BulkMock implements HttpCalloutMock {
        private Set<String> names;
        /**
         * 読取・更新を許可する同じ対象を固定
         * @param names 最大10項目の完全名
         */
        BulkMock(Set<String> names) { this.names = names; }
        /**
         * 一括読取と部分拒否を伴う更新を再現
         * @param request 一括SOAP要求
         * @return 順序を反転した模擬応答
         */
        public HttpResponse respond(HttpRequest request) {
            String ns = 'http://soap.sforce.com/2006/04/metadata';
            String records = '';
            HttpResponse response = new HttpResponse(); response.setStatusCode(200);
            if (request.getBody().contains('readMetadata')) {
                Assert.areEqual(names.size(), request.getBody().countMatches('<met:fullNames>'), '全対象を一回で取得');
                for (String name : names) { records = '<records><fullName>' + name + '</fullName><label>' + name + '</label><type>Text</type></records>' + records; }
                response.setBody('<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><readMetadataResponse xmlns="' + ns + '"><result>' + records + '</result></readMetadataResponse></env:Body></env:Envelope>');
                return response;
            }
            Dom.Document doc = new Dom.Document(); doc.load(request.getBody());
            Assert.areEqual('false', doc.getRootElement().getChildElement('Header', 'http://schemas.xmlsoap.org/soap/envelope/').getChildElement('AllOrNoneHeader', ns).getChildElement('allOrNone', ns).getText(), '個別拒否で他項目をロールバックしない');
            List<Dom.XmlNode> fields = doc.getRootElement().getChildElement('Body', 'http://schemas.xmlsoap.org/soap/envelope/').getChildElement('updateMetadata', ns).getChildElements();
            Assert.areEqual(names.size(), fields.size(), '全対象を一回で更新');
            Set<String> actual = new Set<String>();
            for (Dom.XmlNode field : fields) {
                String name = field.getChildElement('fullName', ns).getText(); actual.add(name);
                Assert.areEqual(name, field.getChildElement('label', ns).getText(), '他項目の定義を取り違えない');
                Assert.areEqual('Active', field.getChildElement('businessStatus', ns).getText(), '分類だけを変更');
                Boolean success = name != 'Account.Field0__c';
                records = '<result><fullName>' + name + '</fullName><success>' + success + '</success>' + (success ? '' : '<errors><statusCode>INVALID_FIELD</statusCode></errors>') + '</result>' + records;
            }
            Assert.areEqual(names, actual, '同じ完全名だけを更新');
            response.setBody('<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><updateMetadataResponse xmlns="' + ns + '">' + records + '</updateMetadataResponse></env:Body></env:Envelope>');
            return response;
        }
    }

    /** SOAP生成・HTTP・結果検証の接続 */
    @IsTest
    static void updatesStandardMetadata() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new ResponseMock('soap'));
            Map<String, String> result = fields.updateFields(
                new Map<String, Map<String, Object>>{
                    'Account.Name' => new Map<String, Object>{
                        'fullName' => 'Account.Name',
                        'businessStatus' => 'Active'
                    }
                }
            , new Set<String>());
            Assert.areEqual('', result.get('Account.Name'), '同じ完全名の成功を返す');
            Test.stopTest();
        }
    }

    /** 不正対象を通信前に拒否 */
    @IsTest
    static void rejectsUnsafeTargetsBeforeCallout() {
        System.runAs(testUser) {
            Test.startTest();
            for (String target : new List<String>{ 'Account/Name', 'Account.Name/invalid', 'Account.Name/' }) {
                try {
                    fields.readCustomFields(new Set<String>{target});
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
                request.getEndpoint().startsWith('callout:InternalSalesforceApi/'),
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
                Assert.areEqual('POST', request.getMethod(), 'SOAPで定義を読み取る');
                Assert.isTrue(request.getBody().contains('readMetadata'), 'Metadata読取を指定');
                response.setBody('<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><readMetadataResponse xmlns="http://soap.sforce.com/2006/04/metadata"><result><records><fullName>Account.Example__c</fullName><description>保持する説明</description><label>維持</label><type>Text</type></records></result></readMetadataResponse></env:Body></env:Envelope>');
            }
        }

        /**
         * 更新要求と失敗応答を確認
         * @param request 検証対象の要求
         * @param response 返却する模擬応答
         */
        private void respondWrite(HttpRequest request, HttpResponse response) {
            if (scenario == 'customWrite') {
                Assert.areEqual('POST', request.getMethod(), 'Metadata APIで更新');
                Dom.Document document = new Dom.Document(); document.load(request.getBody());
                String ns = 'http://soap.sforce.com/2006/04/metadata';
                Dom.XmlNode field = document.getRootElement().getChildElement('Body', 'http://schemas.xmlsoap.org/soap/envelope/').getChildElement('updateMetadata', ns).getChildElements()[0];
                Assert.areEqual('維持', field.getChildElement('label', ns).getText(), '取得済みラベルを保持');
                Assert.areEqual('保持する説明', field.getChildElement('description', ns).getText(), '取得済み説明を保持');
                Assert.isNull(field.getChildElement('nested', ns), '入力へ紛れた分類以外の属性を送信しない');
                Assert.isTrue(String.isBlank(field.getChildElement('businessStatus', ns).getText()), '分類解除を送信');
                response.setBody('<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><updateMetadataResponse xmlns="http://soap.sforce.com/2006/04/metadata"><result><fullName>Account.Example__c</fullName><success>true</success></result></updateMetadataResponse></env:Body></env:Envelope>');
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