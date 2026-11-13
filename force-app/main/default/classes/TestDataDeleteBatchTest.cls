/** バッチによる全件削除、部分失敗、対象外保護を検証 */
@IsTest
private with sharing class TestDataDeleteBatchTest {

    private static TestDataDeleteService service = new TestDataDeleteService();

    private static User testUser = new User(Id = UserInfo.getUserId());

    private static Boolean deletionAllowed = service.getEnvironment(
        [SELECT IsSandbox, OrganizationType, TrialExpirationDate FROM Organization LIMIT 1]
    ) == TestDataDeleteService.Environment.DEVELOPMENT;
    private static String environmentError = deletionAllowed ? '' : '開発組織と「すべてのデータの編集」権限が必要です。';

    /** 保持された状態から停止理由と完了位置を確認
     * @param batch 検証するバッチの実行後状態
     * @return 保持された計画と集計値
     */
    private static TestDataDeleteBatchWrapper readState(TestDataDeleteBatch batch) {
        Map<String, Object> state = (Map<String, Object>) JSON.deserializeUntyped(JSON.serialize(batch));
        return (TestDataDeleteBatchWrapper) JSON.deserialize(JSON.serialize(state.get('wrapper')), TestDataDeleteBatchWrapper.class);
    }

    /** テスト内の標準ジョブをfinishへ渡すコンテキスト */
    private class Context implements Database.BatchableContext {
        private Id jobId;
        /** 標準ジョブをfinish用に保持
         * @param jobId テスト内の標準ジョブ
         */
        private Context(Id jobId) {
            this.jobId = jobId;
        }
        /** 現在のジョブを返却
         * @return テスト対象のジョブ
         */
        public Id getJobId() {
            return this.jobId;
        }
        /** 子ワーカーなしのコンテキストを表現
         * @return 子ワーカージョブなし
         */
        public Id getChildJobId() {
            return null;
        }
    }

    /** 最後の段階は後続を作らずメールを一度だけ送る */
    @IsTest
    static void finalStageSendsOneMailWithoutNextJob() {

        System.runAs(testUser) {
            TestDataDeleteBatchWrapper last = new TestDataDeleteBatchWrapper();
            last.position = last.objectNames.indexOf('Account');
            Test.startTest();
            Id jobId = Database.executeBatch(new TestDataDeleteBatch(last), 200);
            TestDataDeleteBatch batch = new TestDataDeleteBatch(last);
            batch.finish(new Context(jobId));
            TestDataDeleteBatchWrapper state = readState(batch);
            Assert.areEqual(environmentError, state.errorMessage, '正常終了と環境による途中停止を区別');
            Assert.areEqual(deletionAllowed ? last.objectNames.size() : last.position, state.position, '許可時だけ最終段階を完了');
            Assert.areEqual(1, Limits.getEmailInvocations(), '全体終了で一通だけ送信');
            Assert.areEqual(
                1,
                [
                    SELECT COUNT()
                    FROM AsyncApexJob
                    WHERE ApexClass.Name = 'TestDataDeleteBatch' AND JobType = 'BatchApex'
                ],
                '後続は起動しない'
            );
            System.abortJob(jobId);
            Test.stopTest();
        }
    }

    /** 完了後に次の段階を一つだけ登録 */
    @IsTest
    static void finishEnqueuesExactlyOneNextStage() {

        System.runAs(testUser) {
            TestDataDeleteBatchWrapper last = new TestDataDeleteBatchWrapper();
            last.position = last.objectNames.indexOf('Account');
            TestDataDeleteBatchWrapper current = new TestDataDeleteBatchWrapper();
            current.position = current.objectNames.indexOf('Product2');
            Test.startTest();
            Id currentJob = Database.executeBatch(new TestDataDeleteBatch(last), 200);
            TestDataDeleteBatch batch = new TestDataDeleteBatch(current);
            batch.finish(new Context(currentJob));
            Assert.areEqual(environmentError, readState(batch).errorMessage, '次段階の受付前に環境判定を適用');
            List<AsyncApexJob> next = [
                SELECT Id
                FROM AsyncApexJob
                WHERE ApexClass.Name = 'TestDataDeleteBatch' AND JobType = 'BatchApex' AND Id != :currentJob
            ];
            Assert.areEqual(deletionAllowed ? 1 : 0, next.size(), '許可された環境でだけ次の親へ一ジョブ登録');
            Assert.areEqual(deletionAllowed ? 0 : 1, Limits.getEmailInvocations(), '環境拒否の場合だけ途中停止を通知');
            try {
                new TestDataDeleteBatch(last).start(new Context(currentJob));
                Assert.fail('別のジョブが残る間は開始を拒否');
            } catch (TestDataDeleteBatch.DeleteRunException e) {
                Assert.isTrue(deletionAllowed ? e.getMessage().contains('別の削除ジョブ') : e.getMessage() == environmentError, '重複または環境拒否の理由を区別');
            }
            System.abortJob(currentJob);
            if (deletionAllowed) { System.abortJob(next[0].Id); }
            Test.stopTest();
        }
    }

    /** 子レコード残存時は親の削除を開始しない */
    @IsTest
    static void remainingChildPreventsParentLaunch() {

        System.runAs(testUser) {
            insert new Product2(Name = '残存商品');
            TestDataDeleteBatchWrapper last = new TestDataDeleteBatchWrapper();
            last.position = last.objectNames.indexOf('Account');
            TestDataDeleteBatchWrapper current = new TestDataDeleteBatchWrapper();
            current.position = current.objectNames.indexOf('Product2');
            Test.startTest();
            Id jobId = Database.executeBatch(new TestDataDeleteBatch(last), 200);
            TestDataDeleteBatch batch = new TestDataDeleteBatch(current);
            batch.finish(new Context(jobId));
            Assert.areEqual(environmentError, readState(batch).errorMessage, '残件数確認と環境拒否を区別');
            Assert.areEqual(current.position, readState(batch).position, '途中停止では親へ進めない');
            Assert.areEqual(1, Limits.getEmailInvocations(), '残件がある場合も一通だけ通知');
            Assert.areEqual(
                1,
                [
                    SELECT COUNT()
                    FROM AsyncApexJob
                    WHERE ApexClass.Name = 'TestDataDeleteBatch' AND JobType = 'BatchApex'
                ],
                '親ジョブを作成しない'
            );
            System.abortJob(jobId);
            Test.stopTest();
        }
    }

    /** 一スコープで全取引先を削除 */
    @IsTest
    static void deletesAllAccountsInSingleScope() {

        System.runAs(testUser) {
            List<Account> accounts = new List<Account>{
                new Account(Name = '任意の名称A'), new Account(Name = '任意の名称B')
            };
            insert accounts;
            TestDataDeleteBatchWrapper plan = new TestDataDeleteBatchWrapper();
            plan.position = plan.objectNames.indexOf('Account');
            Test.startTest();
            if (deletionAllowed) {
                Id jobId = Database.executeBatch(new TestDataDeleteBatch(plan), 2);
                Test.stopTest();
                Assert.areEqual(0, [SELECT COUNT() FROM Account], '識別プレフィックスなしでも全件削除');
                List<AsyncApexJob> jobs = [SELECT Status, NumberOfErrors FROM AsyncApexJob WHERE Id = :jobId];
                Assert.areEqual('Completed', jobs[0].Status, '最終オブジェクトで正常終了');
                Assert.areEqual(0, jobs[0].NumberOfErrors, 'スコープ例外なし');
            } else {
                TestDataDeleteBatch batch = new TestDataDeleteBatch(plan);
                try {
                    batch.start(null);
                    Assert.fail('許可外環境では開始を拒否');
                } catch (TestDataDeleteBatch.DeleteRunException e) {
                    Assert.areEqual(environmentError, e.getMessage(), '環境による開始拒否を確認');
                }
                batch.execute(null, accounts);
                Test.stopTest();
                Assert.areEqual(2, [SELECT COUNT() FROM Account], '許可外環境では取引先を保持');
                Assert.areEqual(environmentError, readState(batch).errorMessage, 'スコープも同じ理由で停止');
            }
        }
    }

    /** 子を分割削除しても親を保持 */
    @IsTest
    static void deletesTwoScopesAndPreservesParentUntilChildrenAreGone() {

        System.runAs(testUser) {
            Account parent = new Account(Name = '親の保持確認');
            insert parent;
            List<Contact> contacts = new List<Contact>{
                new Contact(LastName = '前半', AccountId = parent.Id),
                new Contact(LastName = '後半', AccountId = parent.Id)
            };
            insert contacts;
            List<SObject> firstScope = new List<SObject>{ contacts[0] };
            List<SObject> secondScope = new List<SObject>{ contacts[1] };
            TestDataDeleteBatchWrapper plan = new TestDataDeleteBatchWrapper();
            plan.position = plan.objectNames.indexOf('Contact');
            TestDataDeleteBatch batch = new TestDataDeleteBatch(plan);
            Test.startTest();
            batch.execute(null, firstScope);
            Assert.areEqual(deletionAllowed ? 1 : 2, [SELECT COUNT() FROM Contact], '許可時だけ最初のスコープを削除');
            Assert.areEqual(1, [SELECT COUNT() FROM Account], '子の残存中は親を保持');
            TestDataDeleteBatch restored = (TestDataDeleteBatch) JSON.deserialize(
                JSON.serialize(batch),
                TestDataDeleteBatch.class
            );
            restored.execute(null, secondScope);
            Test.stopTest();
            Assert.areEqual(deletionAllowed ? 0 : 2, [SELECT COUNT() FROM Contact], '許可時だけ二つ目のスコープまで削除');
            Assert.areEqual(1, [SELECT COUNT() FROM Account], 'Contact処理でAccountを削除しない');
            Map<String, Object> state = (Map<String, Object>) JSON.deserializeUntyped(JSON.serialize(restored));
            Map<String, Object> result = (Map<String, Object>) state.get('wrapper');
            Assert.areEqual(deletionAllowed ? 2 : 0, result.get('successCount'), '実行したスコープだけを集計');
            Assert.areEqual(environmentError, result.get('errorMessage'), '拒否したスコープを成功と扱わない');
            Assert.areEqual(deletionAllowed ? 2 : 0, result.get('totalSuccessCount'), '全体の通知件数も集計');
            Assert.areEqual(0, result.get('failureCount'), '全スコープ成功');
        }
    }

    /** 部分失敗をスコープ間で保持 */
    @IsTest
    static void preservesPartialFailureAcrossScopes() {

        System.runAs(testUser) {
            Account first = new Account(Name = '前半');
            insert first;
            Account gone = new Account(Name = '既削除');
            insert gone;
            Account last = new Account(Name = '後半');
            insert last;
            delete gone;
            TestDataDeleteBatchWrapper plan = new TestDataDeleteBatchWrapper();
            plan.position = plan.objectNames.indexOf('Account');
            TestDataDeleteBatch batch = new TestDataDeleteBatch(plan);
            Test.startTest();
            batch.execute(null, new List<SObject>{ first, gone });
            TestDataDeleteBatch restored = (TestDataDeleteBatch) JSON.deserialize(
                JSON.serialize(batch),
                TestDataDeleteBatch.class
            );
            restored.execute(null, new List<SObject>{ last });
            Test.stopTest();
            Map<String, Object> state = (Map<String, Object>) JSON.deserializeUntyped(JSON.serialize(restored));
            Map<String, Object> result = (Map<String, Object>) state.get('wrapper');
            Assert.areEqual(deletionAllowed ? 2 : 0, result.get('successCount'), '成功をスコープ間で累積');
            Assert.areEqual(environmentError, result.get('errorMessage'), 'DML部分失敗と環境による停止を区別');
            Assert.areEqual(deletionAllowed ? 0 : 2, [SELECT COUNT() FROM Account], '拒否された場合は未削除レコードを保持');
            Assert.areEqual(deletionAllowed ? 1 : 0, result.get('failureCount'), '環境拒否をDML失敗として集計しない');
        }
    }

    /** 不正な削除計画ではDMLを実行しない */
    @IsTest
    static void rejectsInvalidPlanBeforeDml() {

        System.runAs(testUser) {
            Account account = new Account(Name = '保持');
            insert account;
            TestDataDeleteBatchWrapper plan = new TestDataDeleteBatchWrapper();
            plan.objectNames[0] = 'User';
            Test.startTest();
            TestDataDeleteBatch batch = new TestDataDeleteBatch(plan);
            try {
                batch.start(null);
                Assert.fail('不正な計画では開始も拒否');
            } catch (TestDataDeleteBatch.DeleteRunException e) {
                Assert.areEqual(deletionAllowed ? '削除対象の定義が不正です。' : environmentError, e.getMessage(), '計画不正と環境拒否を区別');
            }
            batch.execute(null, new List<SObject>{ account });
            batch.finish(null);
            Assert.areEqual(1, Limits.getEmailInvocations(), '途中停止を一回通知');
            Test.stopTest();
            Assert.areEqual(1, [SELECT COUNT() FROM Account], '不正な計画ではスコープを削除しない');
        }
    }
}