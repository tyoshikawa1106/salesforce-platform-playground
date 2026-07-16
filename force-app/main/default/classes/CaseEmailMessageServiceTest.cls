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
        Case caseRecord = TestDataFactory.createCase(
            'Service Case ID テスト',
            TestDataFactory.SaveMode.INSERT_RECORD
        );
        Id validatedCaseId;

        System.runAs(testUser) {
            Test.startTest();

            validatedCaseId = new CaseEmailMessageService().validateCaseId(
                caseRecord.Id
            );

            Test.stopTest();
        }

        Assert.areEqual(
            caseRecord.Id,
            validatedCaseId,
            '検証済み Case ID は入力 ID と一致する必要あり'
        );
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

        Assert.isNull(
            validatedCaseId,
            'null の Case ID は問い合わせなしの入力として返す必要あり'
        );
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
                new CaseEmailMessageService().validateCaseId(
                    accountRecord.Id
                );
                Assert.fail('Case 以外の ID は Service 例外にする必要あり');
            } catch (CaseEmailMessageService.CaseEmailMessageServiceException e) {
                String errorMessage = e.getMessage();
                Boolean describesInvalidCase = errorMessage.contains(
                    'ケースレコード'
                );
                Assert.isTrue(
                    describesInvalidCase,
                    '例外はケースレコードを確認できないことを説明する必要あり'
                );
            }

            Test.stopTest();
        }
    }

    /**
     * 50 件の取得結果から次ページトークンを作成
     */
    @IsTest
    static void shouldCreatePageWithNextPageToken() {
        Datetime earliestMessageDate = Datetime.newInstance(
            2026,
            7,
            16,
            12,
            0,
            0
        );
        List<EmailMessage> emailMessages = createPageEmailMessages(
            50,
            earliestMessageDate
        );
        CaseEmailMessagePageWrapper result;
        CaseEmailMessageService.PageCursor pageCursor;

        System.runAs(testUser) {
            Test.startTest();

            CaseEmailMessageService service = new CaseEmailMessageService();
            result = service.createPage(emailMessages);
            pageCursor = service.parsePageToken(result.nextPageToken);

            Test.stopTest();
        }

        Assert.areEqual(
            50,
            result.emailMessages.size(),
            '1 ページのメールメッセージを 50 件に制限する必要あり'
        );
        Assert.isTrue(
            result.hasNextPage,
            '上限の 50 件を取得した場合は次ページありと判定する必要あり'
        );
        Assert.areEqual(
            50,
            result.pageSize,
            '画面に 1 回の最大取得件数を返す必要あり'
        );
        Assert.areEqual(
            'メール 0',
            result.emailMessages[0].Subject,
            'ページ内で最も古いメールを先頭にする必要あり'
        );
        Assert.areEqual(
            'メール 49',
            result.emailMessages[49].Subject,
            'ページ内で最も新しいメールを末尾にする必要あり'
        );
        Assert.areEqual(
            emailMessages[49].Id,
            pageCursor.recordId,
            '最終表示行の ID を次ページカーソルにする必要あり'
        );
    }

    /**
     * ページトークンがない場合は初回ページカーソルを返却
     */
    @IsTest
    static void shouldReturnInitialCursorWhenPageTokenIsBlank() {
        CaseEmailMessageService.PageCursor pageCursor;

        System.runAs(testUser) {
            Test.startTest();

            pageCursor = new CaseEmailMessageService().parsePageToken(null);

            Test.stopTest();
        }

        Assert.isNull(
            pageCursor.recordId,
            '初回ページではカーソル ID を設定しない必要あり'
        );
    }

    /**
     * 不正なページトークンを拒否
     */
    @IsTest
    static void shouldRejectInvalidPageToken() {
        System.runAs(testUser) {
            Test.startTest();

            try {
                new CaseEmailMessageService().parsePageToken('not-json');
                Assert.fail('不正なページトークンは Service 例外にする必要あり');
            } catch (CaseEmailMessageService.CaseEmailMessageServiceException e) {
                Assert.isTrue(
                    e.getMessage().contains('次のメール'),
                    '例外は次ページの読み込み失敗を説明する必要あり'
                );
            }

            Test.stopTest();
        }
    }

    private static List<EmailMessage> createPageEmailMessages(
        Integer count,
        Datetime earliestMessageDate
    ) {
        List<EmailMessage> emailMessages = new List<EmailMessage>();
        for (Integer index = 0; index < count; index++) {
            String sequence = String.valueOf(index).leftPad(3, '0');
            Map<String, Object> emailMessageValues = new Map<String, Object>{
                'attributes' => new Map<String, Object>{
                    'type' => 'EmailMessage'
                },
                'Id' => '02s000000000' + sequence,
                'Subject' => 'メール ' + index,
                'MessageDate' => earliestMessageDate.addMinutes(index),
                'CreatedDate' => earliestMessageDate.addMinutes(index)
            };
            emailMessages.add(
                (EmailMessage) JSON.deserialize(
                    JSON.serialize(emailMessageValues),
                    EmailMessage.class
                )
            );
        }
        return emailMessages;
    }
}
