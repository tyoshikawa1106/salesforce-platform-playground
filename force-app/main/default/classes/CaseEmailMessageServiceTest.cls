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
        Id validatedCaseId;

        System.runAs(testUser) {
            Test.startTest();

            validatedCaseId = new CaseEmailMessageService().validateCaseId(caseRecord.Id);

            Test.stopTest();
        }

        Assert.areEqual(caseRecord.Id, validatedCaseId, '検証済み Case ID は入力 ID と一致する必要あり');
    }

    /**
     * null を許容
     */
    @IsTest
    static void shouldReturnNullWhenCaseIdIsNull() {
        Id validatedCaseId;

        System.runAs(testUser) {
            Test.startTest();

            validatedCaseId = new CaseEmailMessageService().validateCaseId(null);

            Test.stopTest();
        }

        Assert.isNull(validatedCaseId, 'null の Case ID は問い合わせなしの入力として返す必要あり');
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

        System.runAs(testUser) {
            Test.startTest();

            try {
                new CaseEmailMessageService().validateCaseId(accountRecord.Id);
                Assert.fail('Case 以外の ID は Service 例外にする必要あり');
            } catch (CaseEmailMessageService.CaseEmailMessageServiceException e) {
                String errorMessage = e.getMessage();
                Boolean describesInvalidCase = errorMessage.contains('ケースレコード');
                Assert.isTrue(describesInvalidCase, '例外はケースレコードを確認できないことを説明する必要あり');
            }

            Test.stopTest();
        }
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
        CaseEmailMessageService.PageQuery result;

        System.runAs(testUser) {
            Test.startTest();

            result = new CaseEmailMessageService().createPageQuery(caseRecord.Id, null, null);

            Test.stopTest();
        }

        Assert.areEqual(caseRecord.Id, result.caseId, '問い合わせ条件に検証済み Case ID を保持する必要あり');
        Assert.isNull(result.paginationCursor, '初回ページでは Selector が新しい PaginationCursor を作成する必要あり');
        Assert.areEqual(0, result.startIndex, '初回ページは 0 番目から取得する必要あり');
        Assert.areEqual(50, result.fetchSize, '1 ページの取得件数を 50 件にする必要あり');
    }

    /**
     * 負のページ取得位置を拒否
     */
    @IsTest
    static void shouldRejectNegativeStartIndex() {
        System.runAs(testUser) {
            Test.startTest();

            try {
                new CaseEmailMessageService().createPageQuery(null, null, -1);
                Assert.fail('負の取得位置は Service 例外にする必要あり');
            } catch (CaseEmailMessageService.CaseEmailMessageServiceException e) {
                Assert.isTrue(e.getMessage().contains('次のメール'), '例外は次ページの読み込み失敗を説明する必要あり');
            }

            Test.stopTest();
        }
    }

    /**
     * PaginationCursorなしの途中位置を拒否
     */
    @IsTest
    static void shouldRejectNonzeroStartIndexWithoutCursor() {
        System.runAs(testUser) {
            Test.startTest();

            try {
                new CaseEmailMessageService().createPageQuery(null, null, 50);
                Assert.fail('PaginationCursorなしの途中位置は Service 例外にする必要あり');
            } catch (CaseEmailMessageService.CaseEmailMessageServiceException e) {
                Assert.isTrue(e.getMessage().contains('再読み込み'), '例外は先頭からの再読み込みを案内する必要あり');
            }

            Test.stopTest();
        }
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
}
