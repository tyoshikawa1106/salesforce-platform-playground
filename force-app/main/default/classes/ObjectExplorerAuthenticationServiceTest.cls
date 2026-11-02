/** API認証状態の公開契約と標準認証URLの接続先検証 */
@IsTest
private with sharing class ObjectExplorerAuthenticationServiceTest {
    private static ObjectExplorerAuthenticationService service = new ObjectExplorerAuthenticationService();

    private static User testUser = TestDataFactory.getTestUser();

    /** 標準認証APIの状態を固定案内だけの表示契約へ変換する */
    @IsTest
    static void mapsAuthenticationStatesToPublicResponses() {

        System.runAs(testUser) {
            Test.startTest();
            Map<String, Object> configured = service.createAuthenticationState(ConnectApi.CredentialAuthenticationStatus.Configured);
            Map<String, Object> required = service.createAuthenticationState(ConnectApi.CredentialAuthenticationStatus.NotConfigured);
            Map<String, Object> unknown = service.createAuthenticationState(ConnectApi.CredentialAuthenticationStatus.Unknown);
            Map<String, Object> missing = service.createAuthenticationState(null);
            Test.stopTest();
            Assert.areEqual(new Set<String>{'status', 'message'}, configured.keySet(), '資格情報を公開属性に含めない');
            Assert.areEqual('AUTHENTICATED', configured.get('status'), '設定済みは認証済みへ変換');
            Assert.areEqual('', configured.get('message'), '認証済みでは認証を案内しない');
            Assert.areEqual('REQUIRED', required.get('status'), '未設定だけ認証を案内');
            Assert.areEqual('Salesforce APIを使用します。認証ボタンをクリックしてください。', required.get('message'), '認証案内の公開契約を維持');
            Assert.areEqual('UNAVAILABLE', unknown.get('status'), '不明を未認証と推定しない');
            Assert.areEqual(unknown, missing, '欠落も確認不能として扱う');
        }

    }

    /** 接続境界の明示的な401だけを再認証として分類する */
    @IsTest
    static void separatesAuthenticationRejectionFromOtherFailures() {

        System.runAs(testUser) {
            Test.startTest();
            Map<String, Object> rejected = service.createAuthenticationFailure(new SalesforceApiClient.IntegrationException('[OE-AUTH-401]'));
            Map<String, Object> forbidden = service.createAuthenticationFailure(new SalesforceApiClient.IntegrationException('[OE-API-HTTP-403]'));
            Map<String, Object> internalFailure = service.createAuthenticationFailure(new QueryException('PRIVATE_VALUE [OE-AUTH-401]'));
            Test.stopTest();
            Assert.areEqual('REQUIRED', rejected.get('status'), '通信境界の認証拒否だけ再認証を案内');
            Assert.areEqual('UNAVAILABLE', forbidden.get('status'), '権限不足を認証失効と混同しない');
            Assert.areEqual(forbidden, internalFailure, '内部例外の本文や見かけのコードを公開しない');
            Assert.isFalse(String.valueOf(internalFailure).contains('PRIVATE_VALUE'), '内部情報を公開しない');
        }

    }

    /** 現在組織の標準認証URLを変更せず許可する */
    @IsTest
    static void preservesCurrentOrganizationAuthenticationUrl() {
        String value = Url.getOrgDomainUrl().toExternalForm() + '/services/auth/test?state=opaque';

        System.runAs(testUser) {
            Test.startTest();
            String result = service.requireAuthenticationUrl(value);
            Test.stopTest();
            Assert.areEqual(value, result, '標準URLやクエリを独自に書き換えない');
        }

    }

    /** 欠落・他ホスト・類似ホストを固定案内で拒否する */
    @IsTest
    static void rejectsMissingAndForeignAuthenticationUrls() {
        String origin = Url.getOrgDomainUrl().toExternalForm();

        System.runAs(testUser) {
            Test.startTest();
            for (String invalid : new List<String>{null, '', 'javascript:alert(1)', 'https://example.com/auth', origin + '.example.com/auth', origin + '@example.com/auth'}) {
                try {
                    service.requireAuthenticationUrl(invalid);
                    Assert.fail('現在組織のHTTPS接続先以外は拒否する');
                } catch (AuraHandledException e) {
                    Assert.areEqual('API認証の開始URLを取得できませんでした。管理者に確認してください。', e.getMessage(), '接続先を含まない固定案内を返す');
                }
            }
            Test.stopTest();
        }

    }
}
