/**
 * 取引先 PDF の Visualforce 入口テスト
 */
@IsTest
private with sharing class AccountPdfControllerTest {
    private static User testUser = TestDataFactory.getTestUser();

    /**
     * URL の取引先情報を PDF 表示モデルへ変換
     */
    @IsTest
    static void shouldLoadAccountDataWhenAccountIdIsValid() {
        Account accountRecord = TestDataFactory.createAccount(
            '株式会社 PDF Controller テスト',
            TestDataFactory.SaveMode.DO_NOT_INSERT
        );
        accountRecord.AccountNumber = 'PDF-001';
        accountRecord.Phone = '03-0000-0000';
        accountRecord.Website = 'https://example.com/account';
        accountRecord.BillingPostalCode = '100-0001';
        accountRecord.BillingState = '東京都';
        accountRecord.BillingCity = '千代田区';
        accountRecord.BillingStreet = '千代田1-1';
        accountRecord.BillingCountry = '日本';
        accountRecord.Description = '1行目\n2行目 & <確認>';
        insert accountRecord;
        setCurrentPage(String.valueOf(accountRecord.Id));
        AccountPdfController result;

        System.runAs(testUser) {
            Test.startTest();

            result = new AccountPdfController();

            Test.stopTest();
        }

        Assert.isFalse(result.hasError, '正常な取引先ではエラーにしない必要あり');
        Assert.areEqual('', result.errorMessage, '正常時はエラーメッセージを空にする必要あり');
        Assert.areEqual('株式会社 PDF Controller テスト', result.accountData.accountName, '取引先名を表示する必要あり');
        Assert.areEqual('PDF-001', result.accountData.accountNumber, '取引先番号を表示する必要あり');
        Assert.areEqual('03-0000-0000', result.accountData.phone, '電話を表示する必要あり');
        Assert.areEqual('https://example.com/account', result.accountData.website, 'Web サイトを表示する必要あり');
        Assert.areEqual(
            '100-0001\n東京都千代田区\n千代田1-1\n日本',
            result.accountData.billingAddress,
            '請求先住所を複数行で表示する必要あり'
        );
        Assert.areEqual('1行目\n2行目 & <確認>', result.accountData.description, '説明の改行と特殊文字を保持する必要あり');
    }

    /**
     * 取引先 ID 未指定を安全なエラー表示へ変換
     */
    @IsTest
    static void shouldShowSafeErrorWhenAccountIdIsMissing() {
        setCurrentPage(null);
        AccountPdfController result;

        System.runAs(testUser) {
            Test.startTest();

            result = new AccountPdfController();

            Test.stopTest();
        }

        Assert.isTrue(result.hasError, '取引先 ID 未指定はエラーにする必要あり');
        Assert.isTrue(result.errorMessage.contains('取引先を確認できませんでした'), '安全な入力エラーを表示する必要あり');
    }

    /**
     * 不正な ID 形式を安全なエラー表示へ変換
     */
    @IsTest
    static void shouldShowSafeErrorWhenAccountIdIsMalformed() {
        setCurrentPage('invalid-id');
        AccountPdfController result;

        System.runAs(testUser) {
            Test.startTest();

            result = new AccountPdfController();

            Test.stopTest();
        }

        Assert.isTrue(result.hasError, '不正な ID 形式はエラーにする必要あり');
        Assert.isTrue(result.errorMessage.contains('取引先を確認できませんでした'), '内部例外を表示しない必要あり');
    }

    /**
     * 取引先以外の ID を安全なエラー表示へ変換
     */
    @IsTest
    static void shouldShowSafeErrorWhenIdBelongsToAnotherObject() {
        Account accountRecord = TestDataFactory.createAccount(
            'PDF Controller 取引先以外 ID テスト',
            TestDataFactory.SaveMode.INSERT_RECORD
        );
        Contact contactRecord = TestDataFactory.createContact(
            accountRecord,
            'Controller テスト',
            TestDataFactory.SaveMode.INSERT_RECORD
        );
        setCurrentPage(String.valueOf(contactRecord.Id));
        AccountPdfController result;

        System.runAs(testUser) {
            Test.startTest();

            result = new AccountPdfController();

            Test.stopTest();
        }

        Assert.isTrue(result.hasError, '取引先以外の ID はエラーにする必要あり');
        Assert.isTrue(result.errorMessage.contains('取引先を確認できませんでした'), '安全な入力エラーを表示する必要あり');
    }

    /**
     * 存在しない取引先を権限外と区別せず案内
     */
    @IsTest
    static void shouldShowSafeErrorWhenAccountDoesNotExist() {
        Account deletedAccount = TestDataFactory.createAccount(
            'PDF Controller 削除済みテスト',
            TestDataFactory.SaveMode.INSERT_RECORD
        );
        Id deletedAccountId = deletedAccount.Id;
        delete deletedAccount;
        setCurrentPage(String.valueOf(deletedAccountId));
        AccountPdfController result;

        System.runAs(testUser) {
            Test.startTest();

            result = new AccountPdfController();

            Test.stopTest();
        }

        Assert.isTrue(result.hasError, '存在しない取引先はエラーにする必要あり');
        Assert.isTrue(result.errorMessage.contains('参照権限'), '不存在と権限外を区別しない案内にする必要あり');
    }

    private static void setCurrentPage(String accountId) {
        Test.setCurrentPage(Page.AccountPdf);
        if (accountId != null) {
            ApexPages.currentPage().getParameters().put('accountId', accountId);
        }
    }
}
