/** 固定診断コードと機密情報を公開しない変換 */
@IsTest
private with sharing class MetadataApiProtocolTest {
    private static User testUser = new User(Id = UserInfo.getUserId());

    /** 公開境界の例外メッセージを確認 */
    @IsTest
    static void preservesPublicBusinessFailure() {
        System.runAs(testUser) {
            Test.startTest();
            Exception original = ObjectExplorerAccessPolicy.createException('入力が不正です。');
            AuraHandledException result = MetadataApiProtocol.publicException(original, '接続確認', ObjectExplorerAccessPolicy.errorPublication(original));
            Test.stopTest();
            Assert.areEqual('接続確認：入力が不正です。', result.getMessage(), '処理段階と公開可能な理由だけを返す');
        }
    }

    /** 公開境界の例外メッセージを確認 */
    @IsTest
    static void preservesPublicIntegrationFailure() {
        System.runAs(testUser) {
            Test.startTest();
            Exception original = new MetadataApiIntegrationClient.IntegrationException('HTTP 401');
            AuraHandledException result = MetadataApiProtocol.publicException(original, '接続確認', ObjectExplorerAccessPolicy.errorPublication(original));
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
            AuraHandledException result = MetadataApiProtocol.publicException(original, '接続確認', ObjectExplorerAccessPolicy.errorPublication(original));
            Test.stopTest();
            Assert.areEqual('接続確認：処理に失敗しました。参照権限とAPI連携設定を確認してください。', result.getMessage(), '処理段階と公開可能な理由だけを返す');
        }
    }

    /** メタデータの再帰変換で元の値と設定済み属性を維持 */
    @IsTest
    static void preservesSourceMetadata() {
        System.runAs(testUser) {
            Map<String, Object> source = new Map<String, Object>{'label' => '項目', 'optional' => null, 'nested' => new Map<String, Object>{'value' => 7, 'optional' => null}, 'items' => new List<Object>{new Map<String, Object>{'value' => '設定値'}}};
            Test.startTest();
            Map<String, Object> result = (Map<String, Object>)MetadataApiProtocol.cleanMetadata(source);
            Test.stopTest();
            Assert.isTrue(source.containsKey('optional'), '元のメタデータを変更しない');
            Assert.isFalse(result.containsKey('optional'), '未設定属性だけを省く');
            Assert.areEqual(7, ((Map<String, Object>)result.get('nested')).get('value'), '設定済み属性は維持');
            Assert.areEqual('設定値', ((Map<String, Object>)((List<Object>)result.get('items'))[0]).get('value'), '配列内も同じ値を維持');
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
            String result = MetadataApiProtocol.httpMessage(response);
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
            String result = MetadataApiProtocol.httpMessage(response);
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
            String code = MetadataApiProtocol.safeCode('PRIVATE_VALUE');
            Test.stopTest();
            Assert.areEqual('UNKNOWN_ERROR', code, '未知の文字列を公開しない');
        }
    }

    /** 接続失敗から認証失敗を推測しない */
    @IsTest
    static void keepsConnectionFailureUnclassified() {
        System.runAs(testUser) {
            Test.startTest();
            String result = MetadataApiProtocol.connectionMessage('PRIVATE_VALUE');
            Test.stopTest();
            Assert.isTrue(result.startsWith('[OE-API-CONNECTION]'), '原因未確定の接続失敗');
            Assert.isFalse(result.contains('PRIVATE_VALUE'), '例外本文を公開しない');
        }
    }

    /** 更新結果不明を未保存と断定しない */
    @IsTest
    static void distinguishesUnconfirmedSave() {
        System.runAs(testUser) {
            Test.startTest();
            MetadataApiProtocol.SaveState state = new MetadataApiProtocol.SaveState();
            state.sent = true;
            String result = MetadataApiProtocol.saveStage(state);
            Test.stopTest();
            Assert.isTrue(result.startsWith('[OE-SAVE-UNCONFIRMED]'), '送信後の確認不能を区別');
        }
    }

    /** 明示拒否を結果不明と扱わない */
    @IsTest
    static void distinguishesRejectedSave() {
        System.runAs(testUser) {
            Test.startTest();
            MetadataApiProtocol.SaveState state = new MetadataApiProtocol.SaveState();
            state.sent = true;
            state.rejected = true;
            String result = MetadataApiProtocol.saveStage(state);
            Test.stopTest();
            Assert.isTrue(result.startsWith('[OE-SAVE-REJECTED]'), 'APIの明示拒否を区別');
        }
    }
}
