/** 分類の競合検出・更新準備・保存結果 */
@IsTest
private with sharing class ObjectExplorerClassifyServiceTest {

    private static ObjectExplorerClassifyService service = new ObjectExplorerClassifyService();
    private static ObjectExplorerClassifyService.Preparation preparation = new ObjectExplorerClassifyService.Preparation();
    private static ObjectExplorerClassifyService.SaveResults results = new ObjectExplorerClassifyService.SaveResults();

    private static User testUser = new User(Id = UserInfo.getUserId());

    /** 送信成功は再取得による確認まで保留 */
    @IsTest
    static void keepsSuccessfulResultsPendingVerification() {

        System.runAs(testUser) {
            Test.startTest();
            ObjectExplorerClassifyService.FieldContext source = context(false);
            source.sent = true;
            List<ObjectExplorerClassifyService.FieldContext> updated = results.applyUpdateResults(
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
                results.selectUpdates(new List<ObjectExplorerClassifyService.FieldContext>{ pending })
                    .keySet(),
                '標準の変更行だけ選ぶ'
            );
            List<ObjectExplorerClassifyService.FieldContext> rejected = results.applyUpdateResults(
                new List<ObjectExplorerClassifyService.FieldContext>{ pending },
                new Map<String, String>{ 'Account.Name' => '拒否' }
            );
            Assert.areEqual('[OE-SAVE-REJECTED] APIによる更新拒否：拒否', rejected[0].result.get('message'), '明示拒否は確認不能と区別');
            Assert.isFalse(pending.completed, '元の状態を変更しない');
            List<ObjectExplorerClassifyService.FieldContext> unchanged = results.failPendingFields(
                rejected,
                new SalesforceApiClient.IntegrationException('後続失敗')
            );
            Assert.areEqual('[OE-SAVE-REJECTED] APIによる更新拒否：拒否', unchanged[0].result.get('message'), '確定済み結果を上書きしない');
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

    /** 分類の未設定値を正規化し、空白だけの既存値も保持する */
    @IsTest
    static void preservesEmptyAndWhitespaceClassificationValues() {

        System.runAs(testUser) {
            Test.startTest();
            Map<String, Object> missing = service.snapshot(new Map<String, Object>{'complianceGroup' => null});
            Map<String, Object> empty = service.snapshot(new Map<String, Object>{'complianceGroup' => ''});
            Map<String, Object> whitespace = service.snapshot(new Map<String, Object>{'complianceGroup' => '  '});
            Test.stopTest();
            Assert.areEqual('', missing.get('complianceGroup'), '未設定は空文字へ正規化');
            Assert.areEqual(missing, empty, '空文字も同じ比較基準にする');
            Assert.areEqual('  ', whitespace.get('complianceGroup'), '既存の空白値を別の分類値に変えない');
        }

    }

    /** 一括更新の通信失敗を変更行だけへ反映し確定済み・変更なしを保持 */
    @IsTest
    static void preservesCompletedAndUnchangedFieldsWhenUpdateFails() {
        ObjectExplorerClassifyService.FieldContext pending = context(false);
        pending.expected.put('complianceGroup', 'PII');
        pending.sent = true;
        ObjectExplorerClassifyService.FieldContext completed = new ObjectExplorerClassifyService.FieldContext(pending);
        completed.fieldName = 'Phone';
        completed.completed = true;
        completed.result = new Map<String, Object>{'apiName' => 'Phone', 'success' => true};
        ObjectExplorerClassifyService.FieldContext unchanged = context(false);
        unchanged.fieldName = 'Description';
        ObjectExplorerClassifyService.FieldContext custom = new ObjectExplorerClassifyService.FieldContext(pending);
        custom.fieldName = 'Custom__c';
        custom.customField = true;
        List<ObjectExplorerClassifyService.FieldContext> contexts = new List<ObjectExplorerClassifyService.FieldContext>{custom, pending, completed, unchanged};

        System.runAs(testUser) {
            Test.startTest();
            List<ObjectExplorerClassifyService.FieldContext> updated = results.failUpdates(contexts, new SalesforceApiClient.IntegrationException('一括通信失敗'));
            Test.stopTest();
            Assert.areEqual(contexts.size(), updated.size(), '項目数と入力順を維持');
            Assert.areEqual(false, updated[0].result.get('success'), '同じ一括要求のカスタム項目も結果不明とする');
            Assert.areEqual('Name', updated[1].fieldName, '同じ位置の標準変更行だけを対象にする');
            Assert.areEqual(false, updated[1].result.get('success'), '通信失敗を成功にしない');
            Assert.isTrue(String.valueOf(updated[1].result.get('message')).contains('更新結果を確認できませんでした'), '送信後の確認不能を維持');
            Assert.areEqual(completed.result, updated[2].result, '確定済み結果を上書きしない');
            Assert.areEqual(unchanged, updated[3], '変更なしの標準項目を失敗にしない');
            Assert.isFalse(pending.completed, '元の項目状態を変更しない');
            Assert.isTrue(updated[1].completed, '生成した失敗結果は確定させる');
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
            } catch (SalesforceApiClient.IntegrationException error) {
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

    /** 個別更新が必要なカスタム項目だけを入力順で選択 */
    @IsTest
    static void selectsOnlyChangedPendingCustomFields() {
        ObjectExplorerClassifyService.FieldContext changed = context(true);
        changed.expected = new Map<String, Object>{ 'businessStatus' => 'Active' };
        ObjectExplorerClassifyService.FieldContext completed = new ObjectExplorerClassifyService.FieldContext(changed);
        completed.completed = true;
        ObjectExplorerClassifyService.FieldContext unchanged = context(true);
        unchanged.expected = unchanged.original;
        ObjectExplorerClassifyService.FieldContext standard = new ObjectExplorerClassifyService.FieldContext(changed);
        standard.customField = false;
        List<ObjectExplorerClassifyService.FieldContext> contexts = new List<ObjectExplorerClassifyService.FieldContext>{
            changed, completed, unchanged, standard, new ObjectExplorerClassifyService.FieldContext(changed)
        };

        contexts[0].fieldName = 'First__c';
        contexts[4].fieldName = 'Second__c';
        System.runAs(testUser) {
            Test.startTest();
            Map<String, Integer> indexes = results.getCustomReadIndexes(contexts);
            Test.stopTest();
            Assert.areEqual(new Map<String,Integer>{'Account.First__c'=>0,'Account.Second__c'=>4}, indexes, '未確定かつ変更のあるカスタム項目を完全名と入力位置で照合');
            Assert.isFalse(changed.sent, '選択だけでは送信状態を変更しない');
            Assert.areEqual(5, contexts.size(), '入力の項目一覧を変更しない');
        }
    }

    /** 編集開始時の分類がnullなら保存準備を拒否 */
    @IsTest
    static void rejectsMissingOriginalClassification() {

        System.runAs(testUser) {
            Test.startTest();
            Map<String, Object> baseline = service.snapshot(new Map<String, Object>());
            try {
                service.prepareUpdate(new Map<String, Object>(), null, baseline);
                Assert.fail('編集開始時の分類がなければ拒否');
            } catch (AuraHandledException e) {
                Assert.isTrue(e.getMessage().contains('不正'), '入力不正を明示');
            }
            Test.stopTest();
        }
    }

    /** 編集後の分類がnullなら保存準備を拒否 */
    @IsTest
    static void rejectsMissingDraftClassification() {

        System.runAs(testUser) {
            Test.startTest();
            Map<String, Object> baseline = service.snapshot(new Map<String, Object>());
            try {
                service.prepareUpdate(new Map<String, Object>(), baseline, null);
                Assert.fail('編集後の分類がなければ拒否');
            } catch (AuraHandledException e) {
                Assert.isTrue(e.getMessage().contains('不正'), '入力不正を明示');
            }
            Test.stopTest();
        }
    }

    /** 一項目の事前失敗が他の項目の準備を取り消さない */
    @IsTest
    static void preparesFieldsWithIndividualFailures() {

        System.runAs(testUser) {
            ObjectExplorerClassifyService.FieldContext valid = context(false);
            ObjectExplorerClassifyService.FieldContext missing = context(false);
            missing.fieldName = 'Missing__c';
            Test.startTest();
            List<ObjectExplorerClassifyService.FieldContext> prepared = preparation.prepareFields(new List<ObjectExplorerClassifyService.FieldContext>{ valid, missing }, new Map<String, Map<String, Object>>{ 'Name' => nativeRow() }, new Map<Id, SObject>());
            Test.stopTest();
            Assert.areEqual(2, prepared.size(), '入力順と件数を維持');
            Assert.areEqual('Account.Name', prepared[0].metadata.get('fullName'), '正常な項目を準備');
            Assert.isTrue(prepared[1].completed, '失敗した項目だけを確定');
            Assert.areEqual(false, prepared[1].result.get('success'), '未取得の定義を保存しない');
        }
    }

}