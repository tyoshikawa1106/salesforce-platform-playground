/**
 * データボードから遷移する汎用レコード検索画面の Apex 入口です。
 */
public with sharing class ObjectRecordSearchController {
    private static final String USER_FACING_ERROR_MESSAGE = 'レコード一覧を読み込めませんでした。';

    /**
     * 表示キーに対応する検索画面設定を返します。
     * @param metricKey データボードカードの表示キー
     * @return 検索画面設定
     */
    @AuraEnabled(cacheable=true)
    public static ObjectRecordSearchDtos.ObjectRecordSearchConfig getObjectConfig(
        String metricKey
    ) {
        try {
            return new ObjectRecordSearchService().getObjectConfig(metricKey);
        } catch (Exception error) {
            throw new AuraHandledException(USER_FACING_ERROR_MESSAGE);
        }
    }

    /**
     * 表示キーに対応するオブジェクトのレコードを検索します。
     * @param request 検索条件とページ指定
     * @return 1 ページ最大 50 件の検索結果
     */
    @AuraEnabled(cacheable=true)
    public static ObjectRecordSearchDtos.ObjectRecordSearchResult searchRecords(
        ObjectRecordSearchDtos.ObjectRecordSearchRequest request
    ) {
        try {
            return new ObjectRecordSearchService().searchRecords(request);
        } catch (Exception error) {
            throw new AuraHandledException(USER_FACING_ERROR_MESSAGE);
        }
    }

    /**
     * 表示キーに対応するオブジェクトの選択レコードを削除します。
     * @param metricKey データボードカードの表示キー
     * @param recordIds 削除するレコード ID
     * @return 削除結果
     */
    @AuraEnabled
    public static ObjectRecordSearchDtos.ObjectRecordDeleteResult deleteRecords(
        String metricKey,
        List<Id> recordIds
    ) {
        try {
            return new ObjectRecordSearchService()
                .deleteRecords(metricKey, recordIds);
        } catch (Exception error) {
            throw new AuraHandledException(
                '選択したレコードを削除できませんでした。'
            );
        }
    }

}
