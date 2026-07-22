/**
 * 取引先 PDF の取引先問い合わせテスト
 */
@IsTest
private with sharing class AccountPdfSelectorTest {
    private static final AccountPdfSelector SELECTOR = new AccountPdfSelector();
    private static User testUser = TestDataFactory.getTestUser();

    /**
     * PDF 出力対象項目を利用者権限で取得
     */
    @IsTest
    static void shouldReturnAccountWithPdfFields() {
        Account accountRecord = TestDataFactory.createAccount(
            'PDF Selector テスト',
            TestDataFactory.SaveMode.DO_NOT_INSERT
        );
        accountRecord.AccountNumber = 'SELECTOR-001';
        accountRecord.Phone = '03-0000-0000';
        accountRecord.Website = 'https://example.com';
        accountRecord.BillingStreet = '千代田1-1';
        accountRecord.Description = 'Selector 説明';
        insert accountRecord;
        Account result;

        System.runAs(testUser) {
            Test.startTest();

            result = SELECTOR.getById(accountRecord.Id);

            Test.stopTest();
        }

        Assert.areEqual(accountRecord.Id, result.Id, '指定した取引先を返す必要あり');
        Assert.areEqual('PDF Selector テスト', result.Name, '取引先名を取得する必要あり');
        Assert.areEqual('SELECTOR-001', result.AccountNumber, '取引先番号を取得する必要あり');
        Assert.areEqual('03-0000-0000', result.Phone, '電話を取得する必要あり');
        Assert.areEqual('https://example.com', result.Website, 'Web サイトを取得する必要あり');
        Assert.areEqual('千代田1-1', result.BillingStreet, '請求先住所を取得する必要あり');
        Assert.areEqual('Selector 説明', result.Description, '説明を取得する必要あり');
    }

    /**
     * null ID は問い合わせない
     */
    @IsTest
    static void shouldReturnNullWhenAccountIdIsNull() {
        Account result;

        System.runAs(testUser) {
            Test.startTest();

            result = SELECTOR.getById(null);

            Test.stopTest();
        }

        Assert.isNull(result, '取引先 ID が null の場合は null を返す必要あり');
    }

    /**
     * 存在しない取引先は null を返却
     */
    @IsTest
    static void shouldReturnNullWhenAccountDoesNotExist() {
        Account deletedAccount = TestDataFactory.createAccount(
            'PDF Selector 削除済みテスト',
            TestDataFactory.SaveMode.INSERT_RECORD
        );
        Id deletedAccountId = deletedAccount.Id;
        delete deletedAccount;
        Account result;

        System.runAs(testUser) {
            Test.startTest();

            result = SELECTOR.getById(deletedAccountId);

            Test.stopTest();
        }

        Assert.isNull(result, '存在しない取引先は null を返す必要あり');
    }
}
