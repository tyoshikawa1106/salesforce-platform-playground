/**
 * 汎用レコード検索画面の Apex 入口テスト
 */
@IsTest
private with sharing class ObjectRecordSearchControllerTest {

    private static User testUser = new User(Id = UserInfo.getUserId());

    @TestSetup
    static void setupTestData() {
        List<Account> accounts = new List<Account>();

        Account alphaAccount = new Account(Name = '検索対象 Alpha');
        alphaAccount.Industry = 'Technology';
        alphaAccount.Type = 'Prospect';
        alphaAccount.BillingState = '東京都';
        alphaAccount.BillingCity = '千代田区';
        accounts.add(alphaAccount);

        accounts.add(new Account(Name = '検索対象 Beta'));
        accounts.add(new Account(Name = '削除対象 Gamma'));
        insert accounts;
    }

    /**
     * メトリクスキーに対応する検索設定を返却
     */
    @IsTest
    static void shouldReturnObjectConfigForMetricKey() {
        ObjectRecordSearchConfigWrapper config;

        System.runAs(testUser) {
            Test.startTest();

            config = ObjectRecordSearchController.getObjectConfig('accounts');

            Test.stopTest();
        }

        Assert.areEqual(
            'accounts',
            config.metricKey,
            'Config はメトリクスキーを保つ必要あり'
        );
        Assert.areEqual(
            'Account',
            config.objectApiName,
            'Account メトリクスは Account に解決する必要あり'
        );
        Assert.areEqual(
            'Name',
            config.nameFieldApiName,
            'Account 一覧は Name 項目を使う必要あり'
        );
        Assert.isTrue(
            config.createable,
            'Account config はオブジェクト作成可否を公開する必要あり'
        );
        Assert.isTrue(
            config.updateable,
            'Account config はオブジェクト更新可否を公開する必要あり'
        );
        Assert.isTrue(
            config.nameFieldCreateable,
            'Account config は Name 作成可否を公開する必要あり'
        );
        Assert.isTrue(
            config.nameFieldUpdateable,
            'Account config は Name 更新可否を公開する必要あり'
        );
        Assert.isTrue(
            config.displayFields.size() > 0,
            'Account config は seed/import の表示項目を公開する必要あり'
        );
        Map<String, ObjectRecordSearchFieldWrapper> displayFieldsByApiName = new Map<String, ObjectRecordSearchFieldWrapper>();
        for (
            ObjectRecordSearchFieldWrapper displayField : config.displayFields
        ) {
            displayFieldsByApiName.put(displayField.apiName, displayField);
        }
        Assert.isTrue(
            displayFieldsByApiName.containsKey('AccountNumber'),
            'Account 表示項目は AccountNumber を含む必要あり'
        );
        Assert.isTrue(
            displayFieldsByApiName.containsKey('Industry'),
            'Account 表示項目は Industry を含む必要あり'
        );
        Assert.isTrue(
            displayFieldsByApiName.containsKey('BillingState'),
            'Account 表示項目は BillingState を含む必要あり'
        );
        Assert.isTrue(
            displayFieldsByApiName.containsKey('BillingCity'),
            'Account 表示項目は BillingCity を含む必要あり'
        );
        Assert.isFalse(
            displayFieldsByApiName.containsKey('BillingCountry'),
            'Account 表示項目は BillingCountry を含めない必要あり'
        );
        Assert.areEqual(
            'text',
            displayFieldsByApiName.get('Industry').dataType,
            '選択リストの表示項目は text データテーブル型を使う必要あり'
        );
        Assert.areEqual(
            'phone',
            displayFieldsByApiName.get('Phone').dataType,
            '電話の表示項目は phone データテーブル型を使う必要あり'
        );
        Assert.areEqual(
            'url',
            displayFieldsByApiName.get('Website').dataType,
            'URL の表示項目は url データテーブル型を使う必要あり'
        );
    }

    /**
     * Name 項目の検索語でレコード一覧を返却
     */
    @IsTest
    static void shouldSearchRecordsByNameField() {
        ObjectRecordSearchRequestWrapper request = createSearchRequest(
            'accounts',
            'Alpha'
        );
        request.pageNumber = 1;
        ObjectRecordSearchResultWrapper result;

        System.runAs(testUser) {
            Test.startTest();

            result = ObjectRecordSearchController.searchRecords(request);

            Test.stopTest();
        }

        Assert.areEqual(
            1,
            result.records.size(),
            '検索は一致するレコードだけを返す必要あり'
        );
        Assert.areEqual(
            '検索対象 Alpha',
            result.records[0].name,
            'Name 項目は行ラベルにマッピングする必要あり'
        );
        Assert.isTrue(
            result.records[0].recordUrl.contains('/lightning/r/Account/'),
            '行は標準レコード URL を含む必要あり'
        );
        Assert.areEqual(
            'Technology',
            result.records[0].fieldValues.get('Industry'),
            '行は seed/import の固定項目を公開する必要あり'
        );
        Assert.areEqual(
            'Prospect',
            result.records[0].fieldValues.get('Type'),
            '行はインポートプランの Account Type を含む必要あり'
        );
        Assert.areEqual(
            '東京都',
            result.records[0].fieldValues.get('BillingState'),
            '行は Account の請求先都道府県を公開する必要あり'
        );
        Assert.areEqual(
            '千代田区',
            result.records[0].fieldValues.get('BillingCity'),
            '行は Account の請求先市区町村を公開する必要あり'
        );
    }

    /**
     * 検索語なしでも初期表示用レコード一覧を返却
     */
    @IsTest
    static void shouldReturnRowsWhenSearchTermIsBlank() {
        ObjectRecordSearchRequestWrapper request = createSearchRequest(
            'accounts',
            ' '
        );
        ObjectRecordSearchResultWrapper result;

        System.runAs(testUser) {
            Test.startTest();

            result = ObjectRecordSearchController.searchRecords(request);

            Test.stopTest();
        }

        Assert.areEqual(
            3,
            result.records.size(),
            '空白検索は利用可能な Account 行をすべて返す必要あり'
        );
        Assert.areEqual(
            50,
            result.pageSize,
            '検索結果はページサイズを公開する必要あり'
        );
        Assert.areEqual(
            1,
            result.pageNumber,
            '検索結果はページ番号を 1 ページ目に初期化する必要あり'
        );
    }

    /**
     * 削除 ID が null の場合は空の削除結果を返却
     */
    @IsTest
    static void shouldReturnEmptyDeleteResultWhenRecordIdsAreNull() {
        ObjectRecordSearchDeleteWrapper result;

        System.runAs(testUser) {
            Test.startTest();

            result = ObjectRecordSearchController.deleteRecords(
                'accounts',
                null
            );

            Test.stopTest();
        }

        Assert.areEqual(
            0,
            result.requestedCount,
            'null の削除リクエストは依頼件数を 0 にする必要あり'
        );
        Assert.areEqual(
            0,
            result.deletedCount,
            'null の削除リクエストはレコードを削除しない必要あり'
        );
        Assert.areEqual(
            0,
            result.errors.size(),
            'null の削除リクエストはエラーを返さない必要あり'
        );
    }

    /**
     * 削除 ID が空の場合は空の削除結果を返却
     */
    @IsTest
    static void shouldReturnEmptyDeleteResultWhenRecordIdsAreEmpty() {
        ObjectRecordSearchDeleteWrapper result;

        System.runAs(testUser) {
            Test.startTest();

            result = ObjectRecordSearchController.deleteRecords(
                'accounts',
                new List<Id>()
            );

            Test.stopTest();
        }

        Assert.areEqual(
            0,
            result.requestedCount,
            '空の削除リクエストは依頼件数を 0 にする必要あり'
        );
        Assert.areEqual(
            0,
            result.deletedCount,
            '空の削除リクエストはレコードを削除しない必要あり'
        );
        Assert.areEqual(
            0,
            result.errors.size(),
            '空の削除リクエストはエラーを返さない必要あり'
        );
    }

    /**
     * 未対応メトリクスキーは画面向けエラーへ変換
     */
    @IsTest
    static void shouldThrowUserFacingErrorWhenMetricKeyIsUnsupported() {
        ObjectRecordSearchRequestWrapper request = createSearchRequest(
            'unknown',
            null
        );
        request.pageNumber = 1;

        System.runAs(testUser) {
            Test.startTest();

            try {
                ObjectRecordSearchController.searchRecords(request);
                Assert.fail('未対応のメトリクスキーは例外にする必要あり');
            } catch (AuraHandledException e) {
                Assert.isTrue(
                    e.getMessage().contains('別のカードを選択'),
                    '未対応のメトリクスキーは次の操作を選べる案内にする必要あり'
                );
            }

            Test.stopTest();
        }

    }

    /**
     * 不正なページ取得位置は画面向けエラーへ変換
     */
    @IsTest
    static void shouldThrowUserFacingErrorWhenPageTokenIsInvalid() {
        ObjectRecordSearchRequestWrapper request = createSearchRequest(
            'accounts',
            null
        );
        request.startIndex = -1;

        System.runAs(testUser) {
            Test.startTest();

            try {
                ObjectRecordSearchController.searchRecords(request);
                Assert.fail('不正なページ取得位置は例外にする必要あり');
            } catch (AuraHandledException e) {
                Assert.isTrue(
                    e.getMessage().contains('一覧を更新'),
                    '不正なページ取得位置は再読み込みを案内する必要あり'
                );
            }

            Test.stopTest();
        }

    }

    /**
     * 指定されたレコードを削除して結果を返却
     */
    @IsTest
    static void shouldDeleteSelectedRecords() {
        Account target = [
            SELECT Id
            FROM Account
            WHERE Name = '削除対象 Gamma'
            LIMIT 1
        ];
        ObjectRecordSearchDeleteWrapper result;

        System.runAs(testUser) {
            Test.startTest();

            result = ObjectRecordSearchController.deleteRecords(
                'accounts',
                new List<Id>{ target.Id }
            );

            Test.stopTest();
        }

        Assert.areEqual(
            1,
            result.requestedCount,
            '削除結果は依頼件数を含む必要あり'
        );
        Assert.areEqual(
            1,
            result.deletedCount,
            '削除結果は削除件数を含む必要あり'
        );
        Assert.areEqual(
            0,
            result.errors.size(),
            '成功した削除はエラーを返さない必要あり'
        );
        Assert.areEqual(
            0,
            [
                SELECT COUNT()
                FROM Account
                WHERE Id = :target.Id AND IsDeleted = FALSE
                ALL ROWS
            ],
            '削除済みレコードは有効な状態で残らない必要あり'
        );
    }

    /**
     * 重複した削除IDを未処理エラーとして返却
     */
    @IsTest
    static void shouldReturnDeleteErrorWhenRecordIdIsDuplicated() {
        Account target = [
            SELECT Id
            FROM Account
            WHERE Name = '削除対象 Gamma'
            LIMIT 1
        ];
        ObjectRecordSearchDeleteWrapper result;

        System.runAs(testUser) {
            Test.startTest();

            result = ObjectRecordSearchController.deleteRecords(
                'accounts',
                new List<Id>{ target.Id, target.Id }
            );

            Test.stopTest();
        }

        Assert.areEqual(
            2,
            result.requestedCount,
            '重複したIDも受信した削除要求件数に含める必要あり'
        );
        Assert.areEqual(
            1,
            result.deletedCount,
            '同じレコードは1回だけ削除する必要あり'
        );
        Assert.areEqual(
            1,
            result.errors.size(),
            'DMLへ到達しなかった重複要求をエラーにする必要あり'
        );
    }

    private static ObjectRecordSearchRequestWrapper createSearchRequest(String metricKey, String searchTerm) {
        ObjectRecordSearchRequestWrapper request = new ObjectRecordSearchRequestWrapper();
        request.metricKey = metricKey;
        request.searchTerm = searchTerm;
        return request;
    }

    /**
     * 設定取得の未対応メトリクスはカード選択用メッセージへ変換
     */
    @IsTest
    static void shouldReturnUnsupportedMetricMessageForConfig() {
        String errorMessage;

        System.runAs(testUser) {
            Test.startTest();

            errorMessage = getConfigErrorMessage('unknown');

            Test.stopTest();
        }

        Assert.areEqual(
            'このカードのレコード一覧は表示できません。別のカードを選択してください。',
            errorMessage,
            '設定取得の未対応メトリクスは別カードの選択を案内する必要あり'
        );
    }

    /**
     * 削除の未対応メトリクスはカード選択用メッセージへ変換
     */
    @IsTest
    static void shouldReturnUnsupportedMetricMessageForDelete() {
        String errorMessage;

        System.runAs(testUser) {
            Test.startTest();

            errorMessage = getDeleteErrorMessage('unknown');

            Test.stopTest();
        }

        Assert.areEqual(
            'このカードのレコード一覧は表示できません。別のカードを選択してください。',
            errorMessage,
            '削除の未対応メトリクスは別カードの選択を案内する必要あり'
        );
    }

    private static String getConfigErrorMessage(String metricKey) {
        try {
            ObjectRecordSearchController.getObjectConfig(metricKey);
            return null;
        } catch (AuraHandledException e) {
            return e.getMessage();
        }
    }

    private static String getDeleteErrorMessage(String metricKey) {
        try {
            ObjectRecordSearchController.deleteRecords(
                metricKey,
                new List<Id>{ UserInfo.getUserId() }
            );
            return null;
        } catch (AuraHandledException e) {
            return e.getMessage();
        }
    }

    /** 選択リストの昇順で全ページを取得 */
    @IsTest
    static void shouldPagePicklistsAscending() {
        System.runAs(testUser) {
            createSearchPaginationRecords();
            List<Id> expected = recordIds([SELECT Id FROM Opportunity ORDER BY StageName ASC NULLS LAST, Id ASC]);
            Test.startTest();
            List<Id> actual = readPages('opportunities', 'StageName', 'asc');
            Test.stopTest();
            Assert.areEqual(expected, actual, '標準ORDER BYと全ページの順序・件数が一致する必要あり');
        }
    }

    /** 選択リストの降順で全ページを取得 */
    @IsTest
    static void shouldPagePicklistsDescending() {
        System.runAs(testUser) {
            createSearchPaginationRecords();
            List<Id> expected = recordIds([SELECT Id FROM Opportunity ORDER BY StageName DESC NULLS LAST, Id ASC]);
            Test.startTest();
            List<Id> actual = readPages('opportunities', 'StageName', 'desc');
            Test.stopTest();
            Assert.areEqual(expected, actual, '標準ORDER BYと全ページの順序・件数が一致する必要あり');
        }
    }

    /** Booleanの昇順で全ページを取得 */
    @IsTest
    static void shouldPageBooleansAscending() {
        System.runAs(testUser) {
            createSearchPaginationRecords();
            List<Id> expected = recordIds([SELECT Id FROM Product2 ORDER BY IsActive ASC NULLS LAST, Id ASC]);
            Test.startTest();
            List<Id> actual = readPages('products', 'IsActive', 'asc');
            Test.stopTest();
            Assert.areEqual(expected, actual, '標準ORDER BYと全ページの順序・件数が一致する必要あり');
        }
    }

    /** Booleanの降順で全ページを取得 */
    @IsTest
    static void shouldPageBooleansDescending() {
        System.runAs(testUser) {
            createSearchPaginationRecords();
            List<Id> expected = recordIds([SELECT Id FROM Product2 ORDER BY IsActive DESC NULLS LAST, Id ASC]);
            Test.startTest();
            List<Id> actual = readPages('products', 'IsActive', 'desc');
            Test.stopTest();
            Assert.areEqual(expected, actual, '標準ORDER BYと全ページの順序・件数が一致する必要あり');
        }
    }

    /** nullを含む選択リストで全ページを取得 */
    @IsTest
    static void shouldPageNullablePicklists() {
        System.runAs(testUser) {
            createSearchPaginationRecords();
            List<Id> expected = recordIds([SELECT Id FROM Account ORDER BY Industry ASC NULLS LAST, Id ASC]);
            Test.startTest();
            List<Id> actual = readPages('accounts', 'Industry', 'asc');
            Test.stopTest();
            Assert.areEqual(expected, actual, '標準ORDER BYと全ページの順序・件数が一致する必要あり');
        }
    }

    private static List<Id> recordIds(List<SObject> records) {
        List<Id> ids = new List<Id>();
        for (SObject record : records) {
            ids.add(record.Id);
        }
        return ids;
    }

    private static List<Id> readPages(String key, String field, String direction) {
        List<Id> actualIds = new List<Id>();
        ObjectRecordSearchRequestWrapper request = new ObjectRecordSearchRequestWrapper();
        request.metricKey = key;
        request.sortBy = field;
        request.sortDirection = direction;
        Boolean hasNext = true;
        while (hasNext && request.pageNumber <= 10) {
            ObjectRecordSearchResultWrapper page = ObjectRecordSearchController.searchRecords(request);
            for (ObjectRecordSearchRowWrapper row : page.records) {
                actualIds.add(row.id);
            }
            hasNext = page.hasNextPage;
            request.paginationCursor = page.paginationCursor;
            request.startIndex = page.nextIndex;
            request.pageNumber++;
            // LWCとの往復で標準カーソルをそのまま復元できることも検証
            request = (ObjectRecordSearchRequestWrapper) JSON.deserialize(JSON.serialize(request), ObjectRecordSearchRequestWrapper.class);
        }
        Assert.isFalse(hasNext, '全ページを上限内に読み切る必要あり');
        return actualIds;
    }

    /** 同じカーソルで先頭ページへ戻る */
    @IsTest
    static void shouldReturnToFirstPageUsingSameCursor() {
        System.runAs(testUser) {
            createSearchPaginationRecords();
            Test.startTest();
            ObjectRecordSearchRequestWrapper request = new ObjectRecordSearchRequestWrapper();
            request.metricKey = 'accounts';
            ObjectRecordSearchResultWrapper first = ObjectRecordSearchController.searchRecords(request);
            request.paginationCursor = first.paginationCursor;
            request.startIndex = first.nextIndex;
            ObjectRecordSearchController.searchRecords(request);
            request.startIndex = 0;
            ObjectRecordSearchResultWrapper previous = ObjectRecordSearchController.searchRecords(request);
            Test.stopTest();
            Assert.areEqual(first.records[0].id, previous.records[0].id, '同じカーソルの先頭へ戻れる必要あり');
            Assert.areEqual(first.records.size(), previous.records.size(), '前ページの件数を保持する必要あり');
        }
    }

    /** ページング境界を確認する型別レコードを準備 */
    private static void createSearchPaginationRecords() {
        // 設定順に並ぶ選択値とnullを別々のグループにする
        List<Schema.PicklistEntry> values = Account.Industry.getDescribe().getPicklistValues();
        // 同値内の境界も越える件数を用意
        List<Account> accounts = new List<Account>();
        List<Product2> products = new List<Product2>();
        List<Opportunity> opportunities = new List<Opportunity>();
        for (Integer index = 0; index < 251; index++) {
            // 同値内のページ境界を比較できる名前を設定
            Account record = new Account(Name = 'Pagination ' + index);
            record.Industry = index < 100 ? values[0].getValue() : (index < 200 ? values[1].getValue() : null);
            accounts.add(record);
            // Booleanの両値がそれぞれ複数ページになるようにする
            Product2 product = new Product2(Name = 'Pagination ' + index, IsActive = true);
            product.IsActive = index < 125;
            products.add(product);
        }
        // トリガの一括境界も越えた状態で保存
        insert accounts;
        insert products;
        // 設定順ではProspectingが先、字句順ではNeeds Analysisが先になる組合せ
        for (Integer index = 0; index < 251; index++) {
            Opportunity opportunity = new Opportunity(AccountId = accounts[0].Id, Name = 'Pagination ' + index, StageName = 'Prospecting', CloseDate = Date.today().addDays(30));
            opportunity.StageName = index < 125 ? 'Prospecting' : 'Needs Analysis';
            opportunities.add(opportunity);
        }
        insert opportunities;
    }
}