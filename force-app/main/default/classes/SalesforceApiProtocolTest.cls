/** 固定診断コードと機密情報を公開しない変換 */
@IsTest
private with sharing class SalesforceApiProtocolTest {
    private static SalesforceApiProtocol.RecordReader reader = new SalesforceApiProtocol.RecordReader();
    private static User testUser = new User(Id = UserInfo.getUserId());

    /** 公開境界の例外メッセージを確認 */
    @IsTest
    static void preservesPublicBusinessFailure() {
        System.runAs(testUser) {
            Test.startTest();
            AuraHandledException original = new AuraHandledException('入力が不正です。');
            original.setMessage('入力が不正です。');
            AuraHandledException result = SalesforceApiProtocol.publicException(original, '接続確認', SalesforceApiProtocol.Publication.CONTROLLED);
            Test.stopTest();
            Assert.areEqual('接続確認：入力が不正です。', result.getMessage(), '処理段階と公開可能な理由だけを返す');
        }
    }

    /** 公開境界の例外メッセージを確認 */
    @IsTest
    static void preservesPublicIntegrationFailure() {
        System.runAs(testUser) {
            Test.startTest();
            Exception original = new SalesforceApiClient.IntegrationException('HTTP 401');
            AuraHandledException result = SalesforceApiProtocol.publicException(original, '接続確認', SalesforceApiProtocol.Publication.CONTROLLED);
            Test.stopTest();
            Assert.areEqual('接続確認：HTTP 401', result.getMessage(), '処理段階と公開可能な理由だけを返す');
        }
    }

    /** 公開境界の例外メッセージを確認 */
    @IsTest
    static void hidesUnexpectedFailure() {
        System.runAs(testUser) {
            Test.startTest();
            Exception original = new QueryException('PRIVATE_QUERY');
            AuraHandledException result = SalesforceApiProtocol.publicException(original, '接続確認', SalesforceApiProtocol.Publication.INTERNAL);
            Test.stopTest();
            Assert.areEqual('接続確認：処理に失敗しました。参照権限とAPI連携設定を確認してください。', result.getMessage(), '処理段階と公開可能な理由だけを返す');
        }
    }

    /** サーバーエラーを認証や権限不足と誤分類しない */
    @IsTest
    static void distinguishesServerFailure() {
        System.runAs(testUser) {
            HttpResponse response = new HttpResponse();
            response.setStatusCode(503);
            response.setBody('PRIVATE_VALUE');
            Test.startTest();
            String result = SalesforceApiProtocol.httpMessage(response);
            Test.stopTest();
            Assert.isTrue(result.contains('[OE-API-HTTP-503]'), 'HTTP番号を維持');
            Assert.isTrue(result.contains('APIサーバー'), '接続や認証の拒否と区別');
            Assert.isFalse(result.contains('権限'), 'サーバーの失敗を権限不足と断定しない');
            Assert.isFalse(result.contains('PRIVATE'), '応答本文を公開しない');
        }
    }

    /** API応答の許可済みコードだけを公開 */
    @IsTest
    static void exposesKnownCodeOnly() {
        System.runAs(testUser) {
            Test.startTest();
            HttpResponse response = new HttpResponse();
            response.setStatusCode(401);
            response.setBody('[{"errorCode":"INVALID_SESSION_ID","message":"PRIVATE_VALUE"}]');
            String result = SalesforceApiProtocol.httpMessage(response);
            Test.stopTest();
            Assert.isTrue(result.contains('[OE-AUTH-401]'), '認証拒否を区別');
            Assert.isTrue(result.contains('INVALID_SESSION_ID'), '許可されたコードだけを公開');
            Assert.isFalse(result.contains('PRIVATE_VALUE'), '本文を公開しない');
        }
    }

    /** 未知のコードを固定表記に置換 */
    @IsTest
    static void hidesUnknownCode() {
        System.runAs(testUser) {
            Test.startTest();
            String code = SalesforceApiProtocol.safeCode('PRIVATE_VALUE');
            Test.stopTest();
            Assert.areEqual('UNKNOWN_ERROR', code, '未知の文字列を公開しない');
        }
    }

    /** 接続失敗から認証失敗を推測しない */
    @IsTest
    static void keepsConnectionFailureUnclassified() {
        System.runAs(testUser) {
            Test.startTest();
            String result = SalesforceApiProtocol.connectionMessage('PRIVATE_VALUE');
            Test.stopTest();
            Assert.isTrue(result.startsWith('[OE-API-CONNECTION]'), '原因未確定の接続失敗');
            Assert.isFalse(result.contains('PRIVATE_VALUE'), '例外本文を公開しない');
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
            } catch (SalesforceApiClient.IntegrationException error) {
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
            } catch (SalesforceApiClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('一致'), '対象不一致を通知');
            }
            Test.stopTest();
        }
    }
}
