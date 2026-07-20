/**
 * ケースメールメッセージ PaginationCursor 問い合わせテスト
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
        insert createEmailMessages(caseRecord.Id, 2, System.now());
        Integer result;

        System.runAs(testUser) {
            Test.startTest();

            result = new CaseEmailMessageSelector().getCountByCaseId(caseRecord.Id);

            Test.stopTest();
        }

        Assert.areEqual(2, result, 'ケースに紐づくメールメッセージ件数を返す必要あり');
    }

    /**
     * nullのケースIDは0件として返却
     */
    @IsTest
    static void shouldReturnZeroCountWhenCaseIdIsNull() {
        Integer result;

        System.runAs(testUser) {
            Test.startTest();

            result = new CaseEmailMessageSelector().getCountByCaseId(null);

            Test.stopTest();
        }

        Assert.areEqual(0, result, 'ケース ID が null の場合は 0 件を返す必要あり');
    }

    /**
     * 49件では次ページなしとして返却
     */
    @IsTest
    static void shouldReturnNoNextPageWhenFortyNineRecordsExist() {
        Case caseRecord = createCaseWithEmailMessages(49);
        CaseEmailMessagePageWrapper result;

        System.runAs(testUser) {
            Test.startTest();

            result = getInitialPage(caseRecord.Id, 50);

            Test.stopTest();
        }

        Assert.areEqual(49, result.emailMessages.size(), '49 件を 1 ページで返す必要あり');
        Assert.isFalse(result.hasNextPage, '49 件では次ページなしにする必要あり');
    }

    /**
     * 50件ちょうどでは次ページなしとして返却
     */
    @IsTest
    static void shouldReturnNoNextPageWhenFiftyRecordsExist() {
        Case caseRecord = createCaseWithEmailMessages(50);
        CaseEmailMessagePageWrapper result;

        System.runAs(testUser) {
            Test.startTest();

            result = getInitialPage(caseRecord.Id, 50);

            Test.stopTest();
        }

        Assert.areEqual(50, result.emailMessages.size(), '50 件を 1 ページで返す必要あり');
        Assert.isFalse(result.hasNextPage, '50 件ちょうどでは次ページなしにする必要あり');
        Assert.areEqual(50, result.nextIndex, '次の取得位置は取得済み 50 件の後にする必要あり');
    }

    /**
     * 51件を重複なく2ページへ分割
     */
    @IsTest
    static void shouldReturnTwoPagesWithoutDuplicatesWhenFiftyOneRecordsExist() {
        Case caseRecord = createCaseWithEmailMessages(51);
        CaseEmailMessagePageWrapper firstPage;
        CaseEmailMessagePageWrapper nextPage;

        System.runAs(testUser) {
            Test.startTest();

            firstPage = getInitialPage(caseRecord.Id, 50);
            nextPage = getNextPage(caseRecord.Id, firstPage, 50);

            Test.stopTest();
        }

        Assert.areEqual(50, firstPage.emailMessages.size(), '初回ページは最大 50 件にする必要あり');
        Assert.isTrue(firstPage.hasNextPage, '51 件では初回ページに次ページを返す必要あり');
        Assert.areEqual(1, nextPage.emailMessages.size(), '2 ページ目に残り 1 件を返す必要あり');
        Assert.isFalse(nextPage.hasNextPage, '2 ページ目を最終ページにする必要あり');
        Assert.areNotEqual(
            firstPage.emailMessages[49].Id,
            nextPage.emailMessages[0].Id,
            'ページ境界で同じメールを重複して返さない必要あり'
        );
        Assert.areEqual(
            'メール 50',
            firstPage.emailMessages[0].Subject,
            '最も古いメールを初回ページの先頭にする必要あり'
        );
        Assert.areEqual('メール 0', nextPage.emailMessages[0].Subject, '最も新しいメールを最終ページにする必要あり');
    }

    /**
     * 送信日時のないメールを作成日時の順にページ取得
     */
    @IsTest
    static void shouldPageUndatedEmailMessagesByCreatedDate() {
        Case caseRecord = TestDataFactory.createCase(
            '送信日時なし Selector テスト',
            TestDataFactory.SaveMode.INSERT_RECORD
        );
        List<EmailMessage> emailMessages = new List<EmailMessage>{
            createUndatedEmailMessage(caseRecord.Id, '古い日時なしメール'),
            createUndatedEmailMessage(caseRecord.Id, '新しい日時なしメール')
        };
        insert emailMessages;
        Test.setCreatedDate(emailMessages[0].Id, Datetime.newInstance(2026, 7, 15, 9, 0, 0));
        Test.setCreatedDate(emailMessages[1].Id, Datetime.newInstance(2026, 7, 16, 9, 0, 0));
        CaseEmailMessagePageWrapper firstPage;
        CaseEmailMessagePageWrapper nextPage;

        System.runAs(testUser) {
            Test.startTest();

            firstPage = getInitialPage(caseRecord.Id, 1);
            nextPage = getNextPage(caseRecord.Id, firstPage, 1);

            Test.stopTest();
        }

        Assert.areEqual(
            '古い日時なしメール',
            firstPage.emailMessages[0].Subject,
            '送信日時なしの先頭は作成日時の古いメールにする必要あり'
        );
        Assert.areEqual(
            '新しい日時なしメール',
            nextPage.emailMessages[0].Subject,
            '日時なしの次ページは作成日時の新しいメールにする必要あり'
        );
    }

    /**
     * Cursor作成後の削除行を飛ばして次ページを取得
     */
    @IsTest
    static void shouldSkipDeletedRecordsWhenFetchingNextPage() {
        Case caseRecord = TestDataFactory.createCase('削除行 Selector テスト', TestDataFactory.SaveMode.INSERT_RECORD);
        List<EmailMessage> emailMessages = createEmailMessages(
            caseRecord.Id,
            3,
            Datetime.newInstance(2026, 7, 16, 12, 0, 0)
        );
        insert emailMessages;
        CaseEmailMessagePageWrapper firstPage;
        CaseEmailMessagePageWrapper nextPage;

        System.runAs(testUser) {
            Test.startTest();

            firstPage = getInitialPage(caseRecord.Id, 1);
            delete emailMessages[1];
            nextPage = getNextPage(caseRecord.Id, firstPage, 2);

            Test.stopTest();
        }

        Assert.areEqual(1, nextPage.emailMessages.size(), '削除済み行を除いた残りのメールだけを返す必要あり');
        Assert.areEqual(
            emailMessages[0].Id,
            nextPage.emailMessages[0].Id,
            '削除行の後にある新しいメールを返す必要あり'
        );
        Assert.isFalse(nextPage.hasNextPage, '削除行を飛ばした後は最終ページにする必要あり');
    }

    /**
     * ケースIDがない場合は空ページを返却
     */
    @IsTest
    static void shouldReturnEmptyPageWhenCaseIdIsNull() {
        CaseEmailMessagePageWrapper result;

        System.runAs(testUser) {
            Test.startTest();

            result = getInitialPage(null, 50);

            Test.stopTest();
        }

        Assert.areEqual(0, result.emailMessages.size(), 'ケース ID が null の場合は空のページを返す必要あり');
    }

    private static Case createCaseWithEmailMessages(Integer count) {
        Case caseRecord = TestDataFactory.createCase(
            'ページ境界 Selector テスト ' + count,
            TestDataFactory.SaveMode.INSERT_RECORD
        );
        insert createEmailMessages(caseRecord.Id, count, Datetime.newInstance(2026, 7, 16, 12, 0, 0));
        return caseRecord;
    }

    private static List<EmailMessage> createEmailMessages(Id caseId, Integer count, Datetime latestMessageDate) {
        List<EmailMessage> emailMessages = new List<EmailMessage>();
        for (Integer index = 0; index < count; index++) {
            emailMessages.add(createEmailMessage(caseId, index, latestMessageDate));
        }
        return emailMessages;
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

    private static EmailMessage createUndatedEmailMessage(Id caseId, String subject) {
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

    private static CaseEmailMessagePageWrapper getInitialPage(Id caseId, Integer fetchSize) {
        CaseEmailMessageService.PageQuery pageQuery = new CaseEmailMessageService.PageQuery();
        pageQuery.caseId = caseId;
        pageQuery.startIndex = 0;
        pageQuery.fetchSize = fetchSize;
        return getPage(pageQuery);
    }

    private static CaseEmailMessagePageWrapper getNextPage(
        Id caseId,
        CaseEmailMessagePageWrapper currentPage,
        Integer fetchSize
    ) {
        CaseEmailMessageService.PageQuery pageQuery = new CaseEmailMessageService.PageQuery();
        pageQuery.caseId = caseId;
        pageQuery.paginationCursor = currentPage.paginationCursor;
        pageQuery.startIndex = currentPage.nextIndex;
        pageQuery.fetchSize = fetchSize;
        return getPage(pageQuery);
    }

    private static CaseEmailMessagePageWrapper getPage(CaseEmailMessageService.PageQuery pageQuery) {
        Database.CursorFetchResult cursorFetchResult = new CaseEmailMessageSelector().getByCaseId(pageQuery);
        return new CaseEmailMessageService().createPage(pageQuery.paginationCursor, cursorFetchResult);
    }
}
