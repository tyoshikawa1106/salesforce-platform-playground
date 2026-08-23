/**
 * 汎用レコード検索 Controller の想定外例外境界テスト
 */
@IsTest
private with sharing class ObjectRecordSearchControllerErrorTest {

    private static final String INTERNAL_ERROR_MESSAGE = '内部処理の詳細';
    private static User testUser = TestDataFactory.getTestUser();

    /**
     * 設定取得の想定外例外は設定用の一般化メッセージへ変換
     */
    @IsTest
    static void shouldSanitizeUnexpectedConfigError() {
        ObjectRecordSearchController.testService = new FailingObjectRecordSearchService();
        String errorMessage;

        System.runAs(testUser) {
            Test.startTest();

            errorMessage = getConfigErrorMessage();

            Test.stopTest();
        }

        Assert.areEqual(
            '検索画面を表示できませんでした。時間をおいてもう一度お試しください。',
            errorMessage,
            '設定取得の内部例外は設定用の案内へ変換する必要あり'
        );
        Assert.isFalse(errorMessage.contains(INTERNAL_ERROR_MESSAGE), '設定取得で内部詳細を公開しない必要あり');
    }

    /**
     * 検索の想定外例外は検索用の一般化メッセージへ変換
     */
    @IsTest
    static void shouldSanitizeUnexpectedSearchError() {
        ObjectRecordSearchController.testService = new FailingObjectRecordSearchService();
        ObjectRecordSearchRequestWrapper request = new ObjectRecordSearchRequestWrapper();
        request.metricKey = 'accounts';
        String errorMessage;

        System.runAs(testUser) {
            Test.startTest();

            errorMessage = getSearchErrorMessage(request);

            Test.stopTest();
        }

        Assert.areEqual(
            'レコード一覧を表示できませんでした。検索条件を見直して、もう一度お試しください。',
            errorMessage,
            '検索の内部例外は検索用の案内へ変換する必要あり'
        );
        Assert.isFalse(errorMessage.contains(INTERNAL_ERROR_MESSAGE), '検索で内部詳細を公開しない必要あり');
    }

    /**
     * 削除の想定外例外は削除用の一般化メッセージへ変換
     */
    @IsTest
    static void shouldSanitizeUnexpectedDeleteError() {
        ObjectRecordSearchController.testService = new FailingObjectRecordSearchService();
        String errorMessage;

        System.runAs(testUser) {
            Test.startTest();

            errorMessage = getDeleteErrorMessage();

            Test.stopTest();
        }

        Assert.areEqual(
            '選択したレコードを削除できませんでした。権限やレコードの状態を確認してください。',
            errorMessage,
            '削除の内部例外は削除用の案内へ変換する必要あり'
        );
        Assert.isFalse(errorMessage.contains(INTERNAL_ERROR_MESSAGE), '削除で内部詳細を公開しない必要あり');
    }

    private static String getConfigErrorMessage() {
        try {
            ObjectRecordSearchController.getObjectConfig('accounts');
            return null;
        } catch (AuraHandledException e) {
            return e.getMessage();
        }
    }

    private static String getSearchErrorMessage(ObjectRecordSearchRequestWrapper request) {
        try {
            ObjectRecordSearchController.searchRecords(request);
            return null;
        } catch (AuraHandledException e) {
            return e.getMessage();
        }
    }

    private static String getDeleteErrorMessage() {
        try {
            ObjectRecordSearchController.deleteRecords(
                'accounts',
                new List<Id>{ UserInfo.getUserId() }
            );
            return null;
        } catch (AuraHandledException e) {
            return e.getMessage();
        }
    }

    /**
     * Controller境界へ想定外例外を返すテスト用Service
     */
    private class FailingObjectRecordSearchService extends ObjectRecordSearchService {

        public override ObjectRecordSearchService.SearchContextResult resolveSearchContext(String metricKey) {
            throw new IllegalArgumentException(INTERNAL_ERROR_MESSAGE);
        }
    }
}
