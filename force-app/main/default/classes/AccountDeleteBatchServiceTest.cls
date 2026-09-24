/** AccountDeleteBatchServiceの集計・通知・入力値の保持を確認 */
@IsTest
private with sharing class AccountDeleteBatchServiceTest {

    private static AccountDeleteBatchService service = new AccountDeleteBatchService();
    private static User testUser = TestDataFactory.getTestUser();

    @IsTest
    static void clearsPreviousErrorWhenExecutionIsAllowed() {
        TestDataFactory.assignPermissionSet(testUser.Id, 'LwcAccountDelete');
        System.runAs(testUser) {
            AccountDeleteBatchWrapper current = new AccountDeleteBatchWrapper();
            current.failureCount = 2;
            current.errorMessage = '以前のエラー';
            Test.startTest();
            AccountDeleteBatchWrapper wrapper = service.checkExecutionConditions(current, new List<Account>());
            Test.stopTest();
            Assert.areEqual('', wrapper.errorMessage, '現在の条件を満たせばエラーを解消');
            Assert.areEqual(2, wrapper.failureCount, '実行可能な対象を失敗に加算しない');
            Assert.areEqual('以前のエラー', current.errorMessage, '入力の状態を変更しない');
        }
    }

    @IsTest
    static void preservesPartialSuccess() {
        TestDataFactory.assignPermissionSet(testUser.Id, 'LwcAccountDelete');
        System.runAs(testUser) {
            Account good = TestDataFactory.createAccount('成功', TestDataFactory.SaveMode.INSERT_RECORD);
            Account gone = TestDataFactory.createAccount('削除済み', TestDataFactory.SaveMode.INSERT_RECORD);
            delete gone;
            AccountDeleteBatchWrapper current = new AccountDeleteBatchWrapper();
            Test.startTest();
            List<Database.DeleteResult> results = deleteForResults(new List<Account>{ good, gone });
            AccountDeleteBatchWrapper wrapper = service.aggregateDeleteResults(results, new List<Account>{ good, gone }, current);
            Test.stopTest();
            Assert.areEqual(1, wrapper.successCount, '成功したAccountだけを加算');
            Assert.areEqual(1, wrapper.failureCount, '削除済みAccountは失敗一件');
            Assert.isTrue(wrapper.recordErrors.get(gone.Id).contains('ENTITY_IS_DELETED'), '失敗したレコードのコードを保持');
            String expectedMessage = results[1].getErrors()[0].getMessage();
            AsyncApexJob job = (AsyncApexJob) JSON.deserialize('{"NumberOfErrors":0}', AsyncApexJob.class);
            String body = service.buildBody(job, wrapper);
            Assert.isTrue(body.contains(expectedMessage), '実際の削除エラーをメール本文へ含める');
            Assert.isTrue(body.contains('取引先ID: ' + gone.Id + '\n取引先名: ' + gone.Name + '\nエラーコード:'), 'IDの直下に名前とコードを表示');
            Assert.isFalse(body.contains('取引先ID: ' + good.Id), '成功レコードはエラー詳細へ載せない');
            Assert.isTrue(body.indexOf('【実行条件】') < body.indexOf('【エラー詳細】'), '条件の後に詳細を表示');
            Assert.isTrue(body.contains('・削除対象:'), '条件は箇条書き');
            Assert.isTrue(current.failureReasons.isEmpty(), '入力の理由を変更しない');
            Assert.areEqual(0, current.successCount, '引数の成功件数を変更しない');
            Assert.areEqual(0, current.failureCount, '引数の失敗件数を変更しない');
            Assert.isTrue(current.recordErrors.isEmpty(), '引数のSetを変更しない');
            Assert.areEqual(0, [SELECT COUNT() FROM Account], '正常レコードの削除を維持');
        }
    }

    @IsTest
    static void accumulatesOnlyProvidedState() {
        TestDataFactory.assignPermissionSet(testUser.Id, 'LwcAccountDelete');
        System.runAs(testUser) {
            Account first = TestDataFactory.createAccount('前半', TestDataFactory.SaveMode.INSERT_RECORD);
            Account second = TestDataFactory.createAccount('後半', TestDataFactory.SaveMode.INSERT_RECORD);
            AccountDeleteBatchWrapper initial = new AccountDeleteBatchWrapper();
            Test.startTest();
            List<Database.DeleteResult> firstResults = deleteForResults(new List<Account>{ first });
            List<Database.DeleteResult> secondResults = deleteForResults(new List<Account>{ second });
            AccountDeleteBatchWrapper firstWrapper = service.aggregateDeleteResults(firstResults, new List<Account>{ first }, initial);
            AccountDeleteBatchWrapper secondWrapper = service.aggregateDeleteResults(secondResults, new List<Account>{ second }, firstWrapper);
            AccountDeleteBatchWrapper independent = service.aggregateDeleteResults(secondResults, new List<Account>{ second }, initial);
            Test.stopTest();
            Assert.areEqual(2, secondWrapper.successCount, '引数で渡した件数を累積');
            Assert.areEqual(1, firstWrapper.successCount, '以前の戻り値を変更しない');
            Assert.areEqual(1, independent.successCount, 'Service内に以前の件数を保持しない');
            Assert.areEqual(0, initial.successCount, '最初の入力値を変更しない');
        }
    }

    @IsTest
    static void deletesTwoThousandAccounts() {
        TestDataFactory.assignPermissionSet(testUser.Id, 'LwcAccountDelete');
        System.runAs(testUser) {
            List<Account> accounts = new List<Account>();
            for (Integer i = 0; i < 2000; i++) {
                accounts.add(TestDataFactory.createAccount('件数確認' + i, TestDataFactory.SaveMode.DO_NOT_INSERT));
            }
            insert accounts;
            Test.startTest();
            List<Database.DeleteResult> results = deleteForResults(accounts);
            AccountDeleteBatchWrapper wrapper = service.aggregateDeleteResults(results, accounts, new AccountDeleteBatchWrapper());
            Test.stopTest();
            Assert.areEqual(2000, wrapper.successCount, '全対象を集計');
            Assert.areEqual(0, wrapper.failureCount, '失敗なし');
            Assert.areEqual(0, [SELECT COUNT() FROM Account], '全件削除');
        }
    }

    @IsTest
    static void notifiesZeroCountDuringFinish() {
        System.runAs(testUser) {
            AsyncApexJob job = (AsyncApexJob) JSON.deserialize('{"Status":"Processing","NumberOfErrors":0}', AsyncApexJob.class);
            AccountDeleteBatchWrapper wrapper = new AccountDeleteBatchWrapper();
            Test.startTest();
            Boolean sent = service.finishRun(new List<AsyncApexJob>{ job }, wrapper);
            String body = service.buildBody(job, wrapper);
            Assert.areEqual(1, Limits.getEmailInvocations(), '0件でも通知');
            Test.stopTest();
            Assert.isTrue(sent, 'Serviceは送信受付結果を返す');
            Assert.isTrue(body.contains('削除成功件数（確定済み）: 0'), '0件を表示');
            Assert.isTrue(body.endsWith('なし'), '失敗がないことを明記');
            Assert.isFalse(body.contains('JOB_NOT_FULLY_PROCESSED'), 'Processingを失敗としない');
            Assert.isTrue(body.contains('実行可能な環境: Scratch Org・Developer Edition・Sandbox'), '実行できる環境を通知');
            Assert.isTrue(body.contains('必要な権限: 取引先一括削除の利用権限、および取引先の参照・削除権限'), '必要な権限を通知');
            Assert.isTrue(body.contains('バッチ開始時に実行ユーザーが参照できる取引先全件（法人・個人取引先を含む）'), '削除対象の範囲を通知');
            Assert.isTrue(body.contains('実行ユーザーのレコード削除権限を適用'), 'レコード単位の権限適用を通知');
            Assert.isTrue(body.contains('通常削除（ごみ箱の完全削除は行わない）'), '削除方式を通知');
        }
    }

    @IsTest
    static void rejectsNotificationForNullJobs() {
        System.runAs(testUser) {
            AccountDeleteBatchWrapper wrapper = new AccountDeleteBatchWrapper();
            Test.startTest();
            Boolean sent = service.finishRun(null, wrapper);
            Assert.areEqual(0, Limits.getEmailInvocations(), 'ジョブ情報なしではメール送信しない');
            Test.stopTest();
            Assert.isFalse(sent, 'nullのリストは通知不可として返す');
        }
    }

    @IsTest
    static void rejectsNotificationForEmptyJobs() {
        System.runAs(testUser) {
            AccountDeleteBatchWrapper wrapper = new AccountDeleteBatchWrapper();
            Test.startTest();
            Boolean sent = service.finishRun(new List<AsyncApexJob>(), wrapper);
            Assert.areEqual(0, Limits.getEmailInvocations(), 'ジョブ情報なしではメール送信しない');
            Test.stopTest();
            Assert.isFalse(sent, '空のリストは通知不可として返す');
        }
    }

    @IsTest
    static void reportsJobFailureWithoutGuessingRecordCount() {
        System.runAs(testUser) {
            AsyncApexJob job = (AsyncApexJob) JSON.deserialize('{"Status":"Processing","NumberOfErrors":1}', AsyncApexJob.class);
            AccountDeleteBatchWrapper wrapper = new AccountDeleteBatchWrapper();
            wrapper.successCount = 2;
            wrapper.failureCount = 1;
            Test.startTest();
            Boolean sent = service.finishRun(new List<AsyncApexJob>{ job }, wrapper);
            String body = service.buildBody(job, wrapper);
            Test.stopTest();
            Assert.isTrue(sent, '処理障害があっても通知を受け付ける');
            Assert.isTrue(body.contains('削除失敗件数（確定済み）: 1'), 'ジョブのエラー数をレコード件数として加算しない');
            Assert.isTrue(body.contains('削除成功件数（確定済み）: 2'), '渡された成功件数を通知');
            Assert.isTrue(body.contains('JOB_NOT_FULLY_PROCESSED'), 'ジョブの処理エラーを理由として通知');
            Assert.isTrue(wrapper.recordErrors.isEmpty(), '通知用の追加情報で引数を変更しない');
        }
    }

    @IsTest
    static void countsBlockedScopeAsFailures() {
        System.runAs(testUser) {
            AccountDeleteBatchWrapper current = new AccountDeleteBatchWrapper();
            current.successCount = 2;
            current.failureCount = 1;
            current.errorMessage = '取引先の参照・削除権限が必要です。';
            Test.startTest();
            AccountDeleteBatchWrapper wrapper = service.addFailures(current, 3, 'EXECUTION_BLOCKED');
            Test.stopTest();
            Assert.areEqual(4, wrapper.failureCount, '削除できなかったスコープ全件を失敗に加算');
            Assert.areEqual(2, wrapper.successCount, '以前の成功件数は維持');
            Assert.areEqual(1, current.failureCount, '入力値を変更しない');

            Assert.isTrue(current.recordErrors.isEmpty(), '入力の理由コードを変更しない');
            Assert.isTrue(wrapper.failureReasons.contains('EXECUTION_BLOCKED: 取引先の参照・削除権限が必要です。'), '中止理由の説明を保持');
        }
    }

    @IsTest
    static void limitsRecordDetailsWithoutLosingFailureCounts() {
        TestDataFactory.assignPermissionSet(testUser.Id, 'LwcAccountDelete');
        System.runAs(testUser) {
            List<Account> accounts = new List<Account>();
            for (Integer index = 0; index < 201; index++) {
                accounts.add(TestDataFactory.createAccount('詳細上限' + index, TestDataFactory.SaveMode.DO_NOT_INSERT));
            }
            insert accounts;
            delete accounts;
            Test.startTest();
            List<Database.DeleteResult> results = deleteForResults(accounts);
            AccountDeleteBatchWrapper wrapper = service.aggregateDeleteResults(results, accounts, new AccountDeleteBatchWrapper());
            AsyncApexJob job = (AsyncApexJob) JSON.deserialize('{"NumberOfErrors":0}', AsyncApexJob.class);
            String body = service.buildBody(job, wrapper);
            Test.stopTest();
            Assert.areEqual(201, wrapper.failureCount, '全失敗レコードを集計');
            Assert.areEqual(200, wrapper.recordErrors.size(), '詳細はレコード単位で上限を適用');
            Assert.isTrue(body.contains('200 / 201件'), '表示件数と全失敗件数を通知');
            Assert.isTrue(body.contains('表示していない失敗レコードがあります'), '省略があることを通知');
            Assert.isFalse(body.contains('取引先ID: ' + accounts[200].Id), '上限を超えるレコードは表示しない');
        }
    }

    @IsTest
    static void deletesPersonAndBusinessAccountsTogether() {
        TestDataFactory.assignPermissionSet(testUser.Id, 'LwcAccountDelete');
        System.runAs(testUser) {
            Boolean enabled = Account.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED)
                .fields.getMap()
                .containsKey('IsPersonAccount');
            if (!enabled) {
                Test.startTest();
                Assert.isFalse(enabled, '個人取引先無効環境では専用項目へ依存しない');
                Test.stopTest();
                return;
            }
            List<SObject> recordTypes = Database.query(
                'SELECT Id FROM RecordType WHERE SObjectType = \'Account\' AND IsPersonType = true LIMIT 1'
            );
            Assert.isFalse(recordTypes.isEmpty(), '有効環境には個人取引先レコードタイプが必要');
            Account person = new Account();
            person.put('RecordTypeId', recordTypes[0].get('Id'));
            person.put('LastName', '削除確認用');
            insert person;
            Id personId = person.Id;
            List<SObject> people = Database.queryWithBinds(
                'SELECT PersonContactId FROM Account WHERE Id = :personId',
                new Map<String, Object>{ 'personId' => personId },
                AccessLevel.USER_MODE
            );
            Id contactId = (Id) people[0].get('PersonContactId');
            Account business = TestDataFactory.createAccount('法人混在', TestDataFactory.SaveMode.INSERT_RECORD);

            Test.startTest();
            List<Database.DeleteResult> results = deleteForResults(new List<Account>{ person, business });
            AccountDeleteBatchWrapper wrapper = service.aggregateDeleteResults(results, new List<Account>{ person, business }, new AccountDeleteBatchWrapper());
            Test.stopTest();
            Assert.areEqual(2, wrapper.successCount, '関連Contact分は加算しない');
            Assert.areEqual(0, wrapper.failureCount, '混在しても正常削除');
            List<Contact> contacts = [SELECT IsDeleted FROM Contact WHERE Id = :contactId ALL ROWS];
            Assert.areEqual(1, contacts.size(), '対応Contactの削除状態を確認');
            Assert.isTrue(contacts[0].IsDeleted, '対応Contactも連動削除');
        }
    }

    @IsTest
    static void formatsRecordNameOnceAndListsReasons() {
        System.runAs(testUser) {
            String name = '通知形式の確認';
            List<String> messages = new List<String>{
                '削除を試みた' + name + 'は、次ケースに関連しているため削除できませんでした。: case-number\r\n' +
                '削除を試みた' + name + 'は、次契約に関連しているため削除できませんでした。: contract-number',
                '別形式のエラー内容'
            };
            Test.startTest();
            String detail = service.buildRecordError(name, new Set<String>{ 'DELETE_FAILED' }, messages);
            Test.stopTest();
            Assert.areEqual(
                '取引先名: ' + name + '\nエラーコード: DELETE_FAILED\n理由:\n' +
                '・次ケースに関連しているため削除できませんでした。: case-number\n' +
                '・次契約に関連しているため削除できませんでした。: contract-number\n' +
                '・別形式のエラー内容', detail, '定型の前置きだけ除去し、各理由を改行した箇条書きにする'
            );
        }
    }

    @IsTest
    static void limitsCombinedReasonLength() {
        System.runAs(testUser) {
            String longMessage = '理由'.repeat(600);
            Test.startTest();
            String detail = service.buildRecordError('長い理由', new Set<String>{ 'DELETE_FAILED' }, new List<String>{ longMessage });
            Test.stopTest();
            String reason = detail.substringAfter('理由:\n');
            Assert.areEqual(1000, reason.length(), '理由全体の文字数を制限');
            Assert.isTrue(reason.endsWith('...'), '省略を示す');
        }
    }

    /**
     * テスト内で実際のDML結果を準備
     * @param accounts 削除結果を取得するテストデータ
     * @return 個別の削除結果
     */
    private static List<Database.DeleteResult> deleteForResults(List<Account> accounts) {
        List<Database.DeleteResult> results = Database.delete(accounts, false, AccessLevel.USER_MODE);
        return results;
    }
}