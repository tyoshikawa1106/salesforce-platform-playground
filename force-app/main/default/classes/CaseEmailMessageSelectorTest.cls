/**
 * ケースメールメッセージ問い合わせテスト
 */
@IsTest
private with sharing class CaseEmailMessageSelectorTest {

    private static User testUser = TestDataFactory.getTestUser();

    /**
     * 最新 50 件を送信日時の降順で返却
     */
    @IsTest
    static void shouldReturnLatestFiftyEmailMessages() {
        Case caseRecord = TestDataFactory.createCase(
            'メール一覧 Selector テスト',
            TestDataFactory.SaveMode.INSERT_RECORD
        );
        Datetime latestMessageDate = Datetime.newInstance(2026, 7, 16, 12, 0, 0);
        List<EmailMessage> emailMessages = new List<EmailMessage>();
        for (Integer index = 0; index < 51; index++) {
            emailMessages.add(
                createEmailMessage(
                    caseRecord.Id,
                    index,
                    latestMessageDate
                )
            );
        }
        insert emailMessages;
        List<EmailMessage> results;

        System.runAs(testUser) {
            Test.startTest();

            results = new CaseEmailMessageSelector().getByCaseId(caseRecord.Id);

            Test.stopTest();
        }

        Assert.areEqual(
            50,
            results.size(),
            'メールメッセージは最新 50 件に制限する必要あり'
        );
        Assert.areEqual(
            'メール 0',
            results[0].Subject,
            '先頭は送信日時が最も新しいメールにする必要あり'
        );
        Assert.areEqual(
            'メール 49',
            results[49].Subject,
            '51 件目を一覧から除外する必要あり'
        );
    }

    /**
     * ケース ID が null の場合は問い合わせを行わず空結果を返却
     */
    @IsTest
    static void shouldReturnEmptyListWhenCaseIdIsNull() {
        List<EmailMessage> results;

        System.runAs(testUser) {
            Test.startTest();

            results = new CaseEmailMessageSelector().getByCaseId(null);

            Test.stopTest();
        }

        Assert.areEqual(
            0,
            results.size(),
            'ケース ID がない場合は空のリストを返す必要あり'
        );
    }

    private static EmailMessage createEmailMessage(Id caseId, Integer index, Datetime latestMessageDate) {
        return new EmailMessage(
            ParentId = caseId,
            RelatedToId = caseId,
            Subject = 'メール ' + index,
            FromAddress = 'sender@example.com',
            ToAddress = 'recipient@example.com',
            MessageDate = latestMessageDate.addMinutes(-index),
            Incoming = Math.mod(index, 2) == 0,
            Status = Math.mod(index, 2) == 0 ? '0' : '3',
            TextBody = 'テスト用メール本文'
        );
    }
}
