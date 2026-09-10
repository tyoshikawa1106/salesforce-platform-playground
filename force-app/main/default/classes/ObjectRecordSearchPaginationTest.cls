/**
 * 標準PaginationCursorによる型別ページングと再取得の統合テスト
 */
@IsTest
private with sharing class ObjectRecordSearchPaginationTest {
    @TestSetup
    static void setupData() {
        TestDataFactory.createSearchPaginationRecords();
    }

    @IsTest
    static void shouldPagePicklistsAscending() {
        System.runAs(TestDataFactory.getTestUser()) {
            List<Id> expected = recordIds([SELECT Id FROM Opportunity ORDER BY StageName ASC NULLS LAST, Id ASC]);
            Test.startTest();
            List<Id> actual = readPages('opportunities', 'StageName', 'asc');
            Test.stopTest();
            Assert.areEqual(expected, actual, '標準ORDER BYと全ページの順序・件数が一致する必要あり');
        }
    }

    @IsTest
    static void shouldPagePicklistsDescending() {
        System.runAs(TestDataFactory.getTestUser()) {
            List<Id> expected = recordIds([SELECT Id FROM Opportunity ORDER BY StageName DESC NULLS LAST, Id ASC]);
            Test.startTest();
            List<Id> actual = readPages('opportunities', 'StageName', 'desc');
            Test.stopTest();
            Assert.areEqual(expected, actual, '標準ORDER BYと全ページの順序・件数が一致する必要あり');
        }
    }

    @IsTest
    static void shouldPageBooleansAscending() {
        System.runAs(TestDataFactory.getTestUser()) {
            List<Id> expected = recordIds([SELECT Id FROM Product2 ORDER BY IsActive ASC NULLS LAST, Id ASC]);
            Test.startTest();
            List<Id> actual = readPages('products', 'IsActive', 'asc');
            Test.stopTest();
            Assert.areEqual(expected, actual, '標準ORDER BYと全ページの順序・件数が一致する必要あり');
        }
    }

    @IsTest
    static void shouldPageBooleansDescending() {
        System.runAs(TestDataFactory.getTestUser()) {
            List<Id> expected = recordIds([SELECT Id FROM Product2 ORDER BY IsActive DESC NULLS LAST, Id ASC]);
            Test.startTest();
            List<Id> actual = readPages('products', 'IsActive', 'desc');
            Test.stopTest();
            Assert.areEqual(expected, actual, '標準ORDER BYと全ページの順序・件数が一致する必要あり');
        }
    }

    @IsTest
    static void shouldPageNullablePicklists() {
        System.runAs(TestDataFactory.getTestUser()) {
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

    @IsTest
    static void shouldReturnToFirstPageUsingSameCursor() {
        System.runAs(TestDataFactory.getTestUser()) {
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
}