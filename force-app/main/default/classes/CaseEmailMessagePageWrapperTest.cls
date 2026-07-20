/**
 * ケースメールメッセージページ Wrapper テスト
 */
@IsTest
private with sharing class CaseEmailMessagePageWrapperTest {
    private static User testUser = TestDataFactory.getTestUser();

    /**
     * 引数なしで空ページを初期化
     */
    @IsTest
    static void shouldInitializeEmptyPage() {
        CaseEmailMessagePageWrapper result;

        System.runAs(testUser) {
            Test.startTest();

            result = new CaseEmailMessagePageWrapper();

            Test.stopTest();
        }

        Assert.areEqual(0, result.emailMessages.size(), '引数なしで空のメールリストを初期化する必要あり');
        Assert.isFalse(result.hasNextPage, '引数なしで次ページなしと初期化する必要あり');
        Assert.isNull(result.paginationCursor, '引数なしでPaginationCursorをnullにする必要あり');
        Assert.isNull(result.nextIndex, '引数なしで次ページ位置をnullにする必要あり');
    }

    /**
     * メールメッセージと次ページ情報を保持
     */
    @IsTest
    static void shouldExposePageState() {
        Case caseRecord = TestDataFactory.createCase('ページ Wrapper テスト', TestDataFactory.SaveMode.INSERT_RECORD);
        List<EmailMessage> emailMessages = new List<EmailMessage>{
            new EmailMessage(Subject = 'ページ Wrapper テスト')
        };
        Database.PaginationCursor paginationCursor;
        CaseEmailMessagePageWrapper result;

        System.runAs(testUser) {
            Test.startTest();

            paginationCursor = Database.getPaginationCursorWithBinds(
                'SELECT Id FROM Case WHERE Id = :caseId',
                new Map<String, Object>{ 'caseId' => caseRecord.Id },
                AccessLevel.USER_MODE
            );
            result = new CaseEmailMessagePageWrapper(emailMessages, paginationCursor, 0);

            Test.stopTest();
        }

        Assert.areEqual(1, result.emailMessages.size(), 'コンストラクターで受け取ったメールを保持する必要あり');
        Assert.isTrue(result.hasNextPage, '次の取得位置と総件数から次ページありと判定する必要あり');
        Assert.areEqual(
            paginationCursor.getNumRecords(),
            result.paginationCursor.getNumRecords(),
            'コンストラクターで受け取ったPaginationCursorを保持する必要あり'
        );
        Assert.areEqual(0, result.nextIndex, 'コンストラクターで受け取った次ページ位置を保持する必要あり');
    }
}
