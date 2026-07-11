/**
 * 取引先トリガーサービスの振る舞いテスト
 */
@IsTest
private with sharing class AccountTriggerServiceTest {

    private static User testUser = TestDataFactory.getTestUser();

    private static AccountTriggerService service = new AccountTriggerService();

    /**
     * 新規取引先名の法人格略称を正式名称へ補正
     */
    @IsTest
    static void shouldNormalizeAccountNamesWhenInserted() {
        // 準備
        List<Account> accounts = new List<Account>{
            TestDataFactory.createAccount('㈱テスト', false),
            TestDataFactory.createAccount('テスト(有)支店', false)
        };

        // 実行

        System.runAs(testUser) {
            Test.startTest();

            // 新規レコード一覧の法人格表記を標準表記へ補正
            service.normalizeAccountNamesForInsert(accounts);

            Test.stopTest();
        }

        // 検証
        Assert.areEqual(
            '株式会社テスト',
            accounts[0].Name,
            'Insert service は取引先名を補正する必要あり'
        );
        Assert.areEqual(
            'テスト有限会社支店',
            accounts[1].Name,
            'Insert service は有限会社の略称を補正する必要あり'
        );
    }

    /**
     * 変更された取引先名の法人格略称だけを補正
     */
    @IsTest
    static void shouldNormalizeChangedAccountNamesWhenUpdated() {
        // 準備
        Account accountRecord = TestDataFactory.createAccount('テスト取引先', true);
        // 更新前後の名称差分を発生させる入力値
        Account updatedAccount = new Account(
            Id = accountRecord.Id,
            Name = 'テスト（株）'
        );
        // 更新前レコードを Id で引ける状態にして差分判定を成立
        Map<Id, Account> oldAccountMap = new Map<Id, Account>{
            accountRecord.Id => accountRecord
        };

        // 実行

        System.runAs(testUser) {
            Test.startTest();

            // 変更された名称だけを補正対象にする更新処理を検証
            service.normalizeChangedAccountNamesForUpdate(new List<Account>{ updatedAccount }, oldAccountMap);

            Test.stopTest();
        }

        // 検証
        Assert.areEqual(
            'テスト株式会社',
            updatedAccount.Name,
            'Update service は変更された取引先名を補正する必要あり'
        );
    }

    /**
     * 未変更の取引先名は補正処理を行わず保持
     */
    @IsTest
    static void shouldSkipUnchangedAccountNamesWhenUpdated() {
        // 準備
        Account savedAccount = TestDataFactory.createAccount('テスト取引先', true);
        Account accountRecord = new Account(
            Id = savedAccount.Id,
            Name = '㈱テスト'
        );
        Account oldAccount = new Account(
            Id = savedAccount.Id,
            Name = '㈱テスト'
        );
        Map<Id, Account> oldAccountMap = new Map<Id, Account>{
            accountRecord.Id => oldAccount
        };

        // 実行

        System.runAs(testUser) {
            Test.startTest();

            service.normalizeChangedAccountNamesForUpdate(new List<Account>{ accountRecord }, oldAccountMap);

            Test.stopTest();
        }

        // 検証
        Assert.areEqual(
            '㈱テスト',
            accountRecord.Name,
            '未変更の取引先名は更新処理で補正しない必要あり'
        );
    }

    /**
     * 空の新規取引先一覧は処理せず完了
     */
    @IsTest
    static void shouldDoNothingWhenInsertedAccountsEmpty() {
        // 準備
        List<Account> accounts = new List<Account>();

        // 実行

        System.runAs(testUser) {
            Test.startTest();
            service.normalizeAccountNamesForInsert(accounts);

            Test.stopTest();
        }

        // 検証
        Assert.areEqual(0, accounts.size(), '空の入力は空のままにする必要あり');
    }

    /**
     * null と空白の取引先名は補正対象外として保持
     */
    @IsTest
    static void shouldSkipNullAndBlankNamesWhenInserted() {
        // 準備
        List<Account> accounts = new List<Account>{
            null,
            TestDataFactory.createAccount(' ', false),
            TestDataFactory.createAccount('㈱テスト', false)
        };

        // 実行

        System.runAs(testUser) {
            Test.startTest();
            service.normalizeAccountNamesForInsert(accounts);

            Test.stopTest();
        }

        // 検証
        Assert.isNull(accounts[0], 'null のリスト要素は null のままにする必要あり');
        Assert.areEqual(
            ' ',
            accounts[1].Name,
            '空白の取引先名は補正しない必要あり'
        );
        Assert.areEqual(
            '株式会社テスト',
            accounts[2].Name,
            '空白でない取引先名は補正する必要あり'
        );
    }

    /**
     * 更新前レコードが見つからない場合も新名称を補正
     */
    @IsTest
    static void shouldNormalizeWhenUpdatedOldAccountIsMissing() {
        // 準備
        Account savedAccount = TestDataFactory.createAccount('テスト取引先', true);
        Account updatedAccount = new Account(
            Id = savedAccount.Id,
            Name = '㈱テスト'
        );

        // 実行

        System.runAs(testUser) {
            Test.startTest();

            service.normalizeChangedAccountNamesForUpdate(new List<Account>{ updatedAccount }, new Map<Id, Account>());

            Test.stopTest();
        }

        // 検証
        Assert.areEqual(
            '株式会社テスト',
            updatedAccount.Name,
            '変更前レコードがない取引先は変更ありとして扱う必要あり'
        );
    }

    /**
     * 更新前レコードが null の場合も新名称を補正
     */
    @IsTest
    static void shouldNormalizeWhenUpdatedOldAccountIsNull() {
        // 準備
        Account savedAccount = TestDataFactory.createAccount('テスト取引先', true);
        Account updatedAccount = new Account(
            Id = savedAccount.Id,
            Name = '㈲テスト'
        );

        // 実行

        System.runAs(testUser) {
            Test.startTest();

            service.normalizeChangedAccountNamesForUpdate(new List<Account>{ updatedAccount }, new Map<Id, Account>{ savedAccount.Id => null });

            Test.stopTest();
        }

        // 検証
        Assert.areEqual(
            '有限会社テスト',
            updatedAccount.Name,
            '変更前レコードが null の取引先は変更ありとして扱う必要あり'
        );
    }
}
