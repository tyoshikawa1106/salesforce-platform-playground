/** 取引先検索のページ境界・日付範囲・法人限定テスト */
@IsTest
private with sharing class AccountMassUpdateSelectorTest {

    private static User testUser = TestDataFactory.getTestUser();

    @IsTest
    static void pagesEqualCreatedDatesWithoutDuplicates() {
        System.runAs(testUser) {
            List<Account> records = new List<Account>();
            for (Integer position = 0; position < 205; position++) {
                records.add(
                    TestDataFactory.createAccount('境界検索 ' + position, TestDataFactory.SaveMode.DO_NOT_INSERT)
                );
            }
            insert records;
            Datetime created = Datetime.newInstance(2026, 9, 24, 12, 0, 0);
            for (Account record : records) {
                Test.setCreatedDate(record.Id, created);
            }
            AccountMassUpdateService service = new AccountMassUpdateService();
            AccountMassUpdateSelector selector = new AccountMassUpdateSelector();
            AccountMassUpdateWrapper searchRequest1 = new AccountMassUpdateWrapper();
            searchRequest1.searchTerm = '境界検索';
            searchRequest1.startDate = Date.newInstance(2026, 9, 24);
            searchRequest1.endDate = Date.newInstance(2026, 9, 24);
            searchRequest1.afterCreated = null;
            searchRequest1.afterId = null;
            AccountMassUpdateWrapper query = service.prepareSearch(searchRequest1);
            Test.startTest();
            List<Account> first = selector.searchAccounts(query);
            AccountMassUpdateWrapper searchRequest2 = new AccountMassUpdateWrapper();
            searchRequest2.searchTerm = '境界検索';
            searchRequest2.startDate = null;
            searchRequest2.endDate = null;
            searchRequest2.afterCreated = first[199].CreatedDate;
            searchRequest2.afterId = first[199].Id;
            AccountMassUpdateWrapper nextQuery = service.prepareSearch(searchRequest2);
            List<Account> second = selector.searchAccounts(nextQuery);
            Test.stopTest();
            Assert.areEqual(201, first.size(), '次ページ判定用に一行追加');
            Assert.areEqual(5, second.size(), '200行目の次から取得');
            Set<Id> seen = new Set<Id>();
            for (Integer position = 0; position < 200; position++) {
                seen.add(first[position].Id);
            }
            for (Account record : second) {
                Assert.isFalse(seen.contains(record.Id), '同一日時でも重複しない');
            }
        }
    }

    @IsTest
    static void escapesWildcardsAndShortCircuitsEmptyIds() {
        System.runAs(testUser) {
            TestDataFactory.createAccount('法人_100%', TestDataFactory.SaveMode.INSERT_RECORD);
            TestDataFactory.createAccount('法人A100X', TestDataFactory.SaveMode.INSERT_RECORD);
            AccountMassUpdateWrapper searchRequest3 = new AccountMassUpdateWrapper();
            searchRequest3.searchTerm = '_100%';
            searchRequest3.startDate = null;
            searchRequest3.endDate = null;
            searchRequest3.afterCreated = null;
            searchRequest3.afterId = null;
            AccountMassUpdateWrapper query = new AccountMassUpdateService().prepareSearch(searchRequest3);
            AccountMassUpdateSelector selector = new AccountMassUpdateSelector();
            Test.startTest();
            Integer beforeQueries = Limits.getQueries();
            List<Account> empty = selector.lockAccounts(new Set<Id>(), query);
            Assert.areEqual(beforeQueries, Limits.getQueries(), '空IDでクエリしない');
            List<Account> result = selector.searchAccounts(query);
            Test.stopTest();
            Assert.isTrue(empty.isEmpty(), '空IDは空結果');
            Assert.areEqual(1, result.size(), 'ワイルドカードを通常文字として扱う');
        }
    }

    @IsTest
    static void excludesPersonAccountsFromSearchAndLock() {
        System.runAs(testUser) {
            List<RecordType> personTypes = new List<RecordType>();
            if (Account.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).fields.getMap().containsKey('IsPersonAccount')) {
                personTypes = Database.query('SELECT Id FROM RecordType WHERE SObjectType = \'Account\' AND IsPersonType = true LIMIT 1');
            }
            // 個人取引先未有効の組織では法人検索の分岐を確認
            if (personTypes.isEmpty()) {
                Test.startTest();
                AccountMassUpdateWrapper searchRequest4 = new AccountMassUpdateWrapper();
                searchRequest4.searchTerm = '';
                searchRequest4.startDate = null;
                searchRequest4.endDate = null;
                searchRequest4.afterCreated = null;
                searchRequest4.afterId = null;
                AccountMassUpdateWrapper query = new AccountMassUpdateService().prepareSearch(searchRequest4);
                List<Account> result = new AccountMassUpdateSelector().searchAccounts(query);
                Test.stopTest();
                Assert.isTrue(result.isEmpty(), '未有効組織でも検索可能');
                return;
            }
            Account person = new Account();
            person.put('RecordTypeId', personTypes[0].Id);
            person.put('LastName', '個人除外テスト');
            insert person;
            Account business = TestDataFactory.createAccount('法人対象', TestDataFactory.SaveMode.INSERT_RECORD);
            AccountMassUpdateWrapper searchRequest5 = new AccountMassUpdateWrapper();
            searchRequest5.searchTerm = '';
            searchRequest5.startDate = null;
            searchRequest5.endDate = null;
            searchRequest5.afterCreated = null;
            searchRequest5.afterId = null;
            AccountMassUpdateWrapper query = new AccountMassUpdateService().prepareSearch(searchRequest5);
            Test.startTest();
            List<Account> result = new AccountMassUpdateSelector().searchAccounts(query);
            List<Account> locked = new AccountMassUpdateSelector()
                .lockAccounts(new Set<Id>{ person.Id, business.Id }, query);
            Test.stopTest();
            Assert.areEqual(1, result.size(), '個人を検索対象から除外');
            Assert.areEqual(business.Id, locked[0].Id, '更新時にも法人だけを取得');
            Assert.areEqual(1, locked.size(), '個人IDの改ざんを拒否');
        }
    }
}
