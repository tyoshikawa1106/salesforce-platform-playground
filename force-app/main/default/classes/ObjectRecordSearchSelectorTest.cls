/**
 * 汎用レコード検索 Selector の動的 SOQL と bind 実行テスト
 */
@IsTest
private with sharing class ObjectRecordSearchSelectorTest {

    private static User testUser = TestDataFactory.getTestUser();

    @TestSetup
    static void setupTestData() {
        List<Account> accounts = new List<Account>();

        Account alphaAccount = TestDataFactory.createAccount('Selector Alpha', TestDataFactory.SaveMode.DO_NOT_INSERT);
        alphaAccount.Industry = 'Technology';
        accounts.add(alphaAccount);

        Account betaAccount = TestDataFactory.createAccount('Selector Beta', TestDataFactory.SaveMode.DO_NOT_INSERT);
        betaAccount.Industry = 'Finance';
        accounts.add(betaAccount);

        Account deleteOneAccount = TestDataFactory.createAccount('Selector Delete One', TestDataFactory.SaveMode.DO_NOT_INSERT);
        deleteOneAccount.Industry = 'Healthcare';
        accounts.add(deleteOneAccount);

        Account deleteTwoAccount = TestDataFactory.createAccount('Selector Delete Two', TestDataFactory.SaveMode.DO_NOT_INSERT);
        deleteTwoAccount.Industry = 'Retail';
        accounts.add(deleteTwoAccount);

        Account retailTwoAccount = TestDataFactory.createAccount('Selector Retail Two', TestDataFactory.SaveMode.DO_NOT_INSERT);
        retailTwoAccount.Industry = 'Retail';
        accounts.add(retailTwoAccount);

        accounts.add(TestDataFactory.createAccount('Selector Null One', TestDataFactory.SaveMode.DO_NOT_INSERT));
        accounts.add(TestDataFactory.createAccount('Selector Null Two', TestDataFactory.SaveMode.DO_NOT_INSERT));
        insert accounts;
    }

    @IsTest
    static void shouldUseBoundSearchWithStandardCursor() {
        System.runAs(testUser) {
            Test.startTest();
            ObjectRecordSearchRequestWrapper input = new ObjectRecordSearchRequestWrapper();
            input.metricKey = 'accounts';
            input.searchTerm = ' Selector Alpha ';
            ObjectRecordSearchResultWrapper page = ObjectRecordSearchController.searchRecords(input);
            Test.stopTest();
            Assert.areEqual(1, page.records.size(), '名称検索が標準カーソルにも適用される必要あり');
            Assert.areEqual('Selector Alpha', page.records[0].name, '前後空白を正規化する必要あり');
            Assert.isFalse(page.hasNextPage, '最終ページの次へを無効化する必要あり');
        }
    }

    @IsTest
    static void shouldReturnEmptyPage() {
        System.runAs(testUser) {
            Test.startTest();
            ObjectRecordSearchRequestWrapper input = new ObjectRecordSearchRequestWrapper();
            input.metricKey = 'accounts';
            input.searchTerm = 'No matching records';
            ObjectRecordSearchResultWrapper page = ObjectRecordSearchController.searchRecords(input);
            Test.stopTest();
            Assert.areEqual(0, page.records.size(), '対象なしは空一覧となる必要あり');
            Assert.isFalse(page.hasNextPage, '対象なしで次ページを作らない必要あり');
        }
    }

    /**
     * 指定 ID を bind 値にして一致レコードを取得
     */
    @IsTest
    static void getRecordsByIdShouldReturnMatchingRows() {
        Account target = [
            SELECT Id
            FROM Account
            WHERE Name = 'Selector Delete One'
            LIMIT 1
        ];
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        List<SObject> records;

        System.runAs(testUser) {
            Test.startTest();

            records = selector.getRecordsById(
                'Account',
                new Set<Id>{ target.Id }
            );

            Test.stopTest();
        }

        Assert.areEqual(
            1,
            records.size(),
            'Selector は指定 ID に一致するレコードだけを返す必要あり'
        );
        Assert.areEqual(
            target.Id,
            (Id) records[0].get('Id'),
            'Selector は bind したレコード ID を保つ必要あり'
        );
    }

    /**
     * ID が null の場合は空リストを返却
     */
    @IsTest
    static void getRecordsByIdShouldReturnEmptyListWhenIdsAreNull() {
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        List<SObject> records;

        System.runAs(testUser) {
            Test.startTest();

            records = selector.getRecordsById('Account', null);

            Test.stopTest();
        }

        Assert.areEqual(
            0,
            records.size(),
            'null ID は SOQL を実行せず空結果を返す必要あり'
        );
    }

    /**
     * ID が空の場合は空リストを返却
     */
    @IsTest
    static void getRecordsByIdShouldReturnEmptyListWhenIdsAreEmpty() {
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        List<SObject> records;

        System.runAs(testUser) {
            Test.startTest();

            records = selector.getRecordsById('Account', new Set<Id>());

            Test.stopTest();
        }

        Assert.areEqual(
            0,
            records.size(),
            '空 ID は SOQL を実行せず空結果を返す必要あり'
        );
    }

    /**
     * 対象外オブジェクトのIDは検索結果へ含めない
     */
    @IsTest
    static void getRecordsByIdShouldExcludeIdsFromAnotherObject() {
        Account parentAccount = [
            SELECT Id
            FROM Account
            WHERE Name = 'Selector Alpha'
            LIMIT 1
        ];
        Contact contactRecord = TestDataFactory.createContact(
            parentAccount,
            'Selector Contact',
            TestDataFactory.SaveMode.INSERT_RECORD
        );
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();
        List<SObject> records;

        System.runAs(testUser) {
            Test.startTest();

            records = selector.getRecordsById(
                'Account',
                new Set<Id>{ contactRecord.Id }
            );

            Test.stopTest();
        }

        Assert.areEqual(
            0,
            records.size(),
            'Account検索ではContact IDを取得対象にしない必要あり'
        );
    }

    /**
     * 未対応オブジェクトは ID 未指定でも拒否
     */
    @IsTest
    static void getRecordsByIdShouldRejectUnsupportedObjectWithEmptyIds() {
        ObjectRecordSearchSelector selector = new ObjectRecordSearchSelector();

        System.runAs(testUser) {
            Test.startTest();

            try {
                selector.getRecordsById(
                    'UnknownObject__c',
                    new Set<Id>()
                );
                Assert.fail('未対応オブジェクトは ID 未指定でも拒否する必要あり');
            } catch (IllegalArgumentException e) {
                Assert.isTrue(
                    e.getMessage().contains('許可されていない'),
                    '未対応オブジェクトは内部契約違反として拒否する必要あり'
                );
            }

            Test.stopTest();
        }
    }

}