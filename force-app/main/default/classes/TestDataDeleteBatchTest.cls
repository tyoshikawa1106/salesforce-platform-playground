/** バッチによる全件削除、部分失敗、対象外保護を検証 */
@IsTest
private with sharing class TestDataDeleteBatchTest {

    private static User testUser = new User(Id = UserInfo.getUserId());

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
            new TestDataDeleteBatch(last).finish(new Context(jobId));
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
            new TestDataDeleteBatch(current).finish(new Context(currentJob));
            List<AsyncApexJob> next = [
                SELECT Id
                FROM AsyncApexJob
                WHERE ApexClass.Name = 'TestDataDeleteBatch' AND JobType = 'BatchApex' AND Id != :currentJob
            ];
            Assert.areEqual(1, next.size(), '次の親へ一ジョブだけ登録');
            Assert.areEqual(0, Limits.getEmailInvocations(), '途中段階では通知しない');
            try {
                new TestDataDeleteBatch(last).start(new Context(currentJob));
                Assert.fail('別のジョブが残る間は開始を拒否');
            } catch (TestDataDeleteBatch.DeleteRunException e) {
                Assert.isTrue(e.getMessage().contains('別の削除ジョブ'), '重複起動の理由を返す');
            }
            System.abortJob(currentJob);
            System.abortJob(next[0].Id);
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
            new TestDataDeleteBatch(current).finish(new Context(jobId));
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
            Id jobId = Database.executeBatch(new TestDataDeleteBatch(plan), 2);
            Test.stopTest();
            Assert.areEqual(0, [SELECT COUNT() FROM Account], '識別プレフィックスなしでも全件削除');
            List<AsyncApexJob> jobs = [SELECT Status, NumberOfErrors FROM AsyncApexJob WHERE Id = :jobId];
            Assert.areEqual('Completed', jobs[0].Status, '最終オブジェクトで正常終了');
            Assert.areEqual(0, jobs[0].NumberOfErrors, 'スコープ例外なし');
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
            Assert.areEqual(1, [SELECT COUNT() FROM Contact], '最初のスコープのみ削除');
            Assert.areEqual(1, [SELECT COUNT() FROM Account], '子の残存中は親を保持');
            TestDataDeleteBatch restored = (TestDataDeleteBatch) JSON.deserialize(
                JSON.serialize(batch),
                TestDataDeleteBatch.class
            );
            restored.execute(null, secondScope);
            Test.stopTest();
            Assert.areEqual(0, [SELECT COUNT() FROM Contact], '二つ目のスコープまで削除');
            Assert.areEqual(1, [SELECT COUNT() FROM Account], 'Contact処理でAccountを削除しない');
            Map<String, Object> state = (Map<String, Object>) JSON.deserializeUntyped(JSON.serialize(restored));
            Map<String, Object> result = (Map<String, Object>) state.get('wrapper');
            Assert.areEqual(2, result.get('successCount'), '各スコープの集計を保持');
            Assert.areEqual(2, result.get('totalSuccessCount'), '全体の通知件数も集計');
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
            Assert.areEqual(2, result.get('successCount'), '成功をスコープ間で累積');
            Assert.areEqual(1, result.get('failureCount'), '前スコープの失敗を保持');
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
                Assert.isNotNull(e.getMessage(), '計画の拒否理由を返す');
            }
            batch.execute(null, new List<SObject>{ account });
            batch.finish(null);
            Assert.areEqual(1, Limits.getEmailInvocations(), '途中停止を一回通知');
            Test.stopTest();
            Assert.areEqual(1, [SELECT COUNT() FROM Account], '不正な計画ではスコープを削除しない');
        }
    }
}
