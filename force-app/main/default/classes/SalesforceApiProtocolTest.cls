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

    /** 定義更新の公式エラーコードを未知扱いせず本文は秘匿 */
    @IsTest
    static void exposesDefinitionValidationCode() {
        System.runAs(testUser) {
            HttpResponse response = new HttpResponse();
            response.setStatusCode(400);
            response.setBody('[{"errorCode":"REQUIRED_FIELD_MISSING","message":"PRIVATE_VALUE"}]');
            Test.startTest();
            String result = SalesforceApiProtocol.httpMessage(response);
            Dom.Document soap = new Dom.Document();
            soap.load('<result xmlns="http://soap.sforce.com/2006/04/metadata"><errors><statusCode>INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST</statusCode><fields>FieldOrColumn</fields></errors></result>');
            Assert.isTrue(SalesforceApiProtocol.metadataUpdateError(soap.getRootElement()).contains('FieldOrColumn'), '項目自体の拒否を区別');
            soap = new Dom.Document();
            soap.load('<result xmlns="http://soap.sforce.com/2006/04/metadata"/>');
            Assert.isTrue(SalesforceApiProtocol.metadataUpdateError(soap.getRootElement()).contains('UNRECOGNIZED_API_ERROR_CODE'), 'コード欠落は原因未確定として保持');
            Test.stopTest();
            Assert.isTrue(result.contains('REQUIRED_FIELD_MISSING'), '公式の定義検証コードを維持');
            Assert.isFalse(result.contains('PRIVATE_VALUE'), '応答の自由文は公開しない');
        }
    }

    /** 未知のコードを固定表記に置換 */
    @IsTest
    static void hidesUnknownCode() {
        System.runAs(testUser) {
            Test.startTest();
            String code = SalesforceApiProtocol.safeCode('PRIVATE_VALUE');
            Test.stopTest();
            Assert.areEqual('UNRECOGNIZED_API_ERROR_CODE', code, '未知の文字列を公開しない');
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
    /** 既知のタイムアウトと自由形式のAPI本文を安全に扱う */
    @IsTest
    static void handlesTimeoutAndMissingErrorCode() {

        System.runAs(testUser) {
            Test.startTest();
            String timeout = SalesforceApiProtocol.connectionMessage('Read timed out: PRIVATE');
            HttpResponse response = new HttpResponse();
            response.setStatusCode(400);
            response.setBody('[{"message":"PRIVATE"}]');
            String code = SalesforceApiProtocol.httpMessage(response);
            Test.stopTest();
            Assert.isTrue(timeout.startsWith('[OE-API-TIMEOUT]'), 'タイムアウトを固定コードへ分類');
            Assert.isFalse(timeout.contains('PRIVATE'), '内部情報を非公開');
            Assert.isTrue(code.contains('HTTP 400'), 'HTTP状態を保持');
            Assert.isFalse(code.contains('PRIVATE'), 'コードのない自由文を公開しない');
        }
    }

    /** 確認対象と一致した一件だけを返す */
    @IsTest
    static void returnsConfirmedRecord() {

        System.runAs(testUser) {
            Map<String, Object> record = new Map<String, Object>{ 'Id' => 'confirmed', 'Name' => '対象' };
            Test.startTest();
            Map<String, Object> result = reader.requireQueryRecord(new Map<String, Object>{ 'records' => new List<Object>{ record } }, 'Id', 'confirmed');
            Test.stopTest();
            Assert.areEqual(record, result, '照合できたレコードをそのまま返す');
        }
    }

    /** 応答・配列・行の欠落を照合前に拒否 */
    @IsTest
    static void rejectsNullQueryResponseAndRows() {
        System.runAs(testUser) {
            Test.startTest();
            for (Map<String, Object> response : new List<Map<String, Object>>{
                null, new Map<String, Object>(), new Map<String, Object>{ 'records' => null },
                new Map<String, Object>{ 'records' => new List<Object>{ null } }
            }) {
                try {
                    reader.requireQueryRecord(response, 'Id', 'expected');
                    Assert.fail('必須値の欠落を拒否');
                } catch (SalesforceApiClient.IntegrationException e) {
                    Assert.isTrue(e.getMessage().contains('一意'), '欠落を明示したエラーで拒否');
                }
            }
            Test.stopTest();
        }
    }

    /** 空白の照合属性・期待値・応答IDを有効な一致にしない */
    @IsTest
    static void rejectsBlankQueryIdentifiers() {
        System.runAs(testUser) {
            Test.startTest();
            Map<String, Object> row = new Map<String, Object>{ 'Id' => 'expected' };
            Map<String, Object> response = new Map<String, Object>{ 'records' => new List<Object>{ row } };
            for (String value : new List<String>{ null, '', '   ' }) {
                try {
                    reader.requireQueryRecord(response, value, 'expected');
                    Assert.fail('必須値の欠落を拒否');
                } catch (SalesforceApiClient.IntegrationException e) {
                    Assert.isTrue(e.getMessage().contains('一意'), '欠落を明示したエラーで拒否');
                }
                try {
                    reader.requireQueryRecord(response, 'Id', value);
                    Assert.fail('必須値の欠落を拒否');
                } catch (SalesforceApiClient.IntegrationException e) {
                    Assert.isTrue(e.getMessage().contains('一意'), '欠落を明示したエラーで拒否');
                }
                row.put('Id', value);
                try {
                    reader.requireQueryRecord(response, 'Id', 'expected');
                    Assert.fail('必須値の欠落を拒否');
                } catch (SalesforceApiClient.IntegrationException e) {
                    Assert.isTrue(e.getMessage().contains('ID-MISMATCH'), '欠落を明示したエラーで拒否');
                }
            }
            Test.stopTest();
        }
    }

    /** REST応答を非nullのMapへ制限し、空本文の成功を維持 */
    @IsTest
    static void validatesResponseObjectShape() {
        System.runAs(testUser) {
            Test.startTest();
            Assert.isTrue(reader.readResponse(null).isEmpty(), '本文なしの成功を維持');
            Assert.areEqual('value', reader.readResponse('{"key":"value"}').get('key'), '正常な属性を保持');
            for (String value : new List<String>{ 'null', '[]', '{' }) {
                try { reader.readResponse(value); Assert.fail('欠落や別型を拒否'); }
                catch (SalesforceApiClient.IntegrationException e) { Assert.isTrue(e.getMessage().contains('OE-API-RESPONSE'), '形式不正を通知'); }
            }
            Test.stopTest();
        }
    }

    /** 配列の入力形式と行の必須属性を独立して確認 */
    @IsTest
    static void validatesArrayAndRequiredText() {
        System.runAs(testUser) {
            Test.startTest();
            Assert.isTrue(reader.readAuditRecords(new Map<String, Object>{ 'done' => true, 'records' => new List<Object>() }).isEmpty(), '正常な0件を維持');
            Assert.areEqual('field', reader.readAuditRecords(new Map<String, Object>{ 'done' => true, 'records' => new List<Object>{ new Map<String, Object>{ 'Id' => 'field', 'CreatedById' => null } } })[0].get('Id'), '必須IDと任意のnullを保持');
            for (Map<String, Object> invalid : new List<Map<String, Object>>{ null, new Map<String, Object>{ 'done' => true, 'records' => new List<Object>{ null } } }) {
                try { reader.readAuditRecords(invalid); Assert.fail('不完全な日時応答を拒否'); }
                catch (AuraHandledException e) { Assert.isTrue(e.getMessage().contains('情報'), '日時応答の欠落を通知'); }
            }
            Assert.isTrue(reader.parseArray('[]', 20, '入力不正').isEmpty(), '正常な空配列を維持');
            for (String value : new List<String>{ null, '', '  ', 'null', '{' }) {
                try { reader.parseArray(value, 20, '入力不正'); Assert.fail('不正入力を拒否'); }
                catch (AuraHandledException e) { Assert.areEqual('入力不正', e.getMessage(), '固定案内を保持'); }
            }
            Assert.isFalse(SalesforceApiProtocol.hasRequiredText(null, new Set<String>{ 'id' }), 'null行を拒否');
            Assert.isFalse(SalesforceApiProtocol.hasRequiredText(new Map<String, Object>(), null), '検証条件なしを拒否');
            Assert.isFalse(SalesforceApiProtocol.hasRequiredText(new Map<String, Object>{ 'id' => '  ' }, new Set<String>{ 'id' }), '空白の必須値を拒否');
            Assert.isTrue(SalesforceApiProtocol.hasRequiredText(new Map<String, Object>{ 'id' => 'value', 'optional' => null }, new Set<String>{ 'id' }), '任意属性のnullを許容');
            Test.stopTest();
        }
    }
}