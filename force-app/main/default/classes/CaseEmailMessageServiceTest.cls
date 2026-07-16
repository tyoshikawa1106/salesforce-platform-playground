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
}
