/**
 * 汎用レコード検索のソート条件とページングカーソル取り扱い
 */
public with sharing class ObjectRecordSearchSortSupport {

    private static final String SORT_ASCENDING = 'asc';
    private static final String SORT_DESCENDING = 'desc';

    /**
     * リクエストから安全なソート条件を作成
     *
     * @param context 検索画面の内部処理状態
     * @param request 検索リクエスト
     * @return 許可済み項目と方向だけを持つソート条件
     * @throws IllegalArgumentException 内部の検索状態が不足している場合
     */
    public static SortSpec createSortSpec(ObjectRecordSearchContext context, ObjectRecordSearchRequestWrapper request) {
        if (context == null || context.config == null) {
            throw new IllegalArgumentException('ソート条件の作成には検索状態が必要です。');
        }
        // 許可済み項目だけをソート対象に採用
        String fieldApiName = getSortFieldApiName(context, request);
        Schema.DescribeFieldResult fieldDescribe = context.getAllowedFieldDescribe(
            fieldApiName
        );
        // ソート不可項目は Name 相当項目へフォールバック
        Boolean isFieldSortable = fieldDescribe.isSortable();
        if (!isFieldSortable) {
            fieldApiName = context.config.nameFieldApiName;
            fieldDescribe = context.getAllowedFieldDescribe(fieldApiName);
        }
        SortSpec sortSpec = new SortSpec();
        // ソート条件が属する検索対象オブジェクトを保持
        sortSpec.objectApiName = context.config.objectApiName;
        sortSpec.fieldApiName = fieldApiName;
        sortSpec.direction = getSortDirection(request);
        sortSpec.fieldDescribe = fieldDescribe;
        sortSpec.nameFieldApiName = context.config.nameFieldApiName;
        return sortSpec;
    }

    private static String getSortFieldApiName(ObjectRecordSearchContext context, ObjectRecordSearchRequestWrapper request) {
        // リクエスト指定が許可済みでない場合は Name 相当項目で並べる
        Set<String> allowedFieldApiNames = context.getAllowedFieldApiNames();
        Boolean hasAllowedSortField = allowedFieldApiNames.contains(
            request?.sortBy
        );
        return hasAllowedSortField ? request.sortBy : context.config.nameFieldApiName;
    }

    private static String getSortDirection(ObjectRecordSearchRequestWrapper request) {
        // desc 以外は既定の昇順として扱う
        String normalizedSortDirection = request?.sortDirection?.toLowerCase();
        return normalizedSortDirection == SORT_DESCENDING ? SORT_DESCENDING : SORT_ASCENDING;
    }

    /**
     * 正規化済みのソート条件
     */
    public class SortSpec {

        // ソート条件が属する検索対象オブジェクト
        public String objectApiName = '';
        public String fieldApiName = '';
        public String direction = '';
        public Schema.DescribeFieldResult fieldDescribe;
        public String nameFieldApiName = '';
    }

}
