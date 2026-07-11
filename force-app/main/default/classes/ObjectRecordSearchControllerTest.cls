/**
 * 汎用レコード検索画面の Apex 入口テスト
 */
@IsTest
private with sharing class ObjectRecordSearchControllerTest {

    private static User testUser = TestDataFactory.getTestUser();

    @TestSetup
    static void setupTestData() {
        List<Account> accounts = new List<Account>();

        Account alphaAccount = TestDataFactory.createAccount('検索対象 Alpha', TestDataFactory.SaveMode.DO_NOT_INSERT);
        alphaAccount.Industry = 'Technology';
        alphaAccount.Type = 'Prospect';
        alphaAccount.BillingState = '東京都';
        alphaAccount.BillingCity = '千代田区';
        accounts.add(alphaAccount);

        accounts.add(TestDataFactory.createAccount('検索対象 Beta', TestDataFactory.SaveMode.DO_NOT_INSERT));
        accounts.add(TestDataFactory.createAccount('削除対象 Gamma', TestDataFactory.SaveMode.DO_NOT_INSERT));
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
                Assert.isNotNull(
                    e,
                    '未対応のメトリクスキーは LWC 向け例外に変換する必要あり'
                );
            }

            Test.stopTest();
        }

    }

    /**
     * 不正なページトークンは画面向けエラーへ変換
     */
    @IsTest
    static void shouldThrowUserFacingErrorWhenPageTokenIsInvalid() {
        ObjectRecordSearchRequestWrapper request = createSearchRequest(
            'accounts',
            null
        );
        request.pageToken = 'not-json';

        System.runAs(testUser) {
            Test.startTest();

            try {
                ObjectRecordSearchController.searchRecords(request);
                Assert.fail('不正なページトークンは例外にする必要あり');
            } catch (AuraHandledException e) {
                Assert.isNotNull(
                    e,
                    '不正なページトークンは LWC 向け例外に変換する必要あり'
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

    private static ObjectRecordSearchRequestWrapper createSearchRequest(String metricKey, String searchTerm) {
        ObjectRecordSearchRequestWrapper request = new ObjectRecordSearchRequestWrapper();
        request.metricKey = metricKey;
        request.searchTerm = searchTerm;
        return request;
    }
}
