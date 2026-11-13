/** AccountDeleteBatchServiceの集計・通知・入力値の保持を確認 */
@IsTest
private with sharing class AccountDeleteBatchServiceTest {

    private static AccountDeleteBatchService service = new AccountDeleteBatchService();

    private static User testUser = new User(Id = UserInfo.getUserId());

    /**
     * 公開入口の検証で必要な機能権限を割り当て
     */
    private static void setupDeleteAccess() {
        if (FeatureManagement.checkPermission('RunAccountDelete')) { return; }
        List<CustomPermission> permissions = [SELECT Id FROM CustomPermission WHERE DeveloperName = 'RunAccountDelete'];
        PermissionSet access = new PermissionSet(Name = 'AccountDeleteTestAccess', Label = '取引先削除テスト用');
        insert access;
        insert new SetupEntityAccess(ParentId = access.Id, SetupEntityId = permissions[0].Id);
        insert new PermissionSetAssignment(AssigneeId = testUser.Id, PermissionSetId = access.Id);
    }

    /** 実行可能時に前回の拒否理由を解除 */
    @IsTest
    static void clearsPreviousErrorWhenExecutionIsAllowed() {

        System.runAs(testUser) {
            AccountDeleteBatchWrapper current = new AccountDeleteBatchWrapper();
            current.failureCount = 2;
            current.errorMessage = '以前のエラー';
            Test.startTest();
            String message = service.getBlockMessageForConditions(true, true, true);
            Assert.areEqual('', message, '開発環境かつ必要な権限があれば実行を許可');
            AccountDeleteBatchWrapper started = service.applyStartConditions(current, message);
            Assert.areEqual('', started.errorMessage, '開始時の判定も最新の条件を使う');
            AccountDeleteBatchWrapper wrapper = service.applyExecutionConditions(current, new List<Account>(), message);
            Test.stopTest();
            Assert.areEqual('', wrapper.errorMessage, '現在の条件を満たせばエラーを解消');
            Assert.areEqual(2, wrapper.failureCount, '実行可能な対象を失敗に加算しない');
            Assert.areEqual('以前のエラー', current.errorMessage, '入力の状態を変更しない');
        }
    }

    /** 権限判定値だけで拒否理由と判定の優先順位を確認 */
    @IsTest
    static void rejectsMissingPermissionsFromConditions() {

        System.runAs(testUser) {
            Test.startTest();
            String noFeature = service.getBlockMessageForConditions(true, false, true);
            String noCrud = service.getBlockMessageForConditions(true, true, false);
            String environmentFirst = service.getBlockMessageForConditions(false, false, false);
            String featureFirst = service.getBlockMessageForConditions(true, false, false);
            Test.stopTest();
            Assert.areEqual('取引先一括削除の利用権限がありません。', noFeature, 'カスタム権限がなければ拒否');
            Assert.areEqual('取引先の参照・削除権限が必要です。', noCrud, '参照・削除の両方を持たなければ拒否');
            Assert.areEqual('Scratch Org・Developer Edition・Sandboxでのみ実行できます。', environmentFirst, '環境による拒否を最優先');
            Assert.areEqual(noFeature, featureFirst, 'CRUDよりカスタム権限の拒否を優先');
        }
    }

    /** 公開入口の判定を現在の組織環境と一致させる */
    @IsTest
    static void matchesPublicConditionsToCurrentEnvironment() {
        setupDeleteAccess();

        System.runAs(testUser) {
            Boolean developmentEnvironment = OrgEnvironment.isDevelopmentEnvironment();
            String expectedMessage = developmentEnvironment ? '' : 'Scratch Org・Developer Edition・Sandboxでのみ実行できます。';
            AccountDeleteBatchWrapper current = new AccountDeleteBatchWrapper();
            Test.startTest();
            String message = service.getBlockMessage();
            AccountDeleteBatchWrapper started = service.checkStartConditions(current);
            AccountDeleteBatchWrapper executed = service.checkExecutionConditions(current, new List<Account>());
            Test.stopTest();
            Assert.areEqual(expectedMessage, message, '公開入口は実際の組織環境で判定');
            Assert.areEqual(expectedMessage, started.errorMessage, '開始時も実際の環境制限を適用');
            Assert.areEqual(expectedMessage, executed.errorMessage, '削除直前も実際の環境制限を適用');
            Assert.areEqual(0, started.failureCount, '開始時に対象件数を推測しない');
            Assert.areEqual(0, executed.failureCount, '空スコープの失敗件数を増やさない');
        }
    }

    /** 部分成功を集計 */
    @IsTest
    static void preservesPartialSuccess() {

        System.runAs(testUser) {
            Account good = new Account(Name = '成功');
            insert good;
            Account gone = new Account(Name = '削除済み');
            insert gone;
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

    /** 引数の集計値だけを累積 */
    @IsTest
    static void accumulatesOnlyProvidedState() {

        System.runAs(testUser) {
            Account first = new Account(Name = '前半');
            insert first;
            Account second = new Account(Name = '後半');
            insert second;
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

    /** 対象なしの完了結果を通知 */
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

    /** nullのジョブ一覧では通知不可 */
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

    /** 空のジョブ一覧では通知不可 */
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

    /** 未処理レコード件数を推測せず障害を通知 */
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

    /** 本番相当の環境で開始と実行を拒否し、詳細上限まで失敗を記録 */
    @IsTest
    static void rejectsProductionEnvironmentAndCountsBlockedScope() {
        AccountDeleteBatchService blockedService = new AccountDeleteBatchService(2);

        System.runAs(testUser) {
            AccountDeleteBatchWrapper current = new AccountDeleteBatchWrapper();
            current.successCount = 2;
            current.failureCount = 1;
            String expectedMessage = 'Scratch Org・Developer Edition・Sandboxでのみ実行できます。';
            String accountPrefix = Account.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).getKeyPrefix();
            List<Account> accounts = new List<Account>{
                new Account(Id = Id.valueOf(accountPrefix + '000000000001'), Name = '拒否A'),
                new Account(Id = Id.valueOf(accountPrefix + '000000000002'), Name = '拒否B'),
                new Account(Id = Id.valueOf(accountPrefix + '000000000003'), Name = '省略対象')
            };
            Test.startTest();
            String message = blockedService.getBlockMessageForConditions(false, true, true);
            Assert.areEqual(expectedMessage, blockedService.getBlockMessageForConditions(null, true, true), '判定不能な環境も拒否');
            AccountDeleteBatchWrapper started = blockedService.applyStartConditions(current, message);
            AccountDeleteBatchWrapper wrapper = blockedService.applyExecutionConditions(current, accounts, message);
            Test.stopTest();
            Assert.areEqual(expectedMessage, message, '本番相当の環境は権限にかかわらず拒否');
            Assert.areEqual(expectedMessage, started.errorMessage, '開始時に環境の拒否理由を保持');
            Assert.areEqual(1, started.failureCount, '開始時は対象件数を推測して加算しない');
            Assert.isTrue(started.failureReasons.contains('START_BLOCKED: ' + expectedMessage), '開始不可の理由を記録');
            Assert.areEqual(expectedMessage, wrapper.errorMessage, '削除直前にも環境の拒否理由を保持');
            Assert.areEqual(4, wrapper.failureCount, '削除できなかったスコープ全件を失敗に加算');
            Assert.areEqual(2, wrapper.successCount, '以前の成功件数は維持');
            Assert.areEqual(2, wrapper.recordErrors.size(), '拒否された対象も詳細上限を適用');
            Assert.isTrue(wrapper.recordErrors.get(accounts[1].Id).contains('EXECUTION_BLOCKED'), '上限ちょうどの対象の拒否を記録');
            Assert.isTrue(wrapper.recordErrors.get(accounts[0].Id).contains(expectedMessage), '環境による拒否理由を詳細に記録');
            Assert.isFalse(wrapper.recordErrors.containsKey(accounts[2].Id), '上限超過の詳細だけを省略');
            Assert.areEqual(1, current.failureCount, '入力値を変更しない');
            Assert.areEqual('', current.errorMessage, '入力のエラーメッセージを変更しない');
            Assert.isTrue(current.recordErrors.isEmpty(), '入力のレコード詳細を変更しない');
            Assert.isTrue(current.failureReasons.isEmpty(), '入力の失敗理由を変更しない');
        }
    }

    /** 詳細上限の直前・ちょうど・超過を失敗3件で確認 */
    @IsTest
    static void limitsRecordDetailsWithoutLosingFailureCounts() {
        AccountDeleteBatchService boundedService = new AccountDeleteBatchService(2);

        System.runAs(testUser) {
            List<Account> accounts = new List<Account>{
                new Account(Name = '失敗A'), new Account(Name = '失敗B'), new Account(Name = '省略対象')
            };
            insert accounts;
            delete accounts;
            AccountDeleteBatchWrapper initial = new AccountDeleteBatchWrapper();
            Test.startTest();
            List<Database.DeleteResult> results = deleteForResults(accounts);
            AccountDeleteBatchWrapper first = boundedService.aggregateDeleteResults(
                new List<Database.DeleteResult>{ results[0] }, new List<Account>{ accounts[0] }, initial
            );
            AccountDeleteBatchWrapper exact = boundedService.aggregateDeleteResults(
                new List<Database.DeleteResult>{ results[1] }, new List<Account>{ accounts[1] }, first
            );
            AccountDeleteBatchWrapper overflow = boundedService.aggregateDeleteResults(
                new List<Database.DeleteResult>{ results[2] }, new List<Account>{ accounts[2] }, exact
            );
            AsyncApexJob job = (AsyncApexJob) JSON.deserialize('{"NumberOfErrors":0}', AsyncApexJob.class);
            String body = boundedService.buildBody(job, overflow);
            Test.stopTest();
            Assert.areEqual(1, first.recordErrors.size(), '上限未満の詳細を保存');
            Assert.areEqual(2, exact.recordErrors.size(), '上限ちょうどの詳細も保存');
            Assert.isTrue(exact.recordErrors.containsKey(accounts[1].Id), '最後に表示できる詳細を保持');
            Assert.areEqual(3, overflow.failureCount, '省略しても全失敗件数を保持');
            Assert.areEqual(2, overflow.recordErrors.size(), '超過した詳細を追加しない');
            Assert.isFalse(overflow.recordErrors.containsKey(accounts[2].Id), '上限超過の対象を省略');
            Assert.isTrue(body.contains('2 / 3件（最大2件）'), '設定上限と件数を通知');
            Assert.isTrue(body.contains('表示していない失敗レコードがあります'), '詳細の省略を通知');
            Assert.isTrue(initial.recordErrors.isEmpty(), '入力状態を変更しない');
        }
    }

    /** 法人取引先と個人取引先を一緒に削除 */
    @IsTest
    static void deletesPersonAndBusinessAccountsTogether() {

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
            Account business = new Account(Name = '法人混在');
            insert business;

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

    /** 取引先名の重複を除き理由を箇条書き表示 */
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

    /** 結合した理由の文字数を制限 */
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

    /** 開始できない理由の通知を受け付ける */
    @IsTest
    static void notifiesRejectedStart() {

        System.runAs(testUser) {
            Test.startTest();
            Boolean sent = service.sendRejection('実行条件を確認してください。');
            Assert.areEqual(1, Limits.getEmailInvocations(), '拒否理由を一回通知');
            Test.stopTest();
            Assert.isTrue(sent, '通知受付結果を返す');
        }
    }

}
