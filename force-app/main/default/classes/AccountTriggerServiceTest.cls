/**
 * 取引先トリガーサービスの振る舞いテスト
 */
@IsTest
private with sharing class AccountTriggerServiceTest {

    private static AccountTriggerService service = new AccountTriggerService();

    private static User testUser = new User(Id = UserInfo.getUserId());

    private static final Id ACCOUNT_ID = Id.valueOf(Account.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).getKeyPrefix() + '000000000001');

    /**
     * 新規取引先の法人格略称を正式名称へ補正
     */
    @IsTest
    static void shouldNormalizeAccountNamesWhenInserted() {
        // 準備
        List<Account> accounts = new List<Account>{
            new Account(Name = '㈱テスト'),
            new Account(Name = '（株）テスト'),
            new Account(Name = '(株)テスト'),
            new Account(Name = '㈲テスト'),
            new Account(Name = '（有）テスト'),
            new Account(Name = '(有)テスト')
        };

        // 実行

        System.runAs(testUser) {
            Test.startTest();

            // 新規レコード一覧の法人格略称を正式名称へ補正
            service.normalizeAccountNamesForInsert(accounts);

            Test.stopTest();
        }

        // 検証
        Assert.areEqual(
            '株式会社テスト',
            accounts[0].Name,
            '㈱ は正式名称へ補正する必要あり'
        );
        Assert.areEqual(
            '株式会社テスト',
            accounts[1].Name,
            '（株）は正式名称へ補正する必要あり'
        );
        Assert.areEqual(
            '株式会社テスト',
            accounts[2].Name,
            '(株) は正式名称へ補正する必要あり'
        );
        Assert.areEqual(
            '有限会社テスト',
            accounts[3].Name,
            '㈲ は正式名称へ補正する必要あり'
        );
        Assert.areEqual(
            '有限会社テスト',
            accounts[4].Name,
            '（有）は正式名称へ補正する必要あり'
        );
        Assert.areEqual(
            '有限会社テスト',
            accounts[5].Name,
            '(有) は正式名称へ補正する必要あり'
        );
    }

    /**
     * 変更された取引先名の法人格略称だけを補正
     */
    @IsTest
    static void shouldNormalizeChangedAccountNamesWhenUpdated() {
        // 準備
        Account accountRecord = new Account(Id = ACCOUNT_ID, Name = 'テスト取引先');
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
        Account savedAccount = new Account(Id = ACCOUNT_ID, Name = 'テスト取引先');
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
            new Account(Name = ' '),
            new Account(Name = '㈱テスト')
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
        Account savedAccount = new Account(Id = ACCOUNT_ID, Name = 'テスト取引先');
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
        Account savedAccount = new Account(Id = ACCOUNT_ID, Name = 'テスト取引先');
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
    /**
     * 法人格略称の前後位置を保って正式名称へ補正
     */
    @IsTest
    static void shouldKeepCompanyTypePositionWhenAccountsInserted() {
        // 準備
        List<Account> accounts = new List<Account>{
            new Account(Name = 'テスト（株）'),
            new Account(Name = 'テスト(有)')
        };

        // 実行

        System.runAs(testUser) {
            Test.startTest();

            // 法人格略称の位置を保ったまま新規名称補正を適用
            service.normalizeAccountNamesForInsert(accounts);

            Test.stopTest();
        }

        // 検証
        Assert.areEqual(
            'テスト株式会社',
            accounts[0].Name,
            '株式会社の法人格位置は維持する必要あり'
        );
        Assert.areEqual(
            'テスト有限会社',
            accounts[1].Name,
            '有限会社の法人格位置は維持する必要あり'
        );
    }
    /**
     * 複数の法人格略称を含む取引先名を正式名称へ補正
     */
    @IsTest
    static void shouldNormalizeMultipleCompanyAbbreviationsInAccountName() {
        // 準備
        Account accountRecord = new Account(Name = '㈱テスト(有)支店');

        // 実行

        System.runAs(testUser) {
            Test.startTest();

            // 一つの名称に含まれる複数の略称をまとめて補正
            service.normalizeAccountNamesForInsert(new List<Account>{ accountRecord });

            Test.stopTest();
        }

        // 検証
        Assert.areEqual(
            '株式会社テスト有限会社支店',
            accountRecord.Name,
            '取引先名に含まれる法人格略称はすべて補正する必要あり'
        );
    }
    /**
     * 正式名称の法人格表記は変更せず保持
     */
    @IsTest
    static void shouldKeepFormalCompanyNamesWhenAlreadyNormalized() {
        // 準備
        Account accountRecord = new Account(Name = '株式会社テスト');

        // 実行

        System.runAs(testUser) {
            Test.startTest();

            // 既に正式名称の取引先名を変更対象から除外
            service.normalizeAccountNamesForInsert(new List<Account>{ accountRecord });

            Test.stopTest();
        }

        // 検証
        Assert.areEqual(
            '株式会社テスト',
            accountRecord.Name,
            '正式名称の取引先名は変更しない必要あり'
        );
    }
    /**
     * 不完全な法人格略称は補正対象外として保持
     */
    @IsTest
    static void shouldKeepIncompleteAbbreviationsWhenAccountsInserted() {
        // 準備
        List<Account> accounts = new List<Account>{
            new Account(Name = '株）テスト'),
            new Account(Name = '（株テスト'),
            new Account(Name = '有)テスト'),
            new Account(Name = '(有テスト')
        };

        // 実行

        System.runAs(testUser) {
            Test.startTest();

            // 不完全な略称を補正対象にしない変換処理を検証
            service.normalizeAccountNamesForInsert(accounts);

            Test.stopTest();
        }

        // 検証
        Assert.areEqual(
            '株）テスト',
            accounts[0].Name,
            '不完全な株式会社略称は変更しない必要あり'
        );
        Assert.areEqual(
            '（株テスト',
            accounts[1].Name,
            '不完全な株式会社略称は変更しない必要あり'
        );
        Assert.areEqual(
            '有)テスト',
            accounts[2].Name,
            '不完全な有限会社略称は変更しない必要あり'
        );
        Assert.areEqual(
            '(有テスト',
            accounts[3].Name,
            '不完全な有限会社略称は変更しない必要あり'
        );
    }
}