/**
 * ケースメールメッセージ問い合わせテスト
 */
@IsTest
private with sharing class CaseEmailMessageSelectorTest {

    private static User testUser = TestDataFactory.getTestUser();

    /**
     * ケースに紐づくメールメッセージ件数を返却
     */
    @IsTest
    static void shouldReturnEmailMessageCount() {
        Case caseRecord = TestDataFactory.createCase(
            'メール件数 Selector テスト',
            TestDataFactory.SaveMode.INSERT_RECORD
        );
        insert new List<EmailMessage>{
            createEmailMessage(caseRecord.Id, 1, System.now()),
            createEmailMessage(caseRecord.Id, 2, System.now())
        };
        Integer result;
        Integer nullResult;

        System.runAs(testUser) {
            Test.startTest();

            CaseEmailMessageSelector selector = new CaseEmailMessageSelector();
            result = selector.getCountByCaseId(caseRecord.Id);
            nullResult = selector.getCountByCaseId(null);

            Test.stopTest();
        }

        Assert.areEqual(
            2,
            result,
            'ケースに紐づくメールメッセージ件数を返す必要あり'
        );
        Assert.areEqual(
            0,
            nullResult,
            'ケース ID が null の場合は 0 件を返す必要あり'
        );
    }

    /**
     * カーソルより後のメールメッセージを昇順で返却
     */
    @IsTest
    static void shouldReturnEmailMessagesAfterCursor() {
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
        List<EmailMessage> firstPage;
        List<EmailMessage> nextPage;

        System.runAs(testUser) {
            Test.startTest();

            CaseEmailMessageSelector selector = new CaseEmailMessageSelector();
            firstPage = selector.getByCaseId(
                createPageQuery(caseRecord.Id, null, 50)
            );
            EmailMessage cursorEmailMessage = firstPage[49];
            nextPage = selector.getByCaseId(
                createPageQuery(caseRecord.Id, cursorEmailMessage, 50)
            );

            Test.stopTest();
        }

        Assert.areEqual(
            50,
            firstPage.size(),
            '1 回の問い合わせを 50 件に制限する必要あり'
        );
        Assert.areEqual(
            'メール 50',
            firstPage[0].Subject,
            '先頭は送信日時が最も古いメールにする必要あり'
        );
        Assert.areEqual(
            1,
            nextPage.size(),
            '50 件目のカーソル以降を次ページに返す必要あり'
        );
        Assert.areEqual(
            'メール 0',
            nextPage[0].Subject,
            '次ページに最も新しいメールを返す必要あり'
        );
        Assert.areEqual(
            'テスト用メール本文',
            firstPage[0].TextBody,
            '取得結果にメール本文を含む必要あり'
        );
    }

    /**
     * 送信日時のないメールを作成日時のカーソルで取得
     */
    @IsTest
    static void shouldReturnUndatedEmailMessagesAfterCursor() {
        Case caseRecord = TestDataFactory.createCase(
            '送信日時なし Selector テスト',
            TestDataFactory.SaveMode.INSERT_RECORD
        );
        List<EmailMessage> emailMessages = new List<EmailMessage>{
            createUndatedEmailMessage(caseRecord.Id, '古い日時なしメール'),
            createUndatedEmailMessage(caseRecord.Id, '新しい日時なしメール')
        };
        insert emailMessages;
        Test.setCreatedDate(
            emailMessages[0].Id,
            Datetime.newInstance(2026, 7, 15, 9, 0, 0)
        );
        Test.setCreatedDate(
            emailMessages[1].Id,
            Datetime.newInstance(2026, 7, 16, 9, 0, 0)
        );
        List<EmailMessage> firstPage;
        List<EmailMessage> nextPage;

        System.runAs(testUser) {
            Test.startTest();

            CaseEmailMessageSelector selector = new CaseEmailMessageSelector();
            firstPage = selector.getByCaseId(
                createPageQuery(caseRecord.Id, null, 1)
            );
            nextPage = selector.getByCaseId(
                createPageQuery(caseRecord.Id, firstPage[0], 1)
            );

            Test.stopTest();
        }

        Assert.areEqual(
            '古い日時なしメール',
            firstPage[0].Subject,
            '送信日時なしの先頭は作成日時の古いメールにする必要あり'
        );
        Assert.areEqual(
            '新しい日時なしメール',
            nextPage[0].Subject,
            '日時なしの次ページは作成日時の新しいメールにする必要あり'
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

            results = new CaseEmailMessageSelector().getByCaseId(
                createPageQuery(null, null, 50)
            );

            Test.stopTest();
        }

        Assert.areEqual(
            0,
            results.size(),
            'ケース ID が null の場合は空のリストを返す必要あり'
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

    private static EmailMessage createUndatedEmailMessage(
        Id caseId,
        String subject
    ) {
        return new EmailMessage(
            ParentId = caseId,
            RelatedToId = caseId,
            Subject = subject,
            FromAddress = 'sender@example.com',
            ToAddress = 'recipient@example.com',
            Incoming = true,
            Status = '0',
            TextBody = 'テスト用メール本文'
        );
    }

    private static CaseEmailMessageService.PageQuery createPageQuery(
        Id caseId,
        EmailMessage cursorEmailMessage,
        Integer fetchSize
    ) {
        CaseEmailMessageService.PageQuery pageQuery = new CaseEmailMessageService.PageQuery();
        pageQuery.caseId = caseId;
        pageQuery.cursorMessageDate = cursorEmailMessage?.MessageDate;
        pageQuery.cursorCreatedDate = cursorEmailMessage?.CreatedDate;
        pageQuery.cursorRecordId = cursorEmailMessage?.Id;
        pageQuery.fetchSize = fetchSize;
        return pageQuery;
    }
}