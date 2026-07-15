/**
 * ケースメールメッセージ一覧の Apex 入口テスト
 */
@IsTest
private with sharing class CaseEmailMessageControllerTest {

    private static User testUser = TestDataFactory.getTestUser();

    /**
     * ケースに紐づくメールメッセージを返却
     */
    @IsTest
    static void shouldReturnEmailMessagesForCase() {
        Case caseRecord = TestDataFactory.createCase(
            'メール一覧 Controller テスト',
            TestDataFactory.SaveMode.INSERT_RECORD
        );
        EmailMessage emailMessage = createEmailMessage(
            caseRecord.Id,
            'Controller 取得対象',
            Datetime.newInstance(2026, 7, 16, 9, 0, 0)
        );
        insert emailMessage;
        List<EmailMessage> results;

        System.runAs(testUser) {
            Test.startTest();

            results = CaseEmailMessageController.getEmailMessages(
                caseRecord.Id
            );

            Test.stopTest();
        }

        Assert.areEqual(
            1,
            results.size(),
            'ケースに紐づくメールメッセージを 1 件返す必要あり'
        );
        Assert.areEqual(
            'Controller 取得対象',
            results[0].Subject,
            '取得結果にメール件名を含む必要あり'
        );
        Assert.isTrue(
            results[0].Incoming,
            '取得結果に受信方向を含む必要あり'
        );
    }

    /**
     * ケース ID が null の場合は空結果を返却
     */
    @IsTest
    static void shouldReturnEmptyListWhenCaseIdIsNull() {
        List<EmailMessage> results;

        System.runAs(testUser) {
            Test.startTest();

            results = CaseEmailMessageController.getEmailMessages(null);

            Test.stopTest();
        }

        Assert.areEqual(
            0,
            results.size(),
            'ケース ID がない場合は空のリストを返す必要あり'
        );
    }

    /**
     * ケース以外の ID を拒否
     */
    @IsTest
    static void shouldRejectNonCaseId() {
        Account accountRecord = TestDataFactory.createAccount(
            'ケース以外 ID テスト',
            TestDataFactory.SaveMode.INSERT_RECORD
        );

        System.runAs(testUser) {
            Test.startTest();
            try {
                CaseEmailMessageController.getEmailMessages(accountRecord.Id);
                Assert.fail('ケース以外の ID は AuraHandledException にする必要あり');
            } catch (AuraHandledException e) {
                Assert.isNotNull(
                    e,
                    'ケース以外の ID は利用者向け例外に変換する必要あり'
                );
            }
            Test.stopTest();
        }
    }

    private static EmailMessage createEmailMessage(Id caseId, String subject, Datetime messageDate) {
        return new EmailMessage(
            ParentId = caseId,
            RelatedToId = caseId,
            Subject = subject,
            FromAddress = 'sender@example.com',
            ToAddress = 'recipient@example.com',
            MessageDate = messageDate,
            Incoming = true,
            Status = '0',
            TextBody = 'テスト用メール本文'
        );
    }
}
