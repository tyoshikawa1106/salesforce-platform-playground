/** メタデータ通信と応答の識別子照合 */
@IsTest
private with sharing class MetadataApiIntegrationClientTest {
    private static MetadataApiIntegrationClient client = new MetadataApiIntegrationClient();
    private static MetadataApiProtocol.RecordReader reader = new MetadataApiProtocol.RecordReader();

    private static User testUser = new User(Id = UserInfo.getUserId());

    /** 固定診断コードと内部情報の非公開を確認 */
    @IsTest
    static void reportsAuthenticationCode() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new DiagnosticMock(401, '[{"errorCode":"INVALID_SESSION_ID","message":"PRIVATE_VALUE"}]', null));
            try {
                client.request('example', 'GET', null);
                Assert.fail('失敗を成功として返さない');
            } catch (MetadataApiIntegrationClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('[OE-AUTH-401]'), '失敗の種類を固定コードで識別');
                Assert.isFalse(error.getMessage().contains('PRIVATE'), '例外本文と未知コードを公開しない');
                Assert.isTrue(error.getMessage().contains('Salesforceコード：INVALID_SESSION_ID'), '許可済みコードを表示');
            }
            Test.stopTest();
        }
    }

    /** 固定診断コードと内部情報の非公開を確認 */
    @IsTest
    static void hidesUnknownApiCode() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new DiagnosticMock(403, '[{"errorCode":"PRIVATE_CODE","message":"PRIVATE_VALUE"}]', null));
            try {
                client.request('example', 'GET', null);
                Assert.fail('失敗を成功として返さない');
            } catch (MetadataApiIntegrationClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('[OE-API-HTTP-403]'), '失敗の種類を固定コードで識別');
                Assert.isFalse(error.getMessage().contains('PRIVATE'), '例外本文と未知コードを公開しない');

            }
            Test.stopTest();
        }
    }

    /** 固定診断コードと内部情報の非公開を確認 */
    @IsTest
    static void preservesHttpStatusForMalformedBody() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new DiagnosticMock(503, 'PRIVATE_VALUE', null));
            try {
                client.request('example', 'GET', null);
                Assert.fail('失敗を成功として返さない');
            } catch (MetadataApiIntegrationClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('[OE-API-HTTP-503]'), '失敗の種類を固定コードで識別');
                Assert.isFalse(error.getMessage().contains('PRIVATE'), '例外本文と未知コードを公開しない');

            }
            Test.stopTest();
        }
    }

    /** 固定診断コードと内部情報の非公開を確認 */
    @IsTest
    static void reportsResponseTimeout() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new DiagnosticMock(200, '', 'Read timed out PRIVATE_VALUE'));
            try {
                client.request('example', 'GET', null);
                Assert.fail('失敗を成功として返さない');
            } catch (MetadataApiIntegrationClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('[OE-API-TIMEOUT]'), '失敗の種類を固定コードで識別');
                Assert.isFalse(error.getMessage().contains('PRIVATE'), '例外本文と未知コードを公開しない');

            }
            Test.stopTest();
        }
    }

    /** 固定診断コードと内部情報の非公開を確認 */
    @IsTest
    static void reportsUnclassifiedConnectionFailure() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new DiagnosticMock(200, '', 'PRIVATE_VALUE'));
            try {
                client.request('example', 'GET', null);
                Assert.fail('失敗を成功として返さない');
            } catch (MetadataApiIntegrationClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('[OE-API-CONNECTION]'), '失敗の種類を固定コードで識別');
                Assert.isFalse(error.getMessage().contains('PRIVATE'), '例外本文と未知コードを公開しない');

            }
            Test.stopTest();
        }
    }

    /** 固定診断コードと内部情報の非公開を確認 */
    @IsTest
    static void reportsMalformedSuccessfulResponse() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new DiagnosticMock(200, 'PRIVATE_VALUE', null));
            try {
                client.request('example', 'GET', null);
                Assert.fail('失敗を成功として返さない');
            } catch (MetadataApiIntegrationClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('[OE-API-RESPONSE]'), '失敗の種類を固定コードで識別');
                Assert.isFalse(error.getMessage().contains('PRIVATE'), '例外本文と未知コードを公開しない');

            }
            Test.stopTest();
        }
    }

    /** 更新要求のHTTP拒否を結果不明と区別 */
    @IsTest
    static void distinguishesRejectedPatch() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new DiagnosticMock(403, 'PRIVATE_VALUE', null));
            try {
                client.request('example', 'PATCH', '{}');
                Assert.fail('更新拒否を成功にしない');
            } catch (MetadataApiIntegrationClient.RejectedUpdateException error) {
                Assert.isTrue(error.getMessage().contains('HTTP 403'), '更新の明示拒否として通知');
                Assert.isFalse(error.getMessage().contains('PRIVATE'), 'API本文を公開しない');
            }
            Test.stopTest();
        }
    }

    /** サーバー失敗を未保存と断定しない */
    @IsTest
    static void keepsPatchServerFailureUnconfirmed() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new DiagnosticMock(503, 'PRIVATE_VALUE', null));
            try {
                client.request('example', 'PATCH', '{}');
                Assert.fail('更新結果を正常と扱わない');
            } catch (MetadataApiIntegrationClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('HTTP 503'), '明示拒否と異なる連携エラーで返す');
                Assert.isFalse(error.getMessage().contains('PRIVATE'), 'API本文を公開しない');
            }
            Test.stopTest();
        }
    }

    /** SOAPの認証拒否をXML解析エラーと混同しない */
    @IsTest
    static void distinguishesSoapAuthenticationRejection() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new DiagnosticMock(401, 'PRIVATE_VALUE', null));
            try {
                client.updateStandardFields(new Map<String, Map<String, Object>>{'Account.Name' => new Map<String, Object>{'fullName' => 'Account.Name', 'businessStatus' => 'Active'}});
                Assert.fail('認証拒否を成功にしない');
            } catch (MetadataApiIntegrationClient.RejectedUpdateException error) {
                Assert.isTrue(error.getMessage().contains('[OE-AUTH-401]'), 'API認証拒否として通知');
                Assert.isFalse(error.getMessage().contains('PRIVATE'), '本文を公開しない');
            }
            Test.stopTest();
        }
    }

    /** 組織照合と分類クエリの接続 */
    @IsTest
    static void readsOrganizationAndClassifyData() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new ResponseMock('organization'));
            client.verifyOrganization();
            Test.setMock(HttpCalloutMock.class, new ResponseMock('classify'));
            Map<String, Map<String, Object>> rows = client.readClassifyData('Account', new Set<String>{ 'Name' });
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
                client.readCustomField('Account.00N000000000001').get('FullName'),
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
            client.updateCustomField('Account.00N000000000001', metadata);
            Assert.isTrue(metadata.containsKey('unused'), '入力の定義自体は変更しない');
            Test.stopTest();
        }
    }
    /** JSON内の入力を認証差し込み式にしない */
    @IsTest
    static void escapesJsonMergeExpression() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new ResponseMock('expression'));
            Assert.isTrue(
                client.request('example', 'PATCH', '{"value":"{!input}"}').isEmpty(),
                '本文なし成功を空応答として扱う'
            );
            Test.stopTest();
        }
    }
    /** SOAP生成・HTTP・結果検証の接続 */
    @IsTest
    static void updatesStandardMetadata() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new ResponseMock('soap'));
            Map<String, String> result = client.updateStandardFields(
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
    /** 通信失敗時に応答本文を公開しない */
    @IsTest
    static void sanitizesHttpAndConnectionErrors() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new ResponseMock('httpError'));
            try {
                client.request('example', 'GET', null);
                Assert.fail('HTTP拒否を成功にしない');
            } catch (MetadataApiIntegrationClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('HTTP 403'), '状態コードを伝える');
                Assert.isFalse(error.getMessage().contains('private-response'), 'API本文を公開しない');
            }
            Test.setMock(HttpCalloutMock.class, new ResponseMock('connectionError'));
            try {
                client.request('example', 'GET', null);
                Assert.fail('接続失敗を成功にしない');
            } catch (MetadataApiIntegrationClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('API接続'), '接続失敗を伝える');
                Assert.isFalse(error.getMessage().contains('private-response'), '内部例外を公開しない');
            }
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
                    client.readCustomField(target);
                    Assert.fail('カスタム項目IDだけを許可');
                } catch (MetadataApiIntegrationClient.IntegrationException error) {
                    Assert.isTrue(error.getMessage().contains('不正'), '識別子不正を通知');
                }
            }
            try {
                client.readClassifyData('Account', new Set<String>());
                Assert.fail('空件数を拒否');
            } catch (MetadataApiIntegrationClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('1～10'), '件数制限を通知');
            }
            try {
                client.readClassifyData('Account', new Set<String>{ 'Name/invalid' });
                Assert.fail('識別子以外を拒否');
            } catch (MetadataApiIntegrationClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('不正'), 'クエリ断片を拒否');
            }
            Assert.areEqual(0, Limits.getCallouts(), '不正な要求は送信しない');
            Test.stopTest();
        }
    }
    /** 未完了・属性欠落・重複した分類応答を拒否 */
    @IsTest
    static void rejectsIncompleteAndMismatchedRows() {
        System.runAs(testUser) {
            Test.startTest();
            Map<String, Object> row = classifyRow();
            Map<String, Object> response = new Map<String, Object>{
                'done' => false,
                'records' => new List<Object>{ row }
            };
            try {
                reader.readClassifyData(response, new Set<String>{ 'Name' });
                Assert.fail('未完了を拒否');
            } catch (MetadataApiIntegrationClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('不足'), '未完了を通知');
            }
            response.put('done', true);
            row.remove('BusinessOwnerId');
            try {
                reader.readClassifyData(response, new Set<String>{ 'Name' });
                Assert.fail('属性欠落を拒否');
            } catch (MetadataApiIntegrationClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('属性'), '欠落を通知');
            }
            response.put('records', new List<Object>{ classifyRow(), classifyRow() });
            try {
                reader.readClassifyData(response, new Set<String>{ 'Name', 'Phone' });
                Assert.fail('重複行を拒否');
            } catch (MetadataApiIntegrationClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('一致'), '重複を通知');
            }
            Test.stopTest();
        }
    }
    /** 接続先の件数と識別子を検証 */
    @IsTest
    static void rejectsWrongOrganization() {
        System.runAs(testUser) {
            Test.startTest();
            try {
                reader.requireQueryRecord(new Map<String, Object>{ 'records' => new List<Object>() }, 'Id', 'expected');
                Assert.fail('対象なしを拒否');
            } catch (MetadataApiIntegrationClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('一意'), '件数不正を通知');
            }
            try {
                reader.requireQueryRecord(
                    new Map<String, Object>{
                        'records' => new List<Object>{ new Map<String, Object>{ 'Id' => 'other' } }
                    },
                    'Id',
                    'expected'
                );
                Assert.fail('別対象を拒否');
            } catch (MetadataApiIntegrationClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('一致'), '対象不一致を通知');
            }
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

    /** 認証・HTTP・形式不正を再現する診断用モック */
    private class DiagnosticMock implements HttpCalloutMock {
        private Integer status;
        private String body;
        private String exceptionMessage;

        /**
         * 模擬応答と接続失敗の種類を指定
         * @param status HTTP番号
         * @param body 模擬API本文
         * @param exceptionMessage 接続例外、nullは通常の応答
         */
        DiagnosticMock(Integer status, String body, String exceptionMessage) {
            this.status = status;
            this.body = body;
            this.exceptionMessage = exceptionMessage;
        }

        /**
         * 実通信をせず指定した応答だけを返す
         * @param request 模擬するHTTP要求
         * @return 指定したHTTP応答
         */
        public HttpResponse respond(HttpRequest request) {
            if (this.exceptionMessage != null) { throw new CalloutException(this.exceptionMessage); }
            HttpResponse response = new HttpResponse();
            response.setStatusCode(this.status);
            response.setBody(this.body);
            return response;
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
                request.getEndpoint().startsWith('callout:MetadataApiIntegration/'),
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