/**
 * 汎用レコード検索画面で使う Salesforce レコード問い合わせ
 */
public virtual with sharing class ObjectRecordSearchSelector {

    // カーソル境界を逆方向に進める降順値
    private static final String SORT_DESCENDING = 'desc';

    /**
     * 検証済み条件から動的 SOQL と bind 値を組み立ててレコード取得
     *
     * @param searchQueryRequest 検索対象、検索語、ソート、ページングを持つ問い合わせ条件
     * @return 検索結果 SObject
     * @throws IllegalArgumentException 内部で組み立てた問い合わせ条件が契約を満たさない場合
     */
    public virtual List<SObject> searchRecords(ObjectRecordSearchQueryPlan.SearchQueryRequest searchQueryRequest) {
        // 動的 SOQL に使うオブジェクトと項目を許可済み条件に限定
        ObjectRecordSearchQueryPlan.SearchQueryRequest validatedRequest = ObjectRecordSearchQueryPlan.requireValidSearchQueryRequest(
            searchQueryRequest
        );
        // 検索語とカーソル境界を SOQL 文字列から分離
        Map<String, Object> bindValues = createSearchBindValues(validatedRequest);
        // 許可済み識別子と bind 名だけで検索 SOQL を組み立て
        String soql = buildSearchSoql(validatedRequest, bindValues);
        // 画面利用者の権限で bind 付き動的 SOQL を評価
        List<SObject> records = Database.queryWithBinds(
            soql,
            bindValues,
            AccessLevel.USER_MODE
        );
        // 取得した未加工レコードを Controller へ返却
        return records;
    }

    /**
     * 対象オブジェクトから ID 指定で削除対象レコード取得
     *
     * @param objectApiName 対象オブジェクト API 参照名
     * @param recordIds 取得するレコード ID
     * @return 削除対象 SObject
     * @throws IllegalArgumentException 許可されていないオブジェクトが指定された場合
     */
    public virtual List<SObject> getRecordsById(String objectApiName, Set<Id> recordIds) {
        // FROM 句に使うオブジェクトを固定カタログに限定
        Boolean isSupportedObject = ObjectMetricCatalog.hasObjectApiName(objectApiName);
        // 許可リスト外の識別子は ID の有無に関わらず拒否
        if (!isSupportedObject) {
            throw new IllegalArgumentException('削除対象に許可されていないオブジェクトが指定されています。');
        }
        // 削除対象 ID がない場合は SOQL を実行せず空結果へ短絡
        Boolean hasRecordIds = recordIds != null && !recordIds.isEmpty();
        // 検索条件未指定を 0 件取得として扱う
        if (!hasRecordIds) {
            return new List<SObject>();
        }
        // ID 条件と取得上限を SOQL 文字列から分離
        Map<String, Object> bindValues = new Map<String, Object>();
        // 削除要求された ID を取得条件として設定
        bindValues.put('recordIds', recordIds);
        // ID 件数より広い行を取得しないよう上限を設定
        bindValues.put('recordLimit', recordIds.size());
        // 許可済みオブジェクトと bind 名で削除対象取得 SOQL を組み立て
        String soql = 'SELECT Id FROM ' + objectApiName + ' WHERE Id IN :recordIds LIMIT :recordLimit';
        // 画面利用者の権限で削除対象レコードだけを取得
        List<SObject> records = Database.queryWithBinds(
            soql,
            bindValues,
            AccessLevel.USER_MODE
        );
        // 取得した未加工レコードを Controller へ返却
        return records;
    }

    private Map<String, Object> createSearchBindValues(ObjectRecordSearchQueryPlan.SearchQueryRequest request) {
        // 検索条件に応じて値を追加できる空の bind Map を作成
        Map<String, Object> bindValues = new Map<String, Object>();
        // Service が正規化した任意フィルターと項目権限がそろっているかを判定
        Boolean shouldUseNameSearch = String.isNotBlank(
                request.normalizedSearchTerm
            ) &&
            request.context.config.searchable;
        // 検索語が有効な場合だけ部分一致用の bind 値を設定
        if (shouldUseNameSearch) {
            // 利用者の検索語を SOQL 文字列へ埋め込まない
            bindValues.put(
                'nameSearchTerm',
                '%' + request.normalizedSearchTerm + '%'
            );
        }
        // 次ページ条件がある場合だけ境界値を bind に設定
        if (request.cursor != null) {
            // 第 1 ソートキーの境界値を設定
            bindValues.put('cursorSortValue', request.cursor.sortValue);
            // 同値レコードの位置を確定する ID を設定
            bindValues.put('cursorRecordId', request.cursor.recordId);
        }
        // 固定取得件数を SOQL 文字列へ直接埋め込まず bind に設定
        bindValues.put('recordLimit', request.fetchSize);
        // SOQL 実行で参照する bind 値を返却
        return bindValues;
    }

    private String buildSearchSoql(ObjectRecordSearchQueryPlan.SearchQueryRequest request, Map<String, Object> bindValues) {
        // Name 相当項目と固定表示項目を SELECT 対象として取得
        List<String> queryFields = request.context.getQueryFieldApiNames();
        // 検証済み項目を SELECT 句のカンマ区切り文字列へ変換
        String selectedFields = String.join(queryFields, ', ');
        // 固定カタログで許可されたオブジェクトの基本 SOQL を作成
        String query = 'SELECT Id, ' + selectedFields + ' FROM ' + request.context.config.objectApiName;
        // 検索語とカーソルの複数条件を保持
        List<String> whereClauses = new List<String>();
        // 名称検索 bind がある場合だけ LIKE 条件を追加
        Boolean hasNameSearch = bindValues.containsKey('nameSearchTerm');
        // 利用者の検索語を Name 相当項目の部分一致条件に限定
        if (hasNameSearch) {
            whereClauses.add(request.context.config.nameFieldApiName + ' LIKE :nameSearchTerm');
        }
        // 次ページ取得時は前ページ末尾より後ろの条件を追加
        if (request.cursor != null) {
            // ソート方向と null 配置を考慮したカーソル条件を作成
            String cursorWhereClause = createCursorWhereClause(
                request.sortSpec,
                request.cursor
            );
            // 名称検索条件と同じ WHERE 句に含める
            whereClauses.add(cursorWhereClause);
        }
        // 条件がある場合だけ WHERE 句を付与
        Boolean hasWhereClauses = !whereClauses.isEmpty();
        // 複数条件を AND で結合して基本 SOQL へ追加
        if (hasWhereClauses) {
            // 各条件を単一の WHERE 句へまとめる
            String joinedWhereClauses = String.join(whereClauses, ' AND ');
            // 検索条件を基本 SOQL へ追加
            query += ' WHERE ' + joinedWhereClauses;
        }
        // 検証済みの asc、desc を SOQL の表記へ変換
        String sortDirection = request.sortSpec.direction.toUpperCase();
        // Id を第 2 ソートキーにしてページング境界を安定化
        String soql = query +
            ' ORDER BY ' +
            request.sortSpec.fieldApiName +
            ' ' +
            sortDirection +
            ' NULLS LAST, Id ASC LIMIT :recordLimit';
        // 利用者値を含まない動的 SOQL を実行処理へ返却
        return soql;
    }

    private String createCursorWhereClause(ObjectRecordSearchSortSupport.SortSpec sortSpec, ObjectRecordSearchSortSupport.PageCursor cursor) {
        // null 値グループでは Id だけを使って次の位置へ進める
        if (cursor.sortValue == null) {
            return '(' + sortSpec.fieldApiName + ' = NULL AND Id > :cursorRecordId)';
        }
        // 降順ではより小さい値、昇順ではより大きい値を次ページに含める
        String sortOperator = sortSpec.direction == SORT_DESCENDING ? '<' : '>';
        // 第 1 キーの後続値、同値の後続 ID、null 値グループを次ページ条件にする
        String whereClause = '(' +
            sortSpec.fieldApiName +
            ' ' +
            sortOperator +
            ' :cursorSortValue OR (' +
            sortSpec.fieldApiName +
            ' = :cursorSortValue AND Id > :cursorRecordId) OR ' +
            sortSpec.fieldApiName +
            ' = NULL)';
        // ページ境界の bind 名を含む WHERE 条件を返却
        return whereClause;
    }
}
