/**
 * 取引先 PDF の入力検証と表示値作成テスト
 */
@IsTest
private with sharing class AccountPdfServiceTest {
    private static final AccountPdfService SERVICE = new AccountPdfService();
    private static User testUser = TestDataFactory.getTestUser();

    /**
     * 取引先 ID を検証して返却
     */
    @IsTest
    static void shouldReturnAccountIdWhenParameterIsValid() {
        Account accountRecord = TestDataFactory.createAccount(
            'PDF ID 検証テスト',
            TestDataFactory.SaveMode.INSERT_RECORD
        );
        Id result;

        System.runAs(testUser) {
            Test.startTest();

            result = SERVICE.validateAccountId(String.valueOf(accountRecord.Id));

            Test.stopTest();
        }

        Assert.areEqual(accountRecord.Id, result, '検証済みの取引先 ID を返す必要あり');
    }

    /**
     * 未指定の取引先 ID を拒否
     */
    @IsTest
    static void shouldRejectBlankAccountId() {
        System.runAs(testUser) {
            Test.startTest();
            try {
                SERVICE.validateAccountId('  ');
                Assert.fail('空白だけの取引先 ID は拒否する必要あり');
            } catch (AccountPdfService.AccountPdfServiceException e) {
                Assert.isTrue(
                    e.getMessage().contains('取引先を確認できませんでした'),
                    '安全な入力エラーを返す必要あり'
                );
            }
            Test.stopTest();
        }
    }

    /**
     * ID 形式ではないパラメーターを拒否
     */
    @IsTest
    static void shouldRejectMalformedAccountId() {
        System.runAs(testUser) {
            Test.startTest();
            try {
                SERVICE.validateAccountId('not-an-id');
                Assert.fail('ID 形式ではない値は拒否する必要あり');
            } catch (AccountPdfService.AccountPdfServiceException e) {
                Assert.isTrue(
                    e.getMessage().contains('取引先を確認できませんでした'),
                    '安全な入力エラーを返す必要あり'
                );
            }
            Test.stopTest();
        }
    }

    /**
     * 取引先以外の ID を拒否
     */
    @IsTest
    static void shouldRejectNonAccountId() {
        Account accountRecord = TestDataFactory.createAccount(
            'PDF 取引先以外 ID テスト',
            TestDataFactory.SaveMode.INSERT_RECORD
        );
        Contact contactRecord = TestDataFactory.createContact(
            accountRecord,
            'PDF テスト',
            TestDataFactory.SaveMode.INSERT_RECORD
        );

        System.runAs(testUser) {
            Test.startTest();
            try {
                SERVICE.validateAccountId(String.valueOf(contactRecord.Id));
                Assert.fail('取引先以外の ID は拒否する必要あり');
            } catch (AccountPdfService.AccountPdfServiceException e) {
                Assert.isTrue(
                    e.getMessage().contains('取引先を確認できませんでした'),
                    '安全な入力エラーを返す必要あり'
                );
            }
            Test.stopTest();
        }
    }

    /**
     * 取引先項目を PDF 表示値へ変換
     */
    @IsTest
    static void shouldCreateViewModelWithAccountValues() {
        Account accountRecord = new Account(
            Name = '株式会社サンプル',
            AccountNumber = 'A-001',
            Type = 'Customer - Direct',
            Industry = 'Technology',
            Phone = '03-0000-0000',
            Website = 'https://example.com',
            BillingPostalCode = '100-0001',
            BillingState = '東京都',
            BillingCity = '千代田区',
            BillingStreet = '千代田1-1',
            BillingCountry = '日本',
            ShippingPostalCode = '530-0001',
            ShippingState = '大阪府',
            ShippingCity = '大阪市',
            ShippingStreet = '梅田1-1',
            ShippingCountry = '日本',
            Description = '1行目\n\n2行目 <script>'
        );
        AccountPdfViewModel result;

        System.runAs(testUser) {
            Test.startTest();

            result = SERVICE.createViewModel(accountRecord);

            Test.stopTest();
        }

        Assert.areEqual('株式会社サンプル', result.accountName, '取引先名を表示する必要あり');
        Assert.areEqual('A-001', result.accountNumber, '取引先番号を表示する必要あり');
        Assert.areEqual('Customer - Direct', result.accountType, '種別を表示する必要あり');
        Assert.areEqual('Technology', result.industry, '業種を表示する必要あり');
        Assert.areEqual('03-0000-0000', result.phone, '電話を表示する必要あり');
        Assert.areEqual('https://example.com', result.website, 'Web サイトを表示する必要あり');
        Assert.areEqual(
            '100-0001\n東京都千代田区\n千代田1-1\n日本',
            result.billingAddress,
            '請求先住所を複数行で表示する必要あり'
        );
        Assert.areEqual(
            '530-0001\n大阪府大阪市\n梅田1-1\n日本',
            result.shippingAddress,
            '納入先住所を複数行で表示する必要あり'
        );
        Assert.areEqual('1行目\n\n2行目 <script>', result.description, '説明の改行と特殊文字を保持する必要あり');
    }

    /**
     * 空項目を共通の代替表示へ変換
     */
    @IsTest
    static void shouldUsePlaceholderWhenAccountFieldsAreBlank() {
        Account accountRecord = new Account(Name = '空項目テスト');
        AccountPdfViewModel result;

        System.runAs(testUser) {
            Test.startTest();

            result = SERVICE.createViewModel(accountRecord);

            Test.stopTest();
        }

        Assert.areEqual('―', result.accountNumber, '空の取引先番号を代替表示にする必要あり');
        Assert.areEqual('―', result.billingAddress, '空の請求先住所を代替表示にする必要あり');
        Assert.areEqual('―', result.shippingAddress, '空の納入先住所を代替表示にする必要あり');
        Assert.areEqual('―', result.description, '空の説明を代替表示にする必要あり');
    }

    /**
     * 取得できない取引先を安全なエラーへ変換
     */
    @IsTest
    static void shouldRejectNullAccountRecord() {
        System.runAs(testUser) {
            Test.startTest();
            try {
                SERVICE.createViewModel(null);
                Assert.fail('取得できない取引先は拒否する必要あり');
            } catch (AccountPdfService.AccountPdfServiceException e) {
                Assert.isTrue(e.getMessage().contains('参照権限'), '権限と不存在を区別しない案内を返す必要あり');
            }
            Test.stopTest();
        }
    }
}
