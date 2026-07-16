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

        Assert.areEqual(
            0,
            result.emailMessages.size(),
            '引数なしで空のメールリストを初期化する必要あり'
        );
        Assert.isFalse(
            result.hasNextPage,
            '引数なしで次ページなしと初期化する必要あり'
        );
    }

    /**
     * メールメッセージと次ページ情報を保持
     */
    @IsTest
    static void shouldExposePageState() {
        List<EmailMessage> emailMessages = new List<EmailMessage>{
            new EmailMessage(Subject = 'ページ Wrapper テスト')
        };
        CaseEmailMessagePageWrapper result;

        System.runAs(testUser) {
            Test.startTest();

            result = new CaseEmailMessagePageWrapper(
                emailMessages,
                50,
                'next-token'
            );

            Test.stopTest();
        }

        Assert.areEqual(
            1,
            result.emailMessages.size(),
            'コンストラクターで受け取ったメールを保持する必要あり'
        );
        Assert.areEqual(
            50,
            result.pageSize,
            'コンストラクターで受け取ったページサイズを保持する必要あり'
        );
        Assert.isTrue(
            result.hasNextPage,
            '次ページトークンがある場合は次ページありと判定する必要あり'
        );
    }
}
