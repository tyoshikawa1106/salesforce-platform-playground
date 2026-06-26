/**
 * 汎用レコード検索画面の設定取得、検索、削除を提供します。
 */
public with sharing class ObjectRecordSearchService {
    private final ObjectRecordSearchSelector selector;

    /**
     * 既定の Selector を使ってサービスを作成します。
     */
    public ObjectRecordSearchService() {
        this(new ObjectRecordSearchSelector());
    }

    /**
     * 指定された Selector を使ってサービスを作成します。
     * @param selector レコード検索 Selector
     */
    public ObjectRecordSearchService(ObjectRecordSearchSelector selector) {
        this.selector = selector == null
            ? new ObjectRecordSearchSelector()
            : selector;
    }

    /**
     * 表示キーに対応する検索画面設定を返します。
     * @param metricKey データボードカードの表示キー
     * @return 検索画面設定
     */
    public ObjectRecordSearchController.ObjectRecordSearchConfig getObjectConfig(
        String metricKey
    ) {
        return selector.getObjectConfig(metricKey);
    }

    /**
     * 表示キーに対応するオブジェクトのレコードを検索します。
     * @param request 検索条件とページ指定
     * @return 1 ページ最大 500 件の検索結果
     */
    public ObjectRecordSearchController.ObjectRecordSearchResult searchRecords(
        ObjectRecordSearchController.ObjectRecordSearchRequest request
    ) {
        return selector.searchRecords(request);
    }

    /**
     * 表示キーに対応するオブジェクトの選択レコードを削除します。
     * @param metricKey データボードカードの表示キー
     * @param recordIds 削除するレコード ID
     * @return 削除結果
     */
    public ObjectRecordSearchController.ObjectRecordDeleteResult deleteRecords(
        String metricKey,
        List<Id> recordIds
    ) {
        return selector.deleteRecords(metricKey, recordIds);
    }
}
