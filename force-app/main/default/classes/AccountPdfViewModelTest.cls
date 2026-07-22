/**
 * 取引先 PDF 表示モデルの初期値テスト
 */
@IsTest
private with sharing class AccountPdfViewModelTest {
    private static User testUser = TestDataFactory.getTestUser();

    /**
     * 全項目を共通の空値表示で初期化
     */
    @IsTest
    static void shouldInitializeAllFieldsWithPlaceholder() {
        AccountPdfViewModel result;

        System.runAs(testUser) {
            Test.startTest();

            result = new AccountPdfViewModel();

            Test.stopTest();
        }

        Assert.areEqual('―', result.accountName, '取引先名を空値表示で初期化する必要あり');
        Assert.areEqual('―', result.accountNumber, '取引先番号を空値表示で初期化する必要あり');
        Assert.areEqual('―', result.accountType, '種別を空値表示で初期化する必要あり');
        Assert.areEqual('―', result.industry, '業種を空値表示で初期化する必要あり');
        Assert.areEqual('―', result.phone, '電話を空値表示で初期化する必要あり');
        Assert.areEqual('―', result.website, 'Web サイトを空値表示で初期化する必要あり');
        Assert.areEqual('―', result.billingAddress, '請求先住所を空値表示で初期化する必要あり');
        Assert.areEqual('―', result.shippingAddress, '納入先住所を空値表示で初期化する必要あり');
        Assert.areEqual('―', result.description, '説明を空値表示で初期化する必要あり');
    }
}
