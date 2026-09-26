/** 一括更新の検索境界・要求検証・同時編集判定テスト */
@IsTest
private with sharing class AccountMassUpdateServiceTest {

    private static User testUser = TestDataFactory.getTestUser();

    @IsTest
    static void normalizesInclusiveDatesAndRejectsInvalidAnchors() {
        System.runAs(testUser) {
            Date day = Date.newInstance(2026, 9, 24);
            AccountMassUpdateService service = new AccountMassUpdateService();
            Test.startTest();
            AccountMassUpdateWrapper searchRequest1 = new AccountMassUpdateWrapper();
            searchRequest1.searchTerm = '  法人  ';
            searchRequest1.startDate = day;
            searchRequest1.endDate = day;
            searchRequest1.afterCreated = null;
            searchRequest1.afterId = null;
            AccountMassUpdateWrapper result = service.prepareSearch(searchRequest1);
            AccountMassUpdateWrapper searchRequest2 = new AccountMassUpdateWrapper();
            searchRequest2.searchTerm = '';
            searchRequest2.startDate = null;
            searchRequest2.endDate = null;
            searchRequest2.afterCreated = System.now();
            searchRequest2.afterId = null;
            AccountMassUpdateWrapper invalid = service.prepareSearch(searchRequest2);
            Test.stopTest();
            Assert.areEqual('法人', result.searchTerm, '前後空白を除去');
            Assert.areEqual(
                Datetime.newInstance(day, Time.newInstance(0, 0, 0, 0)),
                result.startAt,
                '現地時刻の開始日を含む'
            );
            Assert.areEqual(
                Datetime.newInstance(day.addDays(1), Time.newInstance(0, 0, 0, 0)),
                result.endBefore,
                '終了日の翌日未満'
            );
            Assert.areNotEqual('', invalid.errorMessage, '片側だけのページ境界を拒否');
        }
    }

    @IsTest
    static void rejectsMissingDuplicateAndOversizedRequests() {
        System.runAs(testUser) {
            Account record = TestDataFactory.createAccount('件数検証', TestDataFactory.SaveMode.INSERT_RECORD);
            AccountMassUpdateService service = new AccountMassUpdateService();
            Map<Id, Datetime> versions = new Map<Id, Datetime>{ record.Id => System.now() };
            List<Account> changes = new List<Account>();
            for (Integer position = 0; position < 201; position++) {
                changes.add(new Account(Id = record.Id, Rating = 'Hot'));
            }
            Test.startTest();
            AccountMassUpdateWrapper oversized = service.prepareSave(changes, versions);
            AccountMassUpdateWrapper missing = service.prepareSave(null, versions);
            AccountMassUpdateWrapper duplicate = service.prepareSave(
                new List<Account>{ changes[0], changes[1] },
                versions
            );
            AccountMassUpdateWrapper noVersion = service.prepareSave(
                new List<Account>{ changes[0] },
                new Map<Id, Datetime>()
            );
            Test.stopTest();
            Assert.areNotEqual('', oversized.errorMessage, '201件を拒否');
            Assert.areNotEqual('', missing.errorMessage, '未指定を拒否');
            Assert.areNotEqual('', duplicate.errorMessage, '重複IDを拒否');
            Assert.areNotEqual('', noVersion.errorMessage, '更新前情報なしを拒否');
        }
    }

    @IsTest
    static void handlesUnchangedMissingAndChangedRowsWithoutMutatingInput() {
        System.runAs(testUser) {
            Account record = TestDataFactory.createAccount('差分検証', TestDataFactory.SaveMode.INSERT_RECORD);
            List<Account> current = [
                SELECT Id, Rating, Industry, Type, OwnerId, LastModifiedDate
                FROM Account
                WHERE Id = :record.Id
            ];
            AccountMassUpdateService service = new AccountMassUpdateService();
            Map<Id, Datetime> versions = new Map<Id, Datetime>{ record.Id => current[0].LastModifiedDate };
            List<Account> changes = new List<Account>{ new Account(Id = record.Id, Rating = 'Hot') };
            Test.startTest();
            AccountMassUpdateWrapper changed = service.buildUpdates(changes, versions, current);
            AccountMassUpdateWrapper missing = service.buildUpdates(changes, versions, new List<Account>());
            AccountMassUpdateWrapper same = service.buildUpdates(
                new List<Account>{ new Account(Id = record.Id, OwnerId = current[0].OwnerId) },
                versions,
                current
            );
            Test.stopTest();
            Assert.areEqual('Hot', changed.records[0].Rating, '実際の差分だけを作成');
            Assert.isNull(current[0].Rating, '元のレコードを変更しない');
            Assert.isTrue(missing.errors.containsKey(record.Id), '取得不能の行を拒否');
            Assert.isTrue(same.records.isEmpty(), '同じ値をDMLしない');
            Assert.isTrue(same.successIds.contains(record.Id), '変更なしの行は完了扱い');
        }
    }

    @IsTest
    static void boundsPageWithoutChangingInput() {
        System.runAs(testUser) {
            List<Account> records = new List<Account>();
            for (Integer position = 0; position < 201; position++) {
                records.add(new Account(Name = '表示行 ' + position));
            }
            Test.startTest();
            AccountMassUpdateWrapper result = new AccountMassUpdateService()
                .createPage(records, new List<String>{ 'Rating' });
            Test.stopTest();
            Assert.areEqual(200, result.records.size(), '200行まで表示');
            Assert.isTrue(result.hasNext, '201行目で次ページを判定');
            Assert.areEqual(201, records.size(), '入力リストを破壊しない');
        }
    }
}
