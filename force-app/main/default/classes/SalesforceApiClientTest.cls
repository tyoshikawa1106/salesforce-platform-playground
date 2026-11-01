/** メタデータ通信と応答の識別子照合 */
@IsTest
private with sharing class SalesforceApiClientTest {
    private static SalesforceApiClient client = new SalesforceApiClient();

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
            } catch (SalesforceApiClient.IntegrationException error) {
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
            } catch (SalesforceApiClient.IntegrationException error) {
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
            } catch (SalesforceApiClient.IntegrationException error) {
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
            } catch (SalesforceApiClient.IntegrationException error) {
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
            } catch (SalesforceApiClient.IntegrationException error) {
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
            } catch (SalesforceApiClient.IntegrationException error) {
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
            } catch (SalesforceApiClient.RejectedUpdateException error) {
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
            } catch (SalesforceApiClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('HTTP 503'), '明示拒否と異なる連携エラーで返す');
                Assert.isFalse(error.getMessage().contains('PRIVATE'), 'API本文を公開しない');
            }
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

    /** 通信失敗時に応答本文を公開しない */
    @IsTest
    static void sanitizesHttpAndConnectionErrors() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new ResponseMock('httpError'));
            try {
                client.request('example', 'GET', null);
                Assert.fail('HTTP拒否を成功にしない');
            } catch (SalesforceApiClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('HTTP 403'), '状態コードを伝える');
                Assert.isFalse(error.getMessage().contains('private-response'), 'API本文を公開しない');
            }
            Test.setMock(HttpCalloutMock.class, new ResponseMock('connectionError'));
            try {
                client.request('example', 'GET', null);
                Assert.fail('接続失敗を成功にしない');
            } catch (SalesforceApiClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('API接続'), '接続失敗を伝える');
                Assert.isFalse(error.getMessage().contains('private-response'), '内部例外を公開しない');
            }
            Test.stopTest();
        }
    }

    /** 任意URLや未対応操作を通信前に拒否 */
    @IsTest
    static void rejectsUnsupportedRequests() {
        System.runAs(testUser) {
            Test.startTest();
            for (String path : new List<String>{'https://example.invalid', '/query/', '../query/'}) {
                try {
                    client.request(path, 'GET', null);
                    Assert.fail('固定接続先以外を拒否');
                } catch (SalesforceApiClient.IntegrationException error) {
                    Assert.isTrue(error.getMessage().contains('要求形式'), '通信前に拒否');
                }
            }
            try {
                client.request('query/', 'DELETE', null);
                Assert.fail('削除操作を許可しない');
            } catch (SalesforceApiClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('要求形式'), '未対応操作を拒否');
            }
            Assert.areEqual(0, Limits.getCallouts(), '不正要求では通信しない');
            Test.stopTest();
        }
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

    /** 同一組織確認の成功・不一致・不正応答を区別 */
    @IsTest
    static void verifiesCurrentOrganization() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new DiagnosticMock(200, JSON.serialize(new Map<String,Object>{'records'=>new List<Object>{new Map<String,Object>{'Id'=>UserInfo.getOrganizationId()}}}), null));
            client.verifyOrganization();
            for (String body : new List<String>{'{"records":[{"Id":"other"}]}', '{"records":[]}'}) {
                Test.setMock(HttpCalloutMock.class, new DiagnosticMock(200, body, null));
                try {
                    client.verifyOrganization();
                    Assert.fail('未確認の接続先を拒否');
                } catch (SalesforceApiClient.IntegrationException error) {
                    Assert.isTrue(error.getMessage().startsWith('[OE-ORG-'), '不一致と応答不備を診断');
                }
            }
            Assert.areEqual(3, Limits.getCallouts(), '確認要求をそれぞれ送信');
            Test.stopTest();
        }
    }

    /** 共通通信の本文保護と接続失敗を確認するモック */
    private class ResponseMock implements HttpCalloutMock {
        private String scenario;
        /**
         * 応答種別を指定
         * @param scenario 本文保護または通信失敗
         */
        ResponseMock(String scenario) { this.scenario = scenario; }
        /**
         * 認証値を含まない模擬応答を返却
         * @param request 共通通信の要求
         * @return 本文なし成功またはHTTP拒否
         */
        public HttpResponse respond(HttpRequest request) {
            Assert.isTrue(request.getEndpoint().startsWith('callout:SalesforceApiIntegration/'), '新指定ログイン情報だけを使用');
            if (this.scenario == 'connectionError') { throw new CalloutException('private-response'); }
            HttpResponse response = new HttpResponse();
            response.setStatusCode(this.scenario == 'httpError' ? 403 : 204);
            if (this.scenario == 'expression') {
                Assert.isFalse(request.getBody().contains('{!'), '入力の数式差し込みを無効化');
                Assert.areEqual('{!input}', ((Map<String,Object>)JSON.deserializeUntyped(request.getBody())).get('value'), '元の文字列は維持');
            }
            response.setBody(this.scenario == 'httpError' ? 'private-response' : '');
            return response;
        }
    }
}