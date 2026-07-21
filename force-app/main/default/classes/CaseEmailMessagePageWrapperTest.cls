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
        List<Case> caseRecords = new List<Case>{
            TestDataFactory.createCase('ページ Wrapper テスト 1', TestDataFactory.SaveMode.DO_NOT_INSERT),
            TestDataFactory.createCase('ページ Wrapper テスト 2', TestDataFactory.SaveMode.DO_NOT_INSERT)
        };
        insert caseRecords;
        Set<Id> caseIds = new Map<Id, Case>(caseRecords).keySet();
        List<EmailMessage> emailMessages = new List<EmailMessage>{
            new EmailMessage(Subject = 'ページ Wrapper テスト')
        };
        Database.PaginationCursor paginationCursor;
        CaseEmailMessagePageWrapper result;

        System.runAs(testUser) {
            Test.startTest();

            paginationCursor = Database.getPaginationCursorWithBinds(
                'SELECT Id FROM Case WHERE Id IN :caseIds ORDER BY Id',
                new Map<String, Object>{ 'caseIds' => caseIds },
                AccessLevel.USER_MODE
            );
            result = new CaseEmailMessagePageWrapper(emailMessages, paginationCursor, 1);

            Test.stopTest();
        }

        Assert.areEqual(1, result.emailMessages.size(), 'コンストラクターで受け取ったメールを保持する必要あり');
        Assert.isTrue(result.hasNextPage, '次の取得位置と総件数から次ページありと判定する必要あり');
        Assert.areEqual(
            paginationCursor.getNumRecords(),
            result.paginationCursor.getNumRecords(),
            'コンストラクターで受け取ったPaginationCursorを保持する必要あり'
        );
        Assert.areEqual(1, result.nextIndex, 'コンストラクターで受け取った次ページ位置を保持する必要あり');
    }
}
