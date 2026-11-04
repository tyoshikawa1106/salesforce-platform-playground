/** 分類更新定義の保持と保存結果の区分 */
@IsTest
private with sharing class ObjectExplorerApiProtocolTest {
    private static ObjectExplorerApiProtocol.RecordReader reader = new ObjectExplorerApiProtocol.RecordReader();
    private static User testUser = TestDataFactory.getTestUser();

    /** ネイティブ分類の未設定・所有者・識別子を通信せず保持 */
    @IsTest
    static void mapsNativeClassificationWithoutCallouts() {
        System.runAs(testUser) {
            FieldDefinition definition = (FieldDefinition)JSON.deserialize(
                '{"QualifiedApiName":"Name","DurableId":"Account.Name","ComplianceGroup":"PII;HIPAA","SecurityClassification":"Public","BusinessStatus":null,"BusinessOwnerId":"' + testUser.Id + '"}',
                FieldDefinition.class);
            Test.startTest();
            Map<String, Map<String, Object>> rows = reader.createFieldRows(new List<FieldDefinition>{definition});
            Assert.areEqual(new Set<String>{'Name'}, rows.keySet(), '同じ項目名へ索引化');
            Assert.areEqual('Account.Name', rows.get('Name').get('DurableId'), '識別子を保持');
            Assert.areEqual('PII;HIPAA', rows.get('Name').get('ComplianceGroup'), '取得値を保持');
            Assert.areEqual('Public', rows.get('Name').get('SecurityClassification'), '機密度を保持');
            Assert.areEqual(null, rows.get('Name').get('BusinessStatus'), '未設定を補完しない');
            Assert.areEqual(String.valueOf(testUser.Id), rows.get('Name').get('BusinessOwnerId'), '同じ所有者IDを保持');
            Assert.areEqual(0, Limits.getCallouts(), '変換にAPI通信を使わない');
            Test.stopTest();
        }
    }

    /** メタデータの再帰変換で元の値と設定済み属性を維持 */
    @IsTest
    static void preservesSourceMetadata() {
        System.runAs(testUser) {
            Map<String, Object> source = new Map<String, Object>{'label' => '項目', 'optional' => null, 'nested' => new Map<String, Object>{'value' => 7, 'optional' => null}, 'items' => new List<Object>{new Map<String, Object>{'value' => '設定値'}}};
            Test.startTest();
            Map<String, Object> result = (Map<String, Object>)ObjectExplorerApiProtocol.cleanMetadata(source);
            Test.stopTest();
            Assert.isTrue(source.containsKey('optional'), '元のメタデータを変更しない');
            Assert.isFalse(result.containsKey('optional'), '未設定属性だけを省く');
            Assert.areEqual(7, ((Map<String, Object>)result.get('nested')).get('value'), '設定済み属性は維持');
            Assert.areEqual('設定値', ((Map<String, Object>)((List<Object>)result.get('items'))[0]).get('value'), '配列内も同じ値を維持');
        }
    }

    /** 更新結果不明を未保存と断定しない */
    @IsTest
    static void distinguishesUnconfirmedSave() {
        System.runAs(testUser) {
            Test.startTest();
            ObjectExplorerApiProtocol.SaveState state = new ObjectExplorerApiProtocol.SaveState();
            state.sent = true;
            String result = ObjectExplorerApiProtocol.saveStage(state);
            Test.stopTest();
            Assert.isTrue(result.startsWith('[OE-SAVE-UNCONFIRMED]'), '送信後の確認不能を区別');
        }
    }

    /** 明示拒否を結果不明と扱わない */
    @IsTest
    static void distinguishesRejectedSave() {
        System.runAs(testUser) {
            Test.startTest();
            ObjectExplorerApiProtocol.SaveState state = new ObjectExplorerApiProtocol.SaveState();
            state.sent = true;
            state.rejected = true;
            String result = ObjectExplorerApiProtocol.saveStage(state);
            Test.stopTest();
            Assert.isTrue(result.startsWith('[OE-SAVE-REJECTED]'), 'APIの明示拒否を区別');
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
            } catch (SalesforceApiClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('不足'), '未完了を通知');
            }
            response.put('done', true);
            row.remove('BusinessOwnerId');
            try {
                reader.readClassifyData(response, new Set<String>{ 'Name' });
                Assert.fail('属性欠落を拒否');
            } catch (SalesforceApiClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('属性'), '欠落を通知');
            }
            response.put('records', new List<Object>{ classifyRow(), classifyRow() });
            try {
                reader.readClassifyData(response, new Set<String>{ 'Name', 'Phone' });
                Assert.fail('重複行を拒否');
            } catch (SalesforceApiClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('一致'), '重複を通知');
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

}