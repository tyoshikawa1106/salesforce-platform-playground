/** 一括更新入口の最大件数・部分成功・改ざん拒否テスト */
@IsTest
private with sharing class AccountMassUpdateControllerTest {

    private static User testUser = TestDataFactory.getTestUser();

    @IsTest
    static void savesTwoHundredDifferentChanges() {
        System.runAs(testUser) {
            List<Account> records = new List<Account>();
            for (Integer position = 0; position < 200; position++) {
                records.add(
                    TestDataFactory.createAccount('一括更新 ' + position, TestDataFactory.SaveMode.DO_NOT_INSERT)
                );
            }
            insert records;
            List<Account> current = [SELECT Id, LastModifiedDate FROM Account];
            Map<Id, Datetime> versions = new Map<Id, Datetime>();
            List<Account> changes = new List<Account>();
            for (Integer position = 0; position < current.size(); position++) {
                versions.put(current[position].Id, current[position].LastModifiedDate);
                changes.add(
                    new Account(Id = current[position].Id, Rating = Math.mod(position, 2) == 0 ? 'Hot' : 'Cold')
                );
            }
            Test.startTest();
            AccountMassUpdateWrapper result = AccountMassUpdateController.saveAccounts(changes, versions);
            Test.stopTest();
            Assert.areEqual('', result.errorMessage, '正当な要求は拒否しない');
            Assert.areEqual(200, result.successIds.size(), '上限200件を保存');
            Assert.areEqual(0, result.errors.size(), '有効な値は全行成功');
            List<Account> saved = [SELECT Id, Rating FROM Account];
            Map<Id, Account> savedMap = new Map<Id, Account>(saved);
            for (Account change : changes) {
                Assert.areEqual(change.Rating, savedMap.get(change.Id).Rating, '行別の値を保存');
            }
        }
    }

    @IsTest
    static void preservesPartialSuccessAndClearsValue() {
        System.runAs(testUser) {
            Account first = TestDataFactory.createAccount('成功対象', TestDataFactory.SaveMode.DO_NOT_INSERT);
            first.Rating = 'Hot';
            Account second = TestDataFactory.createAccount('失敗対象', TestDataFactory.SaveMode.DO_NOT_INSERT);
            insert new List<Account>{ first, second };
            List<Account> current = [SELECT Id, LastModifiedDate FROM Account];
            Map<Id, Datetime> versions = new Map<Id, Datetime>();
            for (Account record : current) {
                versions.put(record.Id, record.LastModifiedDate);
            }
            Test.startTest();
            AccountMassUpdateWrapper result = AccountMassUpdateController.saveAccounts(
                new List<Account>{
                    new Account(Id = first.Id, Rating = null),
                    new Account(Id = second.Id, OwnerId = null)
                },
                versions
            );
            Test.stopTest();
            Assert.isTrue(result.successIds.contains(first.Id), 'クリアを保存');
            Assert.isTrue(result.errors.containsKey(second.Id), '所有者クリアは行別エラー');
            List<Account> saved = [SELECT Rating FROM Account WHERE Id = :first.Id];
            Assert.isNull(saved[0].Rating, 'nullを変更なしと扱わない');
        }
    }

    @IsTest
    static void rejectsStaleAndForbiddenUpdates() {
        System.runAs(testUser) {
            Account record = TestDataFactory.createAccount('変更禁止', TestDataFactory.SaveMode.INSERT_RECORD);
            Test.startTest();
            AccountMassUpdateWrapper stale = AccountMassUpdateController.saveAccounts(
                new List<Account>{ new Account(Id = record.Id, Rating = 'Cold') },
                new Map<Id, Datetime>{ record.Id => Datetime.newInstance(2000, 1, 1, 0, 0, 0) }
            );
            AccountMassUpdateWrapper forbidden = AccountMassUpdateController.saveAccounts(
                new List<Account>{ new Account(Id = record.Id, Name = '改ざん') },
                new Map<Id, Datetime>{ record.Id => System.now() }
            );
            Test.stopTest();
            Assert.isTrue(stale.errors.containsKey(record.Id), '古い値による更新を拒否');
            Assert.isNotNull(forbidden.errorMessage, '拒否理由を返す');
            Assert.areNotEqual('', forbidden.errorMessage, '許可項目以外を拒否');
            List<Account> saved = [SELECT Name, Rating FROM Account WHERE Id = :record.Id];
            Assert.areEqual('変更禁止', saved[0].Name, '不許可の変更を保存しない');
            Assert.isNull(saved[0].Rating, '競合した変更を保存しない');
        }
    }

    @IsTest
    static void searchesBusinessAccountsAndRejectsReverseDates() {
        System.runAs(testUser) {
            TestDataFactory.createAccount('検索テスト', TestDataFactory.SaveMode.INSERT_RECORD);
            Test.startTest();
            AccountMassUpdateWrapper searchRequest1 = new AccountMassUpdateWrapper();
            searchRequest1.searchTerm = '検索';
            searchRequest1.startDate = null;
            searchRequest1.endDate = null;
            searchRequest1.afterCreated = null;
            searchRequest1.afterId = null;
            AccountMassUpdateWrapper result = AccountMassUpdateController.searchAccounts(searchRequest1);
            AccountMassUpdateWrapper searchRequest2 = new AccountMassUpdateWrapper();
            searchRequest2.searchTerm = '';
            searchRequest2.startDate = Date.today();
            searchRequest2.endDate = Date.today().addDays(-1);
            searchRequest2.afterCreated = null;
            searchRequest2.afterId = null;
            AccountMassUpdateWrapper rejected = AccountMassUpdateController.searchAccounts(searchRequest2);
            Test.stopTest();
            Assert.areEqual(1, result.records.size(), '名前で絞り込み');
            Assert.isFalse(result.hasNext, '一行に次ページはない');
            Assert.areNotEqual('', rejected.errorMessage, '逆転した日付を拒否');
        }
    }
}