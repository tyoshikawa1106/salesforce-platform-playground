/** 一括更新の検索境界・要求検証・同時編集判定テスト */
@IsTest
private with sharing class AccountMassUpdateServiceTest {

    private static AccountMassUpdateService service = new AccountMassUpdateService();

    private static User testUser = new User(Id = UserInfo.getUserId());
    private static User deniedUser = new User(
        Alias = 'limited', LastName = '権限なしテスト', Email = 'limited@example.invalid',
        Username = 'limited.' + EncodingUtil.convertToHex(Crypto.generateAesKey(128)) + '@example.invalid',
        TimeZoneSidKey = 'Asia/Tokyo', LocaleSidKey = 'ja_JP',
        EmailEncodingKey = 'UTF-8', LanguageLocaleKey = 'ja'
    );

    /** 日付境界を正規化し不完全なページ境界を拒否 */
    @IsTest
    static void normalizesInclusiveDatesAndRejectsInvalidAnchors() {

        System.runAs(testUser) {
            Date day = Date.newInstance(2026, 9, 24);
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
            AccountMassUpdateWrapper defaults = service.prepareSearch(null);
            Assert.areEqual('', defaults.searchTerm, '未指定検索語は空文字');
            Assert.isNull(defaults.startAt, '未指定開始日は条件なし');
            Assert.isNull(defaults.endBefore, '未指定終了日は条件なし');
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

    /** 欠落・重複・上限超過の保存要求を拒否 */
    @IsTest
    static void rejectsMissingDuplicateAndOversizedRequests() {

        System.runAs(testUser) {
            Account record = new Account(Id = Id.valueOf(Account.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).getKeyPrefix() + '000000000001'));
            Map<Id, Datetime> versions = new Map<Id, Datetime>{ record.Id => System.now() };
            List<Account> changes = new List<Account>();
            for (Integer position = 0; position < 201; position++) {
                changes.add(new Account(Id = record.Id, Rating = 'Hot'));
            }
            Test.startTest();
            AccountMassUpdateWrapper oversized = service.prepareSave(changes, versions);
            AccountMassUpdateWrapper missing = service.prepareSave(null, versions);
            AccountMassUpdateWrapper valid = service.prepareSave(new List<Account>{ changes[0] }, versions);
            Assert.areEqual(new Set<Id>{ record.Id }, valid.recordIds, '正当な要求を検索対象へ渡す');
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

    /** 入力を変更せず変更なし・取得不可・変更行を判定 */
    @IsTest
    static void handlesUnchangedMissingAndChangedRowsWithoutMutatingInput() {

        System.runAs(testUser) {
            Account record = (Account) JSON.deserialize(
                '{"Id":"' + Account.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).getKeyPrefix() +
                '000000000001","OwnerId":"' + testUser.Id + '","LastModifiedDate":"2026-01-01T00:00:00.000Z"}',
                Account.class
            );
            List<Account> current = new List<Account>{ record };
            Map<Id, Datetime> versions = new Map<Id, Datetime>{ record.Id => current[0].LastModifiedDate };
            List<Account> changes = new List<Account>{ new Account(Id = record.Id, Rating = 'Hot') };
            Test.startTest();
            AccountMassUpdateWrapper changed = service.buildUpdates(changes, versions, current);
            AccountMassUpdateWrapper missing = service.buildUpdates(changes, versions, new List<Account>());
            AccountMassUpdateWrapper stale = service.buildUpdates(
                changes, new Map<Id, Datetime>{ record.Id => current[0].LastModifiedDate.addSeconds(-1) }, current
            );
            Assert.isTrue(stale.errors.containsKey(record.Id), '更新前日時が異なる行は拒否');
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

    /** 入力を変更せず表示件数を制限 */
    @IsTest
    static void boundsPageWithoutChangingInput() {

        System.runAs(testUser) {
            List<Account> records = new List<Account>();
            for (Integer position = 0; position < 201; position++) {
                records.add(new Account(Name = '表示行 ' + position));
            }
            Test.startTest();
            AccountMassUpdateWrapper result = service.createPage(records, new List<String>{ 'Rating' });
            Test.stopTest();
            Assert.areEqual(200, result.records.size(), '200行まで表示');
            Assert.isTrue(result.hasNext, '201行目で次ページを判定');
            Assert.areEqual(201, records.size(), '入力リストを破壊しない');
        }
    }

    /** 保存結果を成功・失敗へ分け、事前の判定結果を引き継ぐ */
    @IsTest
    static void aggregatesSaveResultsWithoutChangingInput() {

        System.runAs(testUser) {
            List<Account> records = new List<Account>{
                new Account(Name = '保存成功'), new Account(Name = '保存失敗')
            };
            insert records;
            AccountMassUpdateWrapper prepared = new AccountMassUpdateWrapper();
            prepared.records = new List<Account>{
                new Account(Id = records[0].Id, Rating = 'Hot'),
                new Account(Id = records[1].Id, OwnerId = null)
            };
            Id unchangedId = Id.valueOf(Account.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).getKeyPrefix() + '000000000001');
            prepared.successIds.add(unchangedId);
            prepared.errors.put(unchangedId, '事前判定');
            Test.startTest();
            List<Database.SaveResult> results = Database.update(prepared.records, false, AccessLevel.USER_MODE);
            AccountMassUpdateWrapper result = service.createSaveResult(prepared, results);
            Test.stopTest();
            Assert.areEqual(new List<Id>{ unchangedId, records[0].Id }, result.successIds, '既存と今回の成功を保持');
            Assert.areEqual('事前判定', result.errors.get(unchangedId), '事前のエラーを保持');
            Assert.isTrue(result.errors.get(records[1].Id).contains(String.valueOf(results[1].getErrors()[0].getStatusCode())), '失敗種別を返す');
            Assert.areEqual(1, prepared.successIds.size(), '入力の成功一覧を変更しない');
            Assert.areEqual(1, prepared.errors.size(), '入力のエラー一覧を変更しない');
        }
    }

    /** 参照権限がない利用者の検索と保存を拒否 */
    @IsTest
    static void rejectsRequestsWithoutReadAccess() {
        insertDeniedUser();

        System.runAs(deniedUser) {
            Test.startTest();
            AccountMassUpdateWrapper search = service.prepareSearch(null);
            AccountMassUpdateWrapper save = service.prepareSave(null, null);
            Test.stopTest();
            Assert.areEqual('取引先の参照権限がありません。', search.errorMessage, '検索前に参照権限を確認');
            Assert.areEqual(search.errorMessage, save.errorMessage, '保存前も同じ参照権限を確認');
        }
    }

    /** 権限拒否を確認するユーザーだけを保存 */
    private static void insertDeniedUser() {
        List<Profile> profiles = [
            SELECT Id FROM Profile
            WHERE PermissionsModifyAllData = false AND UserLicense.Name = 'Salesforce'
            ORDER BY Name LIMIT 1
        ];
        Assert.isFalse(profiles.isEmpty(), '権限なしのプロファイルが存在');
        deniedUser.ProfileId = profiles[0].Id;
        insert deniedUser;
    }
}
