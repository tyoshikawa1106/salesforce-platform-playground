/** バッチによる全件削除、部分失敗、対象外保護を検証 */
@IsTest
private with sharing class TestDataDeleteBatchTest {
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
        System.runAs(TestDataFactory.getTestUser()) {
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

    @IsTest
    static void finishEnqueuesExactlyOneNextStage() {
        System.runAs(TestDataFactory.getTestUser()) {
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
            System.abortJob(currentJob);
            System.abortJob(next[0].Id);
            Test.stopTest();
        }
    }

    @IsTest
    static void remainingChildPreventsParentLaunch() {
        System.runAs(TestDataFactory.getTestUser()) {
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
    @IsTest
    static void deletesAllAccountsInSingleScope() {
        System.runAs(TestDataFactory.getTestUser()) {
            List<Account> accounts = new List<Account>();
            for (Integer index = 0; index < 251; index++) {
                accounts.add(
                    TestDataFactory.createAccount('任意の名称' + index, TestDataFactory.SaveMode.DO_NOT_INSERT)
                );
            }
            insert accounts;
            TestDataDeleteBatchWrapper plan = new TestDataDeleteBatchWrapper();
            plan.position = plan.objectNames.indexOf('Account');
            Test.startTest();
            Id jobId = Database.executeBatch(new TestDataDeleteBatch(plan), 400);
            Test.stopTest();
            Assert.areEqual(0, [SELECT COUNT() FROM Account], '識別プレフィックスなしでも全件削除');
            List<AsyncApexJob> jobs = [SELECT Status, NumberOfErrors FROM AsyncApexJob WHERE Id = :jobId];
            Assert.areEqual('Completed', jobs[0].Status, '最終オブジェクトで正常終了');
            Assert.areEqual(0, jobs[0].NumberOfErrors, 'スコープ例外なし');
        }
    }
    @IsTest
    static void deletesTwoScopesAndPreservesParentUntilChildrenAreGone() {
        System.runAs(TestDataFactory.getTestUser()) {
            Account parent = TestDataFactory.createAccount('親の保持確認', TestDataFactory.SaveMode.INSERT_RECORD);
            List<Contact> contacts = new List<Contact>();
            List<SObject> firstScope = new List<SObject>();
            List<SObject> secondScope = new List<SObject>();
            for (Integer index = 0; index < 251; index++) {
                contacts.add(new Contact(LastName = '分割確認' + index, AccountId = parent.Id));
            }
            insert contacts;
            for (Integer index = 0; index < contacts.size(); index++) {
                if (index < 200) {
                    firstScope.add(contacts[index]);
                } else {
                    secondScope.add(contacts[index]);
                }
            }
            TestDataDeleteBatchWrapper plan = new TestDataDeleteBatchWrapper();
            plan.position = plan.objectNames.indexOf('Contact');
            TestDataDeleteBatch batch = new TestDataDeleteBatch(plan);
            Test.startTest();
            batch.execute(null, firstScope);
            Assert.areEqual(51, [SELECT COUNT() FROM Contact], '最初のスコープのみ削除');
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
            Assert.areEqual(251, result.get('successCount'), '200件と51件の集計を保持');
            Assert.areEqual(251, result.get('totalSuccessCount'), '全体の通知件数も集計');
            Assert.areEqual(0, result.get('failureCount'), '全スコープ成功');
        }
    }

    @IsTest
    static void preservesPartialFailureAcrossScopes() {
        System.runAs(TestDataFactory.getTestUser()) {
            Account first = TestDataFactory.createAccount('前半', TestDataFactory.SaveMode.INSERT_RECORD);
            Account gone = TestDataFactory.createAccount('既削除', TestDataFactory.SaveMode.INSERT_RECORD);
            Account last = TestDataFactory.createAccount('後半', TestDataFactory.SaveMode.INSERT_RECORD);
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
    @IsTest
    static void rejectsInvalidPlanBeforeDml() {
        System.runAs(TestDataFactory.getTestUser()) {
            Account account = TestDataFactory.createAccount('保持', TestDataFactory.SaveMode.INSERT_RECORD);
            TestDataDeleteBatchWrapper plan = new TestDataDeleteBatchWrapper();
            plan.objectNames[0] = 'User';
            Test.startTest();
            new TestDataDeleteBatch(plan).execute(null, new List<SObject>{ account });
            Test.stopTest();
            Assert.areEqual(1, [SELECT COUNT() FROM Account], '不正な計画ではスコープを削除しない');
        }
    }
}
