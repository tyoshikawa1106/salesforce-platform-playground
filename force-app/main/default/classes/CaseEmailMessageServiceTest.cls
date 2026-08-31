/**
 * ケースメールメッセージ一覧 Service の入力値検証テスト
 */
@IsTest
private with sharing class CaseEmailMessageServiceTest {
    private static User testUser = TestDataFactory.getTestUser();

    /**
     * Case ID を検証済み ID として返却
     */
    @IsTest
    static void shouldReturnValidatedCaseId() {
        Case caseRecord = TestDataFactory.createCase('Service Case ID テスト', TestDataFactory.SaveMode.INSERT_RECORD);
        CaseEmailMessageService.CaseIdValidationResult result;

        System.runAs(testUser) {
            Test.startTest();

            result = new CaseEmailMessageService().validateCaseId(caseRecord.Id);

            Test.stopTest();
        }

        Assert.isTrue(result.isValid, 'Case ID は有効な入力として判定する必要あり');
        Assert.areEqual(caseRecord.Id, result.caseId, '検証済み Case ID は入力 ID と一致する必要あり');
        Assert.areEqual('', result.errorMessage, '有効な入力には空のエラー文言を返す必要あり');
    }

    /**
     * null を許容
     */
    @IsTest
    static void shouldReturnNullWhenCaseIdIsNull() {
        CaseEmailMessageService.CaseIdValidationResult result;

        System.runAs(testUser) {
            Test.startTest();

            result = new CaseEmailMessageService().validateCaseId(null);

            Test.stopTest();
        }

        Assert.isTrue(result.isValid, 'null は問い合わせなしの有効な入力として判定する必要あり');
        Assert.isNull(result.caseId, 'null の Case ID は問い合わせなしの入力として返す必要あり');
        Assert.areEqual('', result.errorMessage, '問い合わせなしの有効な入力には空のエラー文言を返す必要あり');
    }

    /**
     * Case 以外の ID を拒否
     */
    @IsTest
    static void shouldRejectNonCaseId() {
        Account accountRecord = TestDataFactory.createAccount(
            'Service Case 以外 ID テスト',
            TestDataFactory.SaveMode.INSERT_RECORD
        );

        CaseEmailMessageService.CaseIdValidationResult result;

        System.runAs(testUser) {
            Test.startTest();

            result = new CaseEmailMessageService().validateCaseId(accountRecord.Id);

            Test.stopTest();
        }

        Assert.isFalse(result.isValid, 'Case 以外の ID は無効な入力として判定する必要あり');
        Assert.isNull(result.caseId, '無効な入力には Case ID を返さない必要あり');
        Assert.isTrue(
            result.errorMessage.contains('ケースレコード'),
            '結果はケースレコードを確認できないことを説明する必要あり'
        );
    }

    /**
     * 初回ページの問い合わせ条件を作成
     */
    @IsTest
    static void shouldCreateInitialPageQuery() {
        Case caseRecord = TestDataFactory.createCase(
            'Service 初回ページテスト',
            TestDataFactory.SaveMode.INSERT_RECORD
        );
        CaseEmailMessageService.PageQueryResult result;

        System.runAs(testUser) {
            Test.startTest();

            result = new CaseEmailMessageService().createPageQuery(caseRecord.Id, null, null);

            Test.stopTest();
        }

        Assert.isTrue(result.isValid, '初回ページは有効な問い合わせ条件として判定する必要あり');
        Assert.areEqual(caseRecord.Id, result.pageQuery.caseId, '問い合わせ条件に検証済み Case ID を保持する必要あり');
        Assert.isNull(result.pageQuery.paginationCursor, '初回ページでは Selector が新しい PaginationCursor を作成する必要あり');
        Assert.areEqual(0, result.pageQuery.startIndex, '初回ページは 0 番目から取得する必要あり');
        Assert.areEqual(50, result.pageQuery.fetchSize, '1 ページの取得件数を 50 件にする必要あり');
        Assert.areEqual('', result.errorMessage, '有効な問い合わせ条件には空のエラー文言を返す必要あり');
    }

    /**
     * 負のページ取得位置を拒否
     */
    @IsTest
    static void shouldRejectNegativeStartIndex() {
        CaseEmailMessageService.PageQueryResult result;

        System.runAs(testUser) {
            Test.startTest();

            result = new CaseEmailMessageService().createPageQuery(null, null, -1);

            Test.stopTest();
        }

        Assert.isFalse(result.isValid, '負の取得位置は無効な結果にする必要あり');
        Assert.isNull(result.pageQuery, '無効な結果には問い合わせ条件を返さない必要あり');
        Assert.isTrue(result.errorMessage.contains('次のメール'), '結果は次ページの読み込み失敗を説明する必要あり');
    }

    /**
     * PaginationCursorなしの途中位置を拒否
     */
    @IsTest
    static void shouldRejectNonzeroStartIndexWithoutCursor() {
        CaseEmailMessageService.PageQueryResult result;

        System.runAs(testUser) {
            Test.startTest();

            result = new CaseEmailMessageService().createPageQuery(null, null, 50);

            Test.stopTest();
        }

        Assert.isFalse(result.isValid, 'Cursor なしの途中位置は無効な結果にする必要あり');
        Assert.isNull(result.pageQuery, '無効な結果には問い合わせ条件を返さない必要あり');
        Assert.isTrue(result.errorMessage.contains('再読み込み'), '結果は先頭からの再読み込みを案内する必要あり');
    }

    /**
     * PaginationCursorを作成しない入力は空ページへ変換
     */
    @IsTest
    static void shouldCreateEmptyPageWithoutCursorResult() {
        CaseEmailMessagePageWrapper result;

        System.runAs(testUser) {
            Test.startTest();

            result = new CaseEmailMessageService().createPage(null, null);

            Test.stopTest();
        }

        Assert.areEqual(0, result.emailMessages.size(), 'Cursor結果がない場合は空のメール一覧を返す必要あり');
        Assert.isFalse(result.hasNextPage, 'Cursor結果がない場合は次ページなしにする必要あり');
    }

    /**
     * Cursor の残件数に合わせて取得件数を縮小
     */
    @IsTest
    static void shouldLimitPageFetchToRemainingRecords() {
        Case caseRecord = TestDataFactory.createCase(
            'Service 残件数テスト',
            TestDataFactory.SaveMode.INSERT_RECORD
        );
        insert new EmailMessage(
            ParentId = caseRecord.Id,
            RelatedToId = caseRecord.Id,
            Subject = '残件数テスト',
            FromAddress = 'sender@example.com',
            ToAddress = 'recipient@example.com',
            Incoming = true,
            Status = '0'
        );
        CaseEmailMessageService service = new CaseEmailMessageService();
        CaseEmailMessageService.PageQueryResult pageQueryResult = service.createPageQuery(caseRecord.Id, null, 0);
        CaseEmailMessageService.PageQuery pageQuery = pageQueryResult.pageQuery;
        Database.PaginationCursor paginationCursor = new CaseEmailMessageSelector().getPaginationCursorByCaseId(caseRecord.Id);
        CaseEmailMessageService.PageQuery result;

        System.runAs(testUser) {
            Test.startTest();

            result = service.preparePageFetch(pageQuery, paginationCursor);

            Test.stopTest();
        }

        Assert.areEqual(1, result.fetchSize, '残り1件では取得件数を1件へ縮小する必要あり');
        Assert.areEqual(paginationCursor, result.paginationCursor, '取得に使う Cursor を保持する必要あり');
    }

    /**
     * null の問い合わせ条件を空の問い合わせ条件へ変換
     */
    @IsTest
    static void shouldPrepareEmptyPageQueryWhenPageQueryIsNull() {
        CaseEmailMessageService.PageQuery result;

        System.runAs(testUser) {
            Test.startTest();

            result = new CaseEmailMessageService().preparePageFetch(null, null);

            Test.stopTest();
        }

        Assert.areEqual(0, result.startIndex, '空の問い合わせ条件は先頭位置で初期化する必要あり');
        Assert.areEqual(0, result.fetchSize, '空の問い合わせ条件は取得なしで初期化する必要あり');
    }

    /**
     * Cursor の終端では取得件数をゼロへ変換
     */
    @IsTest
    static void shouldPrepareZeroFetchSizeAtCursorEnd() {
        Case caseRecord = TestDataFactory.createCase(
            'Service Cursor 終端テスト',
            TestDataFactory.SaveMode.INSERT_RECORD
        );
        insert new EmailMessage(
            ParentId = caseRecord.Id,
            RelatedToId = caseRecord.Id,
            Subject = 'Cursor 終端テスト',
            FromAddress = 'sender@example.com',
            ToAddress = 'recipient@example.com',
            Incoming = true,
            Status = '0'
        );
        CaseEmailMessageService service = new CaseEmailMessageService();
        CaseEmailMessageService.PageQuery pageQuery = service.createPageQuery(
                caseRecord.Id,
                null,
                0
            )
            .pageQuery;
        Database.PaginationCursor paginationCursor = new CaseEmailMessageSelector().getPaginationCursorByCaseId(
            caseRecord.Id
        );
        pageQuery.startIndex = paginationCursor.getNumRecords();
        CaseEmailMessageService.PageQuery result;

        System.runAs(testUser) {
            Test.startTest();

            result = service.preparePageFetch(pageQuery, paginationCursor);

            Test.stopTest();
        }

        Assert.areEqual(0, result.fetchSize, 'Cursor の終端では追加取得しない必要あり');
    }
}