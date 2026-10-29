/** オブジェクト検索・構造取得・監査参照除外 */
@IsTest
private with sharing class ObjectExplorerServiceTest {
    private static ObjectExplorerService service = new ObjectExplorerService();

    private static User testUser = new User(Id = UserInfo.getUserId());

    /** 取得範囲ごとの項目定義と関連有無 */
    @IsTest
    static void fieldsAndClassifyKeepDefinitions() {
        System.runAs(testUser) {
            Test.startTest();
            Map<String, Object> full = service.getObjectInfo('Account', 'reference');
            Map<String, Object> fields = service.getObjectInfo('Account', 'fields');
            Map<String, Object> classified = service.getObjectInfo('Account', 'classify');
            Assert.areEqual(full.get('fields'), fields.get('fields'), '項目のみ取得でも定義を維持');
            Assert.areEqual(full.get('fields'), classified.get('fields'), '分類モードでも定義を維持');
            Assert.isTrue(
                ((List<Map<String, Object>>) fields.get('relations')).isEmpty(),
                '項目モードで関連を探索しない'
            );
            Assert.isTrue(
                ((List<Map<String, Object>>) classified.get('relations')).isEmpty(),
                '分類モードで関連を探索しない'
            );
            Assert.isFalse(((List<Map<String, Object>>) full.get('relations')).isEmpty(), '構造モードは関連を含む');
            Test.stopTest();
        }
    }
    /** 所有者参照の保持と監査参照の除外 */
    @IsTest
    static void keepsOwnerAndOmitsAuditRelations() {
        System.runAs(testUser) {
            Test.startTest();
            Map<String, Object> data = service.getObjectInfo('User', null);
            Set<String> fieldNames = new Set<String>();
            for (Map<String, Object> field : (List<Map<String, Object>>) data.get('fields')) {
                fieldNames.add((String) field.get('apiName'));
            }
            Assert.isTrue(fieldNames.contains('CreatedById'), '作成者は項目一覧に保持');
            Assert.isTrue(fieldNames.contains('LastModifiedById'), '最終更新者は項目一覧に保持');
            Boolean accountOwner = false;
            for (Map<String, Object> relation : (List<Map<String, Object>>) data.get('relations')) {
                Set<String> seen = new Set<String>();
                for (Object raw : (List<Object>) relation.get('links')) {
                    Map<String, Object> link = (Map<String, Object>) raw;
                    String name = (String) link.get('field');
                    Assert.isTrue(seen.add(name), 'カード内で項目を重複させない');
                    Assert.isFalse(
                        new Set<String>{ 'CreatedById', 'LastModifiedById' }.contains(name),
                        '監査参照を除く'
                    );
                    if (
                        relation.get('direction') == 'IN' &&
                        relation.get('apiName') == 'Account' &&
                        name == 'OwnerId'
                    ) {
                        accountOwner = true;
                    }
                }
            }
            Assert.isTrue(accountOwner, '取引先所有者のユーザー参照を保持');
            Test.stopTest();
        }
    }
    /** 参照可能な候補と検索条件 */
    @IsTest
    static void searchesAccessibleNames() {
        System.runAs(testUser) {
            Test.startTest();
            List<Map<String, Object>> found = service.searchObjects('Account');
            Assert.isFalse(found.isEmpty(), '標準オブジェクトをAPI名で検索');
            for (Map<String, Object> candidate : found) {
                Assert.isTrue(
                    ((String) candidate.get('apiName')).toLowerCase().contains('account') ||
                    ((String) candidate.get('label')).toLowerCase().contains('account'),
                    '表示名かAPI名で一致'
                );
            }
            List<Map<String, Object>> candidates = service.searchObjects('');
            Map<String, Schema.SObjectType> objectTypes = Schema.getGlobalDescribe();
            for (Map<String, Object> candidate : candidates) {
                Assert.isTrue(
                    objectTypes.get((String) candidate.get('apiName'))
                        .getDescribe(SObjectDescribeOptions.DEFERRED)
                        .isAccessible(),
                    '標準・カスタムを区別せず参照可能な候補を返す'
                );
            }
            Assert.isTrue(
                service.searchObjects('__MISSING LABEL__').isEmpty(),
                '欠落メッセージは検索語として使わない'
            );
            Assert.isTrue(service.searchObjects('NoSuchExplorerObjectXYZ').isEmpty(), '一致なしは空候補');
            Test.stopTest();
        }
    }
    /** 不明な表示モードを拒否 */
    @IsTest
    static void rejectsUnknownMode() {
        System.runAs(testUser) {
            Test.startTest();
            try {
                service.getObjectInfo('Account', 'invalid');
                Assert.fail('不正モードを拒否');
            } catch (AuraHandledException error) {
                Assert.isNotNull(error, '入力エラー');
            }
            Test.stopTest();
        }
    }
}