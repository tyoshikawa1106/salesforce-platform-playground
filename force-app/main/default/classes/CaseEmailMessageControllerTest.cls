/**
 * ケースメールメッセージ一覧の Apex 入口テスト
 */
@IsTest
private with sharing class CaseEmailMessageControllerTest {
    private static User testUser = TestDataFactory.getTestUser();

    /**
     * ケースに紐づくメールメッセージ件数を返却
     */
    @IsTest
    static void shouldReturnEmailMessageCountForCase() {
        Case caseRecord = TestDataFactory.createCase(
            'メール件数 Controller テスト',
            TestDataFactory.SaveMode.INSERT_RECORD
        );
        insert new List<EmailMessage>{
            createEmailMessage(caseRecord.Id, '件数対象 1', System.now()),
            createEmailMessage(caseRecord.Id, '件数対象 2', System.now())
        };
        Integer result;

        System.runAs(testUser) {
            Test.startTest();

            result = CaseEmailMessageController.getEmailMessageCount(caseRecord.Id);

            Test.stopTest();
        }

        Assert.areEqual(2, result, 'ケースに紐づくメールメッセージ件数を返す必要あり');
    }

    /**
     * null のケース ID は 0 件として返却
     */
    @IsTest
    static void shouldReturnZeroCountWhenCaseIdIsNull() {
        Integer result;

        System.runAs(testUser) {
            Test.startTest();

            result = CaseEmailMessageController.getEmailMessageCount(null);

            Test.stopTest();
        }

        Assert.areEqual(0, result, 'ケース ID が null の場合は 0 件を返す必要あり');
    }

    /**
     * Case 以外の ID による件数取得を拒否
     */
    @IsTest
    static void shouldRejectNonCaseIdForCount() {
        Account accountRecord = TestDataFactory.createAccount(
            'メール件数 Case 以外 ID テスト',
            TestDataFactory.SaveMode.INSERT_RECORD
        );

        System.runAs(testUser) {
            Test.startTest();
            try {
                CaseEmailMessageController.getEmailMessageCount(accountRecord.Id);
                Assert.fail('Case 以外の ID は AuraHandledException にする必要あり');
            } catch (AuraHandledException e) {
                Assert.isNotNull(e, 'Case 以外の ID は利用者向け例外に変換する必要あり');
            }
            Test.stopTest();
        }
    }

    /**
     * ケースに紐づく PaginationCursor を返却
     */
    @IsTest
    static void shouldReturnPaginationCursorForCase() {
        Case caseRecord = TestDataFactory.createCase(
            'PaginationCursor Controller テスト',
            TestDataFactory.SaveMode.INSERT_RECORD
        );
        insert createEmailMessage(caseRecord.Id, 'Cursor 取得対象', System.now());
        Database.PaginationCursor result;

        System.runAs(testUser) {
            Test.startTest();

            result = CaseEmailMessageController.getEmailMessagePaginationCursor(caseRecord.Id);

            Test.stopTest();
        }

        Assert.isNotNull(result, 'LWCへ直接返す PaginationCursor を作成する必要あり');
        Assert.areEqual(1, result.getNumRecords(), '対象ケースのメール件数を Cursor に保持する必要あり');
    }

    /**
     * null のケース ID は PaginationCursor を作成しない
     */
    @IsTest
    static void shouldReturnNullCursorWhenCaseIdIsNull() {
        Database.PaginationCursor result;

        System.runAs(testUser) {
            Test.startTest();

            result = CaseEmailMessageController.getEmailMessagePaginationCursor(null);

            Test.stopTest();
        }

        Assert.isNull(result, 'ケース ID が null の場合は Cursor を返さない必要あり');
    }

    /**
     * Case 以外の ID による PaginationCursor 作成を拒否
     */
    @IsTest
    static void shouldRejectNonCaseIdForPaginationCursor() {
        Account accountRecord = TestDataFactory.createAccount(
            'PaginationCursor Case 以外 ID テスト',
            TestDataFactory.SaveMode.INSERT_RECORD
        );

        System.runAs(testUser) {
            Test.startTest();
            try {
                CaseEmailMessageController.getEmailMessagePaginationCursor(accountRecord.Id);
                Assert.fail('Case 以外の ID は AuraHandledException にする必要あり');
            } catch (AuraHandledException e) {
                Assert.isNotNull(e, 'Case 以外の ID は利用者向け例外に変換する必要あり');
            }
            Test.stopTest();
        }
    }

    /**
     * ケースに紐づくメールメッセージを返却
     */
    @IsTest
    static void shouldReturnEmailMessagesForCase() {
        Case caseRecord = TestDataFactory.createCase(
            'メール一覧 Controller テスト',
            TestDataFactory.SaveMode.INSERT_RECORD
        );
        Datetime earlierMessageDate = Datetime.newInstance(2026, 7, 16, 9, 0, 0);
        insert new List<EmailMessage>{
            createEmailMessage(caseRecord.Id, '古い Controller 取得対象', earlierMessageDate),
            createEmailMessage(caseRecord.Id, '新しい Controller 取得対象', earlierMessageDate.addHours(1))
        };
        Database.PaginationCursor paginationCursor;
        CaseEmailMessagePageWrapper result;

        System.runAs(testUser) {
            Test.startTest();

            paginationCursor = CaseEmailMessageController.getEmailMessagePaginationCursor(caseRecord.Id);
            result = CaseEmailMessageController.getEmailMessages(caseRecord.Id, paginationCursor, 0);

            Test.stopTest();
        }

        Assert.areEqual(2, result.emailMessages.size(), 'ケースに紐づくメールメッセージを 2 件返す必要あり');
        Assert.areEqual(
            '古い Controller 取得対象',
            result.emailMessages[0].Subject,
            '取得結果を送信日時の昇順にする必要あり'
        );
        Assert.areEqual(
            '新しい Controller 取得対象',
            result.emailMessages[1].Subject,
            '新しいメールを古いメールの後に返す必要あり'
        );
        Assert.isTrue(result.emailMessages[0].Incoming, '取得結果に受信方向を含む必要あり');
        Assert.areEqual('テスト用メール本文', result.emailMessages[0].TextBody, '取得結果にメール本文を含む必要あり');
        Assert.isFalse(result.hasNextPage, '2 件の取得結果では次ページを返さない必要あり');
        Assert.isNotNull(result.paginationCursor, 'LWCへPaginationCursorを返す必要あり');
        Assert.areEqual(0, result.nextIndex, '最終ページの次の取得位置は 0 にする必要あり');
    }

    /**
     * ケース ID が null の場合は空結果を返却
     */
    @IsTest
    static void shouldReturnEmptyListWhenCaseIdIsNull() {
        CaseEmailMessagePageWrapper result;

        System.runAs(testUser) {
            Test.startTest();

            result = CaseEmailMessageController.getEmailMessages(null, null, 0);

            Test.stopTest();
        }

        Assert.areEqual(0, result.emailMessages.size(), 'ケース ID がない場合は空のページを返す必要あり');
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
                CaseEmailMessageController.getEmailMessages(accountRecord.Id, null, 0);
                Assert.fail('ケース以外の ID は AuraHandledException にする必要あり');
            } catch (AuraHandledException e) {
                Assert.isNotNull(e, 'ケース以外の ID は利用者向け例外に変換する必要あり');
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
