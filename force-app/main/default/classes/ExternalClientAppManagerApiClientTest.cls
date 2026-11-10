/** 本人認証の検証と資格情報APIの通信境界 */
@IsTest
private with sharing class ExternalClientAppManagerApiClientTest {
    private static ExternalClientAppManagerApiClient client = new ExternalClientAppManagerApiClient();
    private static User testUser = new User(Id = UserInfo.getUserId());

    /** 専用接続でJSON要求を送信 */
    @IsTest
    static void sendsDedicatedCredentialRequest() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new ResponseMock(201, '{"stagedCredentials":[]}'));
            Map<String, Object> result = client.request(
                '/services/data/v68.0/apps/oauth/credentials/example/staged',
                'POST',
                '{}'
            );
            Test.stopTest();
            Assert.isTrue(result.containsKey('stagedCredentials'), 'JSON応答を返却');
        }
    }

    /** 本文のないDELETE成功を処理 */
    @IsTest
    static void acceptsEmptyDeleteResponse() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new ResponseMock(204, ''));
            Map<String, Object> result = client.request('/services/data/v68.0/example', 'DELETE', null);
            Test.stopTest();
            Assert.isTrue(result.isEmpty(), '空本文を空Mapとして返却');
        }
    }

    /** API拒否の自由文と秘密を例外へ含めない */
    @IsTest
    static void hidesRemoteFailureBody() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new ResponseMock(403, 'PRIVATE_SECRET'));
            try {
                client.request('/services/data/v68.0/example', 'GET', null);
                Assert.fail('API拒否を成功にしない');
            } catch (CalloutException e) {
                Assert.areEqual('HTTP 403', e.getMessage(), 'HTTP番号以外を返さない');
            }
            Test.stopTest();
        }
    }

    /** 同じ組織・本人の接続を許可 */
    @IsTest
    static void verifiesCurrentIdentity() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(
                HttpCalloutMock.class,
                new ResponseMock(
                    200,
                    JSON.serialize(
                        new Map<String, Object>{
                            'organization_id' => UserInfo.getOrganizationId(),
                            'user_id' => UserInfo.getUserId()
                        }
                    )
                )
            );
            client.verifyIdentity();
            Assert.areEqual(1, Limits.getCallouts(), '接続主体をAPIで確認');
            Test.stopTest();
        }
    }

    /** 別アカウントの認証を拒否 */
    @IsTest
    static void rejectsDifferentIdentity() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new ResponseMock(200, '{"organization_id":"other","user_id":"other"}'));
            try {
                client.verifyIdentity();
                Assert.fail('別の認証主体を許可しない');
            } catch (CalloutException e) {
                Assert.isTrue(e.getMessage().contains('一致しません'), '本人不一致を拒否');
            }
            Test.stopTest();
        }
    }

    /** 組織外のURLを拒否 */
    @IsTest
    static void rejectsExternalPath() {
        System.runAs(testUser) {
            Test.startTest();
            for (
                String path : new List<String>{
                    null,
                    'https://example.invalid',
                    '//example.invalid',
                    '/services/../outside',
                    '/services/:token',
                    '/services/example\n../outside',
                    '/services/example\n:token'
                }
            ) {
                try {
                    client.request(path, 'GET', null);
                    Assert.fail('組織外の接続先を許可しない');
                } catch (CalloutException e) {
                    Assert.isTrue(e.getMessage().contains('パス'), '不正パスを識別');
                }
            }
            Assert.areEqual(0, Limits.getCallouts(), '不正パスは送信前に拒否');
            Test.stopTest();
        }
    }

    /** 未対応操作を拒否 */
    @IsTest
    static void rejectsUnknownMethod() {
        System.runAs(testUser) {
            Test.startTest();
            try {
                client.request('/services/data/v68.0/example', 'PUT', null);
                Assert.fail('未対応操作を許可しない');
            } catch (CalloutException e) {
                Assert.isTrue(e.getMessage().contains('操作'), '未対応操作を識別');
            }
            Test.stopTest();
        }
    }

    /** 未設定だけを認証要求に分類 */
    @IsTest
    static void detectsMissingAuthentication() {
        System.runAs(testUser) {
            ExternalClientAppManagerApiClient.credentialAccess = new CredentialMock('missing');
            Test.startTest();
            Assert.areEqual('REQUIRED', client.getAuthenticationStatus(), '未設定は認証が必要');
            Test.stopTest();
        }
    }

    /** 不明な保存状態を認証要求と混同しない */
    @IsTest
    static void detectsUnknownAuthentication() {
        System.runAs(testUser) {
            ExternalClientAppManagerApiClient.credentialAccess = new CredentialMock('unknown');
            Test.startTest();
            Assert.areEqual('UNAVAILABLE', client.getAuthenticationStatus(), '不明は確認不能');
            Test.stopTest();
        }
    }

    /** 設定済みでも本人性を照合 */
    @IsTest
    static void validatesConfiguredAuthentication() {
        System.runAs(testUser) {
            ExternalClientAppManagerApiClient.credentialAccess = new CredentialMock('configured');
            Test.setMock(
                HttpCalloutMock.class,
                new ResponseMock(
                    200,
                    JSON.serialize(
                        new Map<String, Object>{
                            'organization_id' => UserInfo.getOrganizationId(),
                            'user_id' => UserInfo.getUserId()
                        }
                    )
                )
            );
            Test.startTest();
            Assert.areEqual('AUTHENTICATED', client.getAuthenticationStatus(), '接続の本人確認まで成功');
            Test.stopTest();
        }
    }

    /** 401だけを再認証として扱う */
    @IsTest
    static void mapsUnauthorizedAuthentication() {
        System.runAs(testUser) {
            ExternalClientAppManagerApiClient.credentialAccess = new CredentialMock('configured');
            Test.setMock(HttpCalloutMock.class, new ResponseMock(401, 'PRIVATE'));
            Test.startTest();
            Assert.areEqual('REQUIRED', client.getAuthenticationStatus(), '認証拒否は再認証');
            Test.stopTest();
        }
    }

    /** 403を再認証で解決すると案内しない */
    @IsTest
    static void mapsForbiddenAuthentication() {
        System.runAs(testUser) {
            ExternalClientAppManagerApiClient.credentialAccess = new CredentialMock('configured');
            Test.setMock(HttpCalloutMock.class, new ResponseMock(403, 'PRIVATE'));
            Test.startTest();
            Assert.areEqual('UNAVAILABLE', client.getAuthenticationStatus(), '権限不足は確認不能');
            Assert.isTrue(
                ExternalClientAppManagerApiClient.accessFailureMessage(new CalloutException('HTTP 403'))
                    .contains('コンシューマーの秘密へのアクセスを許可'),
                '設定名を案内'
            );
            Test.stopTest();
        }
    }

    /** 現在組織の標準認証URLだけを許可 */
    @IsTest
    static void preservesStandardAuthenticationUrl() {
        System.runAs(testUser) {
            ExternalClientAppManagerApiClient.credentialAccess = new CredentialMock('configured');
            Test.startTest();
            Assert.areEqual(
                Url.getOrgDomainUrl().toExternalForm() + '/auth',
                client.getAuthenticationUrl(),
                '標準URLを保持'
            );
            client.revokeAuthentication();
            Test.stopTest();
            Assert.areEqual(
                true,
                ((CredentialMock) ExternalClientAppManagerApiClient.credentialAccess).revoked,
                '本人の解除APIを呼ぶ'
            );
        }
    }

    /** 他ホストへの認証遷移を拒否 */
    @IsTest
    static void rejectsForeignAuthenticationUrl() {
        System.runAs(testUser) {
            ExternalClientAppManagerApiClient.credentialAccess = new CredentialMock('foreign');
            Test.startTest();
            try {
                client.getAuthenticationUrl();
                Assert.fail('外部URLを許可しない');
            } catch (CalloutException error) {
                Assert.isTrue(error.getMessage().contains('認証開始URL'), 'URLを含まない案内');
            }
            Test.stopTest();
        }
    }

    /** 通信の内部例外を画面へ公開しない */
    @IsTest
    static void keepsUnexpectedErrorsPrivate() {
        System.runAs(testUser) {
            Test.startTest();
            String message = ExternalClientAppManagerApiClient.accessFailureMessage(new CalloutException('PRIVATE'));
            Assert.isFalse(message.contains('PRIVATE'), '内部情報を含まない');
            Assert.isTrue(message.contains('管理用API認証'), '確認先を案内');
            Test.stopTest();
        }
    }

    /** 保存上ConfiguredでもUserInfoの失効応答から再認証へ戻す */
    @IsTest
    static void requiresAuthenticationForInvalidToken() {
        System.runAs(testUser) {
            ExternalClientAppManagerApiClient.credentialAccess = new CredentialMock('configured');
            Test.setMock(HttpCalloutMock.class, new ResponseMock(403, 'Bad_OAuth_Token'));
            Test.startTest();
            Assert.areEqual('REQUIRED', client.getAuthenticationStatus(), '失効した保存済み認証を再認証へ案内');
            Test.stopTest();
        }
    }

    /** UserInfoのトークン欠落応答を再認証へ案内 */
    @IsTest
    static void requiresAuthenticationForMissingToken() {
        System.runAs(testUser) {
            ExternalClientAppManagerApiClient.credentialAccess = new CredentialMock('configured');
            Test.setMock(HttpCalloutMock.class, new ResponseMock(403, 'Missing_OAuth_Token'));
            Test.startTest();
            Assert.areEqual('REQUIRED', client.getAuthenticationStatus(), '認証欠落を権限不足と混同しない');
            Test.stopTest();
        }
    }

    /** 接続組織の不一致は再認証と推測して通さない */
    @IsTest
    static void keepsWrongOrganizationUnavailable() {
        System.runAs(testUser) {
            ExternalClientAppManagerApiClient.credentialAccess = new CredentialMock('configured');
            Test.setMock(HttpCalloutMock.class, new ResponseMock(403, 'Wrong_Org'));
            Test.startTest();
            Assert.areEqual('UNAVAILABLE', client.getAuthenticationStatus(), '別組織の拒否を維持');
            Test.stopTest();
        }
    }

    /** 資格情報APIの403は同じ文字列でも認証判定へ流用しない */
    @IsTest
    static void limitsTokenClassificationToUserInfo() {
        System.runAs(testUser) {
            Test.setMock(HttpCalloutMock.class, new ResponseMock(403, 'Bad_OAuth_Token'));
            Test.startTest();
            try {
                client.readConsumers('0xI' + '0'.repeat(11) + '1');
                Assert.fail('資格情報参照の拒否を維持');
            } catch (CalloutException e) {
                Assert.areEqual('HTTP 403', e.getMessage(), 'UserInfo以外は通常のアクセス拒否');
            }
            Test.stopTest();
        }
    }

    /** 成功HTTPでも不正なJSONを空の成功として扱わない */
    @IsTest
    static void rejectsInvalidJsonResponses() {
        System.runAs(testUser) {
            Test.startTest();
            for (String body : new List<String>{ '{"PRIVATE":', '[]', 'null', '"PRIVATE"', '123', 'true' }) {
                Test.setMock(HttpCalloutMock.class, new ResponseMock(200, body));
                try {
                    client.request('/services/data/v68.0/example', 'GET', null);
                    Assert.fail('オブジェクト以外の応答を拒否');
                } catch (CalloutException error) {
                    Assert.areEqual('API応答の形式を確認できません。', error.getMessage(), '本文を含まない固定案内');
                }
            }
            Assert.areEqual(6, Limits.getCallouts(), '各応答を再送しない');
            Test.stopTest();
        }
    }

    /** 通信例外を固定案内へ変換し、再送しない */
    @IsTest
    static void hidesTransportExceptionWithoutRetry() {
        System.runAs(testUser) {
            Test.setMock(HttpCalloutMock.class, new TransportFailure());
            Test.startTest();
            try {
                client.request('/services/data/v68.0/example', 'POST', '{}');
                Assert.fail('通信例外を成功にしない');
            } catch (CalloutException error) {
                Assert.isFalse(
                    ExternalClientAppManagerApiClient.accessFailureMessage(error).contains('PRIVATE'),
                    '公開案内に内部例外を含めない'
                );
            }
            Assert.areEqual(1, Limits.getCallouts(), '変更要求を再送しない');
            Test.stopTest();
        }
    }

    /** 保存済み接続でも不正な本人応答は確認不能 */
    @IsTest
    static void keepsMalformedIdentityUnavailable() {
        System.runAs(testUser) {
            ExternalClientAppManagerApiClient.credentialAccess = new CredentialMock('configured');
            Test.setMock(HttpCalloutMock.class, new ResponseMock(200, 'null'));
            Test.startTest();
            Assert.areEqual('UNAVAILABLE', client.getAuthenticationStatus(), '形式不正を再認証と推測しない');
            Assert.areEqual(1, Limits.getCallouts(), '本人確認を再送しない');
            Test.stopTest();
        }
    }

    /** 本人情報が欠ける応答を認証済みとしない */
    @IsTest
    static void rejectsMissingIdentityFields() {
        System.runAs(testUser) {
            Test.setMock(HttpCalloutMock.class, new ResponseMock(200, '{}'));
            Test.startTest();
            try {
                client.verifyIdentity();
                Assert.fail('本人情報がなければ拒否');
            } catch (CalloutException error) {
                Assert.isTrue(error.getMessage().contains('一致しません'), '本人確認の失敗を通知');
            }
            Test.stopTest();
        }
    }

    /** 内部情報付きの通信例外を再現 */
    private class TransportFailure implements HttpCalloutMock {
        /** 実通信せず例外を返す
         * @param request 模擬要求
         * @return 常に通信例外
         */
        public HttpResponse respond(HttpRequest request) {
            throw new CalloutException('PRIVATE transport details');
        }
    }

    /** 標準認証APIだけを差し替えるモック */
    private class CredentialMock extends ExternalClientAppManagerApiClient.CredentialAccess {
        private String mode;
        private Boolean revoked = false;
        /** 認証状態を指定
         * @param mode 保存状態または外部URLシナリオ
         */
        private CredentialMock(String mode) {
            this.mode = mode;
        }
        /** 保存状態を固定
         * @return 標準APIの認証状態
         */
        public override ConnectApi.CredentialAuthenticationStatus getStatus() {
            if (mode == 'missing') {
                return ConnectApi.CredentialAuthenticationStatus.NotConfigured;
            }
            if (mode == 'unknown') {
                return ConnectApi.CredentialAuthenticationStatus.Unknown;
            }
            return ConnectApi.CredentialAuthenticationStatus.Configured;
        }
        /** 認証先を固定
         * @return 模擬URL
         */
        public override String getUrl() {
            return mode == 'foreign'
                ? 'https://example.invalid/auth'
                : Url.getOrgDomainUrl().toExternalForm() + '/auth';
        }
        /** 実接続を解除せず呼び出しだけ記録 */
        public override void revoke() {
            revoked = true;
        }
    }

    /** 固定応答を使う通信モック */
    private class ResponseMock implements HttpCalloutMock {
        private Integer statusCode;
        private String body;
        /** 固定応答を準備
         * @param statusCode HTTP番号
         * @param body JSON本文
         */
        private ResponseMock(Integer statusCode, String body) {
            this.statusCode = statusCode;
            this.body = body;
        }
        /** 専用Named Credentialを検証して応答
         * @param request 検証対象
         * @return 固定応答
         */
        public HttpResponse respond(HttpRequest request) {
            Assert.isTrue(
                request.getEndpoint().startsWith('callout:ExternalClientAppManager/services/'),
                '管理専用接続へ固定'
            );
            Assert.areEqual('application/json', request.getHeader('Accept'), 'JSONを要求');
            HttpResponse response = new HttpResponse();
            response.setStatusCode(statusCode);
            response.setBody(body);
            return response;
        }
    }
}