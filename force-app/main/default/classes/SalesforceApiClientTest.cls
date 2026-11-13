/** 同一組織APIの通信・認証・公開エラー */
@IsTest
private with sharing class SalesforceApiClientTest {
    private static SalesforceApiClient client = new SalesforceApiClient();

    private static User testUser = new User(Id = UserInfo.getUserId());

    /** 標準APIの失敗を固定案内へ変換 */
    @IsTest
    static void hidesAuthenticationUrlFailure() {
        System.runAs(testUser) {
            CredentialMock mock = new CredentialMock();
            mock.fail = true;
            SalesforceApiClient.credentialAccess = mock;
            Test.startTest();
            try {
                client.getAuthenticationUrl();
                Assert.fail('標準APIの失敗を成功として返さない');
            } catch (SalesforceApiClient.IntegrationException error) {
                Assert.areEqual('API認証を開始できませんでした。接続設定と権限を管理者に確認してください。', error.getMessage(), '標準APIの内部情報を公開しない');
            }
            Test.stopTest();
        }
    }

    /** 認証拒否では固定診断コードと許可済みAPIコードだけを公開 */
    @IsTest
    static void reportsAuthenticationCode() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new DiagnosticMock(401, '[{"errorCode":"INVALID_SESSION_ID","message":"PRIVATE_VALUE"}]', null));
            try {
                client.request('query/', 'GET', null);
                Assert.fail('失敗を成功として返さない');
            } catch (SalesforceApiClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('[OE-AUTH-401]'), '失敗の種類を固定コードで識別');
                Assert.isFalse(error.getMessage().contains('PRIVATE'), '例外本文と未知コードを公開しない');
                Assert.isTrue(error.getMessage().contains('Salesforceコード：INVALID_SESSION_ID'), '許可済みコードを表示');
            }
            Test.stopTest();
        }
    }

    /** 未知のAPIコードとエラー本文を公開しない */
    @IsTest
    static void hidesUnknownApiCode() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new DiagnosticMock(403, '[{"errorCode":"PRIVATE_CODE","message":"PRIVATE_VALUE"}]', null));
            try {
                client.request('query/', 'GET', null);
                Assert.fail('失敗を成功として返さない');
            } catch (SalesforceApiClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('[OE-API-HTTP-403]'), '失敗の種類を固定コードで識別');
                Assert.isFalse(error.getMessage().contains('PRIVATE'), '例外本文と未知コードを公開しない');
            }
            Test.stopTest();
        }
    }

    /** JSONでないエラー本文でもHTTP状態を伝える */
    @IsTest
    static void preservesHttpStatusForMalformedBody() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new DiagnosticMock(503, 'PRIVATE_VALUE', null));
            try {
                client.request('query/', 'GET', null);
                Assert.fail('失敗を成功として返さない');
            } catch (SalesforceApiClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('[OE-API-HTTP-503]'), '失敗の種類を固定コードで識別');
                Assert.isFalse(error.getMessage().contains('PRIVATE'), '例外本文と未知コードを公開しない');
            }
            Test.stopTest();
        }
    }

    /** タイムアウトを接続失敗と区別して案内 */
    @IsTest
    static void reportsResponseTimeout() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new DiagnosticMock(200, '', 'Read timed out PRIVATE_VALUE'));
            try {
                client.request('query/', 'GET', null);
                Assert.fail('失敗を成功として返さない');
            } catch (SalesforceApiClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('[OE-API-TIMEOUT]'), '失敗の種類を固定コードで識別');
                Assert.isFalse(error.getMessage().contains('PRIVATE'), '例外本文と未知コードを公開しない');
            }
            Test.stopTest();
        }
    }

    /** 分類できない接続例外を固定の案内へ変換 */
    @IsTest
    static void reportsUnclassifiedConnectionFailure() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new DiagnosticMock(200, '', 'PRIVATE_VALUE'));
            try {
                client.request('query/', 'GET', null);
                Assert.fail('失敗を成功として返さない');
            } catch (SalesforceApiClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('[OE-API-CONNECTION]'), '失敗の種類を固定コードで識別');
                Assert.isFalse(error.getMessage().contains('PRIVATE'), '例外本文と未知コードを公開しない');
            }
            Test.stopTest();
        }
    }

    /** 成功ステータスでも不正なJSONを成功として返さない */
    @IsTest
    static void reportsMalformedSuccessfulResponse() {
        System.runAs(testUser) {
            Test.startTest();
            Test.setMock(HttpCalloutMock.class, new DiagnosticMock(200, 'PRIVATE_VALUE', null));
            try {
                client.request('query/', 'GET', null);
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
                client.request('query/', 'PATCH', '{}');
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
                client.request('query/', 'PATCH', '{}');
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
            Test.setMock(HttpCalloutMock.class, new JsonBodyMock());
            Assert.isTrue(
                client.request('query/', 'PATCH', '{"value":"{!input}"}').isEmpty(),
                '本文なし成功を空応答として扱う'
            );
            Test.stopTest();
        }
    }

    /** 任意URLや未対応操作を通信前に拒否 */
    @IsTest
    static void rejectsUnsupportedRequests() {
        System.runAs(testUser) {
            Test.startTest();
            for (String path : new List<String>{null, '', 'https://example.invalid', '/query/', '../query/', 'tooling/query/../sobjects', 'query/extra', 'other/?q=..'}) {
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

    /** 検索条件内のドットとコロンを変えずに固定の照会先へ送る */
    @IsTest
    static void preservesQueryCharacters() {
        System.runAs(testUser) {
            Test.startTest();
            for (String resourcePath : new List<String>{'query/', 'tooling/query/'}) {
                String path = resourcePath + '?q=SELECT+Id+FROM+Account+WHERE+Name=\'A..B:C\'';
                DiagnosticMock mock = new DiagnosticMock(200, '{"records":[]}', null);
                mock.expectedEndpoint = 'callout:InternalSalesforceApi/services/data/v68.0/' + path;
                Test.setMock(HttpCalloutMock.class, mock);
                Assert.isNotNull(client.request(path, 'GET', null).get('records'), '検索条件の記号を拒否しない');
            }
            Assert.areEqual(2, Limits.getCallouts(), '通常の照会とTooling照会を一度ずつ送信');
            Test.stopTest();
        }
    }

    /** 認証・HTTP・形式不正を再現する診断用モック */
    private class DiagnosticMock implements HttpCalloutMock {
        private Integer status;
        private String body;
        private String exceptionMessage;
        private String expectedEndpoint;

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
            if (this.expectedEndpoint != null) { Assert.areEqual(this.expectedEndpoint, request.getEndpoint(), '検索条件を変更せず固定接続先へ送信'); }
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

    /** JSONの値を保ち、認証差し込み式だけを無効化したことを確認 */
    private class JsonBodyMock implements HttpCalloutMock {
        /**
         * 送信本文を照合して本文なし成功を返す
         * @param request 共通通信の要求
         * @return 本文なし成功
         */
        public HttpResponse respond(HttpRequest request) {
            Assert.isTrue(request.getEndpoint().startsWith('callout:InternalSalesforceApi/'), '指定ログイン情報を使用');
            Assert.isFalse(request.getBody().contains('{!'), '入力の数式差し込みを無効化');
            Assert.areEqual('{!input}', ((Map<String,Object>)JSON.deserializeUntyped(request.getBody())).get('value'), '元の文字列は維持');
            HttpResponse response = new HttpResponse();
            response.setStatusCode(204);
            response.setBody('');
            return response;
        }
    }
    /** Metadata更新を固定のSOAP接続先へ送信 */
    @IsTest
    static void sendsMetadataUpdateToFixedEndpoint() {

        System.runAs(testUser) {
            DiagnosticMock mock = new DiagnosticMock(200, '<result/>', null);
            mock.expectedEndpoint = 'callout:InternalSalesforceApi/services/Soap/m/68.0';
            Test.setMock(HttpCalloutMock.class, mock);
            Test.startTest();
            HttpResponse response = client.sendMetadataUpdate('<request/>');
            Test.stopTest();
            Assert.areEqual('<result/>', response.getBody(), '同じ要求のSOAP応答を返す');
        }
    }

    /** 認証済み状態でも実接続先の組織一致を確認 */
    @IsTest
    static void verifiesOrganizationBeforeReturningConfiguredStatus() {
        System.runAs(testUser) {
            SalesforceApiClient.credentialAccess = new CredentialMock();
            Test.setMock(HttpCalloutMock.class, new DiagnosticMock(200, JSON.serialize(new Map<String, Object>{
                'records' => new List<Object>{ new Map<String, Object>{ 'Id' => UserInfo.getOrganizationId() } }
            }), null));
            Test.startTest();
            ConnectApi.CredentialAuthenticationStatus status = client.getAuthenticationStatus();
            Assert.areEqual(ConnectApi.CredentialAuthenticationStatus.Configured, status, '同一組織を確認して認証済みを返す');
            Assert.areEqual(1, Limits.getCallouts(), '認証済みでも組織確認を省略しない');
            Test.stopTest();
        }
    }

    /** 未設定の認証状態ではAPI照会を開始しない */
    @IsTest
    static void returnsMissingCredentialWithoutCallout() {
        System.runAs(testUser) {
            CredentialMock mock = new CredentialMock();
            mock.status = ConnectApi.CredentialAuthenticationStatus.NotConfigured;
            SalesforceApiClient.credentialAccess = mock;
            Test.startTest();
            Assert.areEqual(ConnectApi.CredentialAuthenticationStatus.NotConfigured, client.getAuthenticationStatus(), '未設定を認証済みへ変えない');
            Assert.areEqual(0, Limits.getCallouts(), '未設定の接続で照会しない');
            Test.stopTest();
        }
    }

    /** 標準APIの認証開始URLをそのまま返却 */
    @IsTest
    static void returnsStandardAuthenticationUrl() {
        System.runAs(testUser) {
            SalesforceApiClient.credentialAccess = new CredentialMock();
            Test.startTest();
            Assert.areEqual(Url.getOrgDomainUrl().toExternalForm() + '/auth', client.getAuthenticationUrl(), '標準APIのURLを保持');
            Test.stopTest();
        }
    }

    /** 本人用資格情報の解除を一度だけ委譲 */
    @IsTest
    static void revokesCredentialOnce() {
        System.runAs(testUser) {
            CredentialMock mock = new CredentialMock();
            SalesforceApiClient.credentialAccess = mock;
            Test.startTest();
            client.revokeAuthentication();
            Test.stopTest();
            Assert.areEqual(1, mock.revocations, '解除を一度だけ呼び出す');
        }
    }

    /** 認証解除の失敗から標準APIの内部情報を遮断 */
    @IsTest
    static void hidesCredentialRevokeFailure() {
        System.runAs(testUser) {
            CredentialMock mock = new CredentialMock();
            mock.fail = true;
            SalesforceApiClient.credentialAccess = mock;
            Test.startTest();
            try {
                client.revokeAuthentication();
                Assert.fail('解除結果を確認できない場合は成功を返さない');
            } catch (SalesforceApiClient.IntegrationException e) {
                Assert.areEqual('API認証の解除結果を確認できませんでした。画面を再読み込みして確認してください。', e.getMessage(), '内部情報を含めず固定案内を返す');
            }
            Test.stopTest();
        }
    }

    /** 標準認証APIの境界に限定した模擬応答 */
    private class CredentialMock extends SalesforceApiClient.CredentialAccess {
        private ConnectApi.CredentialAuthenticationStatus status = ConnectApi.CredentialAuthenticationStatus.Configured;
        private Boolean fail = false;
        private Integer revocations = 0;

        /** 保存済みの認証状態を再現
         * @return 指定した標準認証状態
         */
        public override ConnectApi.CredentialAuthenticationStatus getStatus() {
            return status;
        }

        /** 認証開始URLの成功または標準API失敗を再現
         * @return 現在組織の認証URL
         */
        public override String getUrl() {
            if (fail) { throw new CalloutException('PRIVATE_AUTH_DETAIL'); }
            return Url.getOrgDomainUrl().toExternalForm() + '/auth';
        }

        /** 実際の資格情報を変更せず解除要求を記録 */
        public override void revoke() {
            if (fail) { throw new CalloutException('PRIVATE_AUTH_DETAIL'); }
            revocations++;
        }
    }

}
