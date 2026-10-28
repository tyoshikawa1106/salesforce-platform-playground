/** 参照権限・編集対象・保存要求の検証 */
@IsTest
private with sharing class ObjectExplorerAccessPolicyTest {
    private static ObjectExplorerAccessPolicy access = new ObjectExplorerAccessPolicy();
    private static ObjectExplorerAccessPolicy.RequestValidator validator = new ObjectExplorerAccessPolicy.RequestValidator();

    private static User testUser = TestDataFactory.getTestUser();

    /** JSON構文・型・長さの不正を拒否 */
    @IsTest
    static void rejectsMalformedJson() {
        System.runAs(testUser) {
            Test.startTest();
            for (String value : new List<String>{ '{', 'null', '{}', '[1,2,3]' }) {
                try {
                    access.readJsonArray(value, 5, '入力形式エラー');
                    Assert.fail('不正な配列を拒否');
                } catch (AuraHandledException error) {
                    Assert.areEqual('入力形式エラー', error.getMessage(), '内部解析内容を公開しない');
                }
            }
            Test.stopTest();
        }
    }
    /** 無効になった既存分類を維持する候補 */
    @IsTest
    static void preservesExistingComplianceOptions() {
        System.runAs(testUser) {
            Test.startTest();
            Map<String, Object> options = access.createValidationOptions(
                new Map<String, Object>{ 'complianceGroup' => 'LegacyA;LegacyB' }
            );
            Set<String> values = new Set<String>();
            for (Map<String, String> choice : (List<Map<String, String>>) options.get('ComplianceGroup')) {
                values.add(choice.get('value'));
            }
            Assert.isTrue(values.containsAll(new Set<String>{ 'LegacyA', 'LegacyB' }), '既存の分類値を保持可能にする');
            Assert.areEqual(
                access.getOptions(),
                access.createValidationOptions(new Map<String, Object>()),
                '既存値なしなら通常の候補を保持'
            );
            Test.stopTest();
        }
    }
    /** 対象と標準権限を確認 */
    @IsTest
    static void allowsKnownObjectsAndLocalFields() {
        System.runAs(testUser) {
            Test.startTest();
            Assert.areEqual(Account.SObjectType, access.requireObject('Account'), '実在する対象を返す');
            Assert.areEqual(
                'Name',
                access.validateField(Account.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED), Account.Name)
                    .getName(),
                '同じ項目を検証'
            );
            Assert.isTrue(
                ObjectExplorerAccessPolicy.isEditable(
                    Account.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED),
                    Account.Name.getDescribe()
                ),
                '標準項目も分類の編集対象'
            );
            Assert.areEqual(
                new Set<String>{ 'ComplianceGroup', 'SecurityClassification', 'BusinessStatus' },
                access.getOptions().keySet(),
                '分類の候補を取得'
            );
            access.requireCustomization(
                (List<UserPermissionAccess>) JSON.deserialize(
                    '[{"PermissionsCustomizeApplication":true}]',
                    List<UserPermissionAccess>.class
                )
            );
            Assert.areEqual(0, access.readJsonArray('[]', 10, '不正').size(), '空配列は形式上有効');
            Test.stopTest();
        }
    }
    /** 存在しない対象を拒否 */
    @IsTest
    static void rejectsUnknownObject() {
        System.runAs(testUser) {
            Test.startTest();
            try {
                access.requireObject('NoSuchExplorerObject');
                Assert.fail('対象不明を拒否');
            } catch (AuraHandledException error) {
                Assert.isTrue(error.getMessage().contains('参照できません'), '対象不明を通知');
            }
            Test.stopTest();
        }
    }
    /** 未取得の項目を拒否 */
    @IsTest
    static void rejectsMissingField() {
        System.runAs(testUser) {
            Test.startTest();
            try {
                access.validateField(Account.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED), null);
                Assert.fail('項目なしを拒否');
            } catch (AuraHandledException error) {
                Assert.isTrue(error.getMessage().contains('参照できません'), '未取得を通知');
            }
            Test.stopTest();
        }
    }
    /** 編集権限の不足を拒否 */
    @IsTest
    static void rejectsMissingCustomization() {
        System.runAs(testUser) {
            Test.startTest();
            try {
                access.requireCustomization(new List<UserPermissionAccess>());
                Assert.fail('権限未取得を拒否');
            } catch (AuraHandledException error) {
                Assert.isTrue(error.getMessage().contains('カスタマイズ'), '必要権限を通知');
            }
            Test.stopTest();
        }
    }
    /** 要求の形と項目の正式名を照合 */
    @IsTest
    static void validatesChangesAndCanonicalNames() {
        System.runAs(testUser) {
            Test.startTest();
            Map<String, Object> values = draft();
            List<Object> changes = validator.parseChanges(
                JSON.serialize(
                    new List<Object>{
                        new Map<String, Object>{ 'apiName' => 'name', 'original' => values, 'draft' => values }
                    }
                )
            );
            List<ObjectExplorerClassificationService.FieldContext> contexts = validator.createFieldContexts(
                Account.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED),
                changes
            );
            Assert.areEqual('Name', contexts[0].fieldName, '正式API名へ統一');
            FieldDefinition definition = (FieldDefinition) JSON.deserialize(
                '{"QualifiedApiName":"Name","DurableId":"Account.Name"}',
                FieldDefinition.class
            );
            List<ObjectExplorerClassificationService.FieldContext> bound = validator.bindDefinitions(
                contexts,
                new List<FieldDefinition>{ definition }
            );
            Assert.areEqual('Account.Name', bound[0].definition.DurableId, '完全IDを対応付け');
            Assert.isNull(contexts[0].definition, '入力を変更しない');
            Assert.areEqual('', validator.normalizeOwnerId(''), '明示解除を保持');
            Assert.areEqual(
                String.valueOf(testUser.Id),
                validator.normalizeOwnerId(String.valueOf(testUser.Id).substring(0, 15)),
                'ID表記を正規化'
            );
            Test.stopTest();
        }
    }
    /** 項目の重複を拒否 */
    @IsTest
    static void rejectsDuplicateFields() {
        System.runAs(testUser) {
            Test.startTest();
            Map<String, Object> item = new Map<String, Object>{
                'apiName' => 'Name',
                'original' => draft(),
                'draft' => draft()
            };
            try {
                validator.createFieldContexts(
                    Account.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED),
                    new List<Object>{ item, item }
                );
                Assert.fail('同じ項目を二重更新しない');
            } catch (AuraHandledException error) {
                Assert.isTrue(error.getMessage().contains('重複'), '重複を通知');
            }
            Test.stopTest();
        }
    }
    /** 選択肢外の値を拒否 */
    @IsTest
    static void rejectsInvalidOptions() {
        System.runAs(testUser) {
            Test.startTest();
            try {
                access.validateOption('securityClassification', 'INVALID', access.getOptions());
                Assert.fail('未知の選択肢を拒否');
            } catch (AuraHandledException error) {
                Assert.isTrue(error.getMessage().contains('選択肢'), '候補不一致を通知');
            }
            Test.stopTest();
        }
    }
    /** 所有者名を更新対象として受け付けない */
    @IsTest
    static void rejectsOwnerNamesInDraft() {
        System.runAs(testUser) {
            Test.startTest();
            Map<String, Object> values = draft();
            values.put('ownerLabel', '推測名');
            try {
                validator.validateOwnerDraft(values);
                Assert.fail('名前による所有者指定を拒否');
            } catch (AuraHandledException error) {
                Assert.isTrue(error.getMessage().contains('不正'), '過剰な属性を拒否');
            }
            Test.stopTest();
        }
    }
    /** 機能権限の有無で利用可否を分ける */
    @IsTest
    static void requiresFeaturePermission() {
        System.runAs(testUser) {
            Test.startTest();
            User deniedUser = TestDataFactory.createUser('ExplorerDenied', TestDataFactory.SaveMode.INSERT_RECORD);
            System.runAs(deniedUser) {
                try {
                    access.requireAccess();
                    Assert.fail('機能権限なしを拒否');
                } catch (AuraHandledException error) {
                    Assert.isTrue(error.getMessage().contains('権限セット'), '必要権限を通知');
                }
            }
            TestDataFactory.assignPermissionSet(deniedUser.Id, 'LwcObjectExplorer');
            System.runAs(deniedUser) {
                access.requireAccess();
            }
            Assert.isNotNull(deniedUser.Id, '機能権限付与後は利用可能');
            Test.stopTest();
        }
    }
    private static Map<String, Object> draft() {
        return new Map<String, Object>{
            'complianceGroup' => '',
            'securityClassification' => '',
            'businessStatus' => '',
            'ownerId' => ''
        };
    }
}