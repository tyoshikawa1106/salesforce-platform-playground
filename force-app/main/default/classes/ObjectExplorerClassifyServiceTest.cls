/** 分類の競合検出・更新準備・保存結果 */
@IsTest
private with sharing class ObjectExplorerClassifyServiceTest {
    private static ObjectExplorerClassifyService service = new ObjectExplorerClassifyService();
    private static ObjectExplorerClassifyService.Preparation preparation = new ObjectExplorerClassifyService.Preparation();
    private static ObjectExplorerClassifyService.SaveResults results = new ObjectExplorerClassifyService.SaveResults();

    private static User testUser = TestDataFactory.getTestUser();

    /** 送信成功は再取得による確認まで保留 */
    @IsTest
    static void keepsSuccessfulResultsPendingVerification() {
        System.runAs(testUser) {
            Test.startTest();
            ObjectExplorerClassifyService.FieldContext source = context(false);
            source.sent = true;
            List<ObjectExplorerClassifyService.FieldContext> updated = results.applyStandardResults(
                new List<ObjectExplorerClassifyService.FieldContext>{ source },
                new Map<String, String>{ 'Account.Name' => '' }
            );
            Assert.areEqual(false, updated[0].completed, '送信成功だけで保存完了にしない');
            Assert.areEqual(true, updated[0].sent, '送信済み状態を保持');
            Assert.areEqual(new Set<String>{ 'Name' }, results.getVerificationNames(updated), '同じ項目を再取得へ渡す');
            Test.stopTest();
        }
    }
    /** 複数値の比較と分類以外の保持 */
    @IsTest
    static void normalizesAndPreservesMetadata() {
        System.runAs(testUser) {
            Test.startTest();
            Map<String, Object> current = new Map<String, Object>{
                'complianceGroup' => 'PII;GDPR;PII',
                'label' => '維持',
                'length' => 80
            };
            Map<String, Object> original = service.snapshot(current);
            Assert.areEqual('GDPR;PII', original.get('complianceGroup'), '重複と順序を正規化');
            Map<String, Object> draft = new Map<String, Object>(original);
            draft.put('complianceGroup', '');
            Map<String, Object> updated = service.prepareUpdate(current, original, draft);
            Assert.isNull(updated.get('complianceGroup'), '解除は明示null');
            Assert.areEqual('維持', updated.get('label'), '分類以外の値を維持');
            Assert.areEqual('PII;GDPR;PII', current.get('complianceGroup'), '入力を変更しない');
            Test.stopTest();
        }
    }
    /** 編集中の分類変更を拒否 */
    @IsTest
    static void rejectsConcurrentClassify() {
        System.runAs(testUser) {
            Test.startTest();
            Map<String, Object> original = service.snapshot(new Map<String, Object>());
            try {
                service.prepareUpdate(new Map<String, Object>{ 'complianceGroup' => 'PII' }, original, original);
                Assert.fail('競合を拒否');
            } catch (AuraHandledException error) {
                Assert.isTrue(error.getMessage().contains('変更'), '競合を通知');
            }
            Test.stopTest();
        }
    }
    /** ユーザーとグループの同時指定を拒否 */
    @IsTest
    static void rejectsTwoOwners() {
        System.runAs(testUser) {
            Test.startTest();
            Map<String, Object> original = service.snapshot(new Map<String, Object>());
            Map<String, Object> draft = new Map<String, Object>(original);
            draft.put('businessOwnerUser', 'owner@example.invalid');
            draft.put('businessOwnerGroup', 'Owners');
            try {
                service.prepareUpdate(new Map<String, Object>(), original, draft);
                Assert.fail('二重所有者を拒否');
            } catch (AuraHandledException error) {
                Assert.isTrue(error.getMessage().contains('どちらか'), '所有者の排他条件を通知');
            }
            Test.stopTest();
        }
    }
    /** 標準項目の更新準備と保存後照合 */
    @IsTest
    static void preparesAndVerifiesStandardField() {
        System.runAs(testUser) {
            Test.startTest();
            ObjectExplorerClassifyService.FieldContext source = context(false);
            ObjectExplorerClassifyService.FieldContext prepared = preparation.prepareField(
                source,
                nativeRow(),
                new Map<Id, SObject>()
            );
            Assert.areEqual('Account.Name', prepared.metadata.get('fullName'), '標準項目の完全名を固定');
            Assert.areEqual('', prepared.expected.get('complianceGroup'), '未設定を保持');
            Assert.isTrue(source.metadata.isEmpty(), '入力状態を変更しない');
            ObjectExplorerClassifyService.FieldContext verified = preparation.verifyField(
                prepared,
                nativeRow(),
                new Map<Id, SObject>()
            );
            Assert.areEqual(true, verified.result.get('success'), '再取得が一致してから成功');
            Assert.isFalse(prepared.completed, '前段の状態を変更しない');
            Assert.areEqual(
                new Set<String>{ 'Name' },
                service.getFieldNames(new List<ObjectExplorerClassifyService.FieldContext>{ source }),
                '取得対象は項目名で集約'
            );
            Test.stopTest();
        }
    }
    /** カスタム項目の非分類属性を保持 */
    @IsTest
    static void preservesCustomDefinition() {
        System.runAs(testUser) {
            Test.startTest();
            ObjectExplorerClassifyService.FieldContext prepared = preparation.prepareField(
                context(true),
                nativeRow(),
                new Map<Id, SObject>()
            );
            Map<String, Object> metadata = new Map<String, Object>{
                'fullName' => 'Account.Name',
                'label' => '維持',
                'length' => 80
            };
            ObjectExplorerClassifyService.FieldContext custom = preparation.prepareCustomField(
                prepared,
                new Map<String, Object>{ 'FullName' => 'Account.Name', 'Metadata' => metadata }
            );
            Assert.areEqual(80, custom.metadata.get('length'), '取得した分類以外の属性を保持');
            Assert.areEqual('維持', custom.metadata.get('label'), 'ラベルを上書きしない');
            Test.stopTest();
        }
    }
    /** API応答の別項目へのマッピングを拒否 */
    @IsTest
    static void rejectsDifferentDefinition() {
        System.runAs(testUser) {
            Test.startTest();
            Map<String, Object> row = nativeRow();
            row.put('DurableId', 'Account.Phone');
            try {
                preparation.prepareField(context(false), row, new Map<Id, SObject>());
                Assert.fail('別項目を拒否');
            } catch (AuraHandledException error) {
                Assert.isTrue(error.getMessage().contains('一致'), '完全ID不一致を通知');
            }
            Test.stopTest();
        }
    }
    /** 所有者の競合を拒否 */
    @IsTest
    static void rejectsChangedOwner() {
        System.runAs(testUser) {
            Test.startTest();
            ObjectExplorerClassifyService.FieldContext source = context(false);
            ((Map<String, Object>) source.change.get('original')).put('ownerId', String.valueOf(testUser.Id));
            try {
                preparation.prepareField(source, nativeRow(), new Map<Id, SObject>());
                Assert.fail('所有者の競合を拒否');
            } catch (AuraHandledException error) {
                Assert.isTrue(error.getMessage().contains('所有者'), '所有者変更を通知');
            }
            Test.stopTest();
        }
    }
    /** 更新後の値不一致を拒否 */
    @IsTest
    static void rejectsVerificationMismatch() {
        System.runAs(testUser) {
            Test.startTest();
            ObjectExplorerClassifyService.FieldContext source = preparation.prepareField(
                context(false),
                nativeRow(),
                new Map<Id, SObject>()
            );
            Map<String, Object> row = nativeRow();
            row.put('ComplianceGroup', 'PII');
            try {
                preparation.verifyField(source, row, new Map<Id, SObject>());
                Assert.fail('未反映を成功扱いしない');
            } catch (AuraHandledException error) {
                Assert.isTrue(error.getMessage().contains('一致'), '更新後不一致を通知');
            }
            Test.stopTest();
        }
    }
    /** 部分結果の保持と例外の安全な公開 */
    @IsTest
    static void keepsPartialResultsAndSafeErrors() {
        System.runAs(testUser) {
            Test.startTest();
            ObjectExplorerClassifyService.FieldContext pending = context(false);
            pending.original.put('complianceGroup', '');
            pending.expected.put('complianceGroup', 'PII');
            pending.sent = true;
            Assert.areEqual(
                new Set<String>{ 'Account.Name' },
                results.selectStandardUpdates(new List<ObjectExplorerClassifyService.FieldContext>{ pending })
                    .keySet(),
                '標準の変更行だけ選ぶ'
            );
            List<ObjectExplorerClassifyService.FieldContext> rejected = results.applyStandardResults(
                new List<ObjectExplorerClassifyService.FieldContext>{ pending },
                new Map<String, String>{ 'Account.Name' => '拒否' }
            );
            Assert.areEqual('拒否', rejected[0].result.get('message'), '明示拒否は確認不能と区別');
            Assert.isFalse(pending.completed, '元の状態を変更しない');
            List<ObjectExplorerClassifyService.FieldContext> unchanged = results.failPendingFields(
                rejected,
                new MetadataApiIntegrationClient.IntegrationException('後続失敗')
            );
            Assert.areEqual('拒否', unchanged[0].result.get('message'), '確定済み結果を上書きしない');
            Assert.isTrue(results.getVerificationNames(unchanged).isEmpty(), '確定行を再取得しない');
            Assert.areEqual(1, results.createSaveResults(unchanged).size(), '入力順の結果を返す');
            ObjectExplorerClassifyService.FieldContext unknown = results.failField(
                pending,
                new IllegalArgumentException('内部情報')
            );
            Assert.isFalse(((String) unknown.result.get('message')).contains('内部情報'), '内部例外を漏らさない');
            Assert.isTrue(((String) unknown.result.get('message')).contains('確認できません'), '送信後の不明を明示');
            Test.stopTest();
        }
    }
    /** 結果未確定を拒否 */
    @IsTest
    static void rejectsUnfinishedResult() {
        System.runAs(testUser) {
            Test.startTest();
            try {
                results.createSaveResults(new List<ObjectExplorerClassifyService.FieldContext>{ context(false) });
                Assert.fail('未確定を成功扱いしない');
            } catch (MetadataApiIntegrationClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('確認'), '未確定を通知');
            }
            Test.stopTest();
        }
    }
    private static Map<String, Object> values() {
        return new Map<String, Object>{
            'complianceGroup' => '',
            'securityClassification' => '',
            'businessStatus' => '',
            'ownerId' => ''
        };
    }
    private static ObjectExplorerClassifyService.FieldContext context(Boolean custom) {
        ObjectExplorerClassifyService.FieldContext value = new ObjectExplorerClassifyService.FieldContext();
        value.objectName = 'Account';
        value.fieldName = 'Name';
        value.customField = custom;
        value.definition = (FieldDefinition) JSON.deserialize(
            '{"QualifiedApiName":"Name","DurableId":"Account.Name"}',
            FieldDefinition.class
        );
        value.change = new Map<String, Object>{ 'original' => values(), 'draft' => values() };
        return value;
    }
    private static Map<String, Object> nativeRow() {
        return new Map<String, Object>{
            'QualifiedApiName' => 'Name',
            'DurableId' => 'Account.Name',
            'ComplianceGroup' => null,
            'SecurityClassification' => null,
            'BusinessStatus' => null,
            'BusinessOwnerId' => null
        };
    }
}
