/** 項目表示・日時照合・分類一覧 */
@IsTest
private with sharing class ObjectExplorerFieldServiceTest {
    private static ObjectExplorerFieldService service = new ObjectExplorerFieldService();

    private static User testUser = TestDataFactory.getTestUser();

    /** 可視なカスタム項目と正しい識別子を照合 */
    @IsTest
    static void selectsCustomAuditIds() {
        System.runAs(testUser) {
            Test.startTest();
            Id fieldId = Id.valueOf('00N' + String.valueOf(1).leftPad(12, '0'));
            List<FieldDefinition> definitions = (List<FieldDefinition>) JSON.deserialize(
                JSON.serialize(
                    new List<Object>{
                        new Map<String, Object>{
                            'QualifiedApiName' => 'Error_Message__c',
                            'DurableId' => 'DataQualityScan__c.' + fieldId
                        },
                        new Map<String, Object>{
                            'QualifiedApiName' => 'Status__c',
                            'DurableId' => 'DataQualityScan__c.invalid'
                        }
                    }
                ),
                List<FieldDefinition>.class
            );
            Map<Id, String> targets = service.createAuditTargets(
                DataQualityScan__c.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED),
                definitions
            );
            Assert.areEqual(
                new Map<Id, String>{ fieldId => 'Error_Message__c' },
                targets,
                '実在するカスタム項目を検証したIDだけへ対応付け'
            );
            Test.stopTest();
        }
    }
    /** 型ラベルの対応と入力保持 */
    @IsTest
    static void mapsTypesWithoutChangingInput() {
        System.runAs(testUser) {
            Test.startTest();
            Map<String, Object> data = new Map<String, Object>{
                'fields' => new List<Map<String, Object>>{
                    new Map<String, Object>{ 'apiName' => 'Name' },
                    new Map<String, Object>{ 'apiName' => 'Missing' }
                },
                'label' => '取引先'
            };
            List<EntityParticle> types = (List<EntityParticle>) JSON.deserialize(
                '[{"QualifiedApiName":"Name","FieldDefinition":{"DataType":"テキスト(80)"}}]',
                List<EntityParticle>.class
            );
            Map<String, Object> view = service.createFieldTypeView(data, types);
            List<Map<String, Object>> fields = (List<Map<String, Object>>) view.get('fields');
            Assert.areEqual('テキスト(80)', fields[0].get('typeLabel'), '同じ項目に型ラベルを対応');
            Assert.areEqual('型情報を取得できません', fields[1].get('typeLabel'), '未取得を推測しない');
            Assert.isFalse(
                ((List<Map<String, Object>>) data.get('fields'))[0].containsKey('typeLabel'),
                '元の定義を変更しない'
            );
            Test.stopTest();
        }
    }
    /** 分類と所有者を項目名で対応 */
    @IsTest
    static void mapsClassificationOwnersById() {
        System.runAs(testUser) {
            Test.startTest();
            List<FieldDefinition> records = (List<FieldDefinition>) JSON.deserialize(
                '[{"QualifiedApiName":"Name","ComplianceGroup":"PII","BusinessOwnerId":"' +
                    String.valueOf(testUser.Id) +
                    '"},{"QualifiedApiName":"AccountNumber"},{"QualifiedApiName":"NoSuchField"}]',
                List<FieldDefinition>.class
            );
            Map<String, Object> view = service.createRows(
                records,
                Account.SObjectType,
                new Map<Id, String>{ testUser.Id => '所有者' }
            );
            Assert.areEqual(2, view.size(), '実在する可視項目だけを表示');
            Assert.areEqual('所有者', ((Map<String, Object>) view.get('Name')).get('ownerLabel'), '同じIDの名前を表示');
            Assert.areEqual(true, ((Map<String, Object>) view.get('Name')).get('editable'), '標準項目も編集可能');
            Assert.areEqual(new Set<Id>{ testUser.Id }, service.collectOwnerIds(records), '未設定を除きIDを集約');
            Test.stopTest();
        }
    }
    /** 日時と人物を同じ項目IDで照合 */
    @IsTest
    static void mapsAuditOnlyToRequestedField() {
        System.runAs(testUser) {
            Test.startTest();
            Id fieldId = Id.valueOf('00N' + String.valueOf(1).leftPad(12, '0'));
            Map<String, Object> record = new Map<String, Object>{
                'Id' => String.valueOf(fieldId),
                'CreatedDate' => '2026-01-01T00:00:00.000Z',
                'LastModifiedDate' => '2026-01-02T00:00:00.000Z',
                'CreatedById' => String.valueOf(testUser.Id),
                'LastModifiedById' => String.valueOf(testUser.Id)
            };
            List<Map<String, Object>> records = service.readAuditRecords(
                new Map<String, Object>{ 'done' => true, 'records' => new List<Object>{ record } }
            );
            List<User> users = (List<User>) JSON.deserialize(
                '[{"Id":"' + String.valueOf(testUser.Id) + '","Name":"作成者"}]',
                List<User>.class
            );
            Map<String, Object> view = service.createAuditView(
                new Map<Id, String>{ fieldId => 'Sample__c' },
                records,
                users
            );
            Assert.areEqual(
                '作成者',
                ((Map<String, Object>) view.get('Sample__c')).get('createdByName'),
                '同じユーザーIDの表示名を使用'
            );
            Assert.areEqual(new Set<Id>{ testUser.Id }, service.collectAuditUserIds(records), '作成・更新者を重複排除');
            Assert.isTrue(
                service.createAuditQuery(new Set<Id>{ fieldId }).contains(String.valueOf(fieldId)),
                '要求IDだけを照会'
            );
            Assert.areEqual(1, service.createAuditBatches(new Set<Id>{ fieldId }).size(), '小さい対象は一括');
            Test.stopTest();
        }
    }
    /** 日時照会の分割境界 */
    @IsTest
    static void splitsAuditAtBoundary() {
        System.runAs(testUser) {
            Test.startTest();
            Set<Id> ids = new Set<Id>();
            for (Integer i = 0; i < 201; i++) {
                ids.add((Id) ('00N' + String.valueOf(i).leftPad(12, '0')));
            }
            List<Set<Id>> batches = service.createAuditBatches(ids);
            Assert.areEqual(2, batches.size(), '上限超過分を次の要求へ分割');
            Assert.areEqual(200, batches[0].size(), '先頭要求の上限を維持');
            Assert.areEqual(1, batches[1].size(), '端数を欠落させない');
            Test.stopTest();
        }
    }
    /** 未完了の日時応答を拒否 */
    @IsTest
    static void rejectsIncompleteAudit() {
        System.runAs(testUser) {
            Test.startTest();
            try {
                service.readAuditRecords(new Map<String, Object>{ 'done' => false, 'records' => new List<Object>() });
                Assert.fail('部分応答を拒否');
            } catch (AuraHandledException error) {
                Assert.isNotNull(error, '未完了を通知');
            }
            Test.stopTest();
        }
    }
    /** 要求した日時の欠落を拒否 */
    @IsTest
    static void rejectsMissingAuditField() {
        System.runAs(testUser) {
            Test.startTest();
            try {
                service.createAuditView(
                    new Map<Id, String>{ Id.valueOf('00N' + String.valueOf(1).leftPad(12, '0')) => 'Sample__c' },
                    new List<Map<String, Object>>(),
                    new List<User>()
                );
                Assert.fail('未取得を成功扱いしない');
            } catch (AuraHandledException error) {
                Assert.isNotNull(error, '欠落を通知');
            }
            Test.stopTest();
        }
    }
    /** 標準項目の日時取得を除外 */
    @IsTest
    static void excludesStandardAuditTargets() {
        System.runAs(testUser) {
            Test.startTest();
            List<FieldDefinition> definitions = (List<FieldDefinition>) JSON.deserialize(
                '[{"QualifiedApiName":"Name","DurableId":"Account.Name"}]',
                List<FieldDefinition>.class
            );
            Assert.isTrue(
                service.createAuditTargets(
                        Account.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED),
                        definitions
                    )
                    .isEmpty(),
                '標準項目はTooling日時取得対象外'
            );
            Assert.isTrue(
                service.createAuditTargets(
                        Account.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED),
                        new List<FieldDefinition>()
                    )
                    .isEmpty(),
                '空対象を補完しない'
            );
            Test.stopTest();
        }
    }
}
