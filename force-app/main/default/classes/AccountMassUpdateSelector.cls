/** 法人取引先のページ取得と保存対象のロック */
public with sharing class AccountMassUpdateSelector {

    /**
     * 検証済み条件から次ページ判定用の一行を含めて取得
     * @param wrapper 正規化済みの検索条件
     * @return 作成日時とIDの降順の最大201行
     */
    public List<Account> searchAccounts(AccountMassUpdateWrapper wrapper) {
        // 組織機能に応じた固定条件とバインド値を新しい計画にまとめる
        SearchQuery plan = createSearchQuery(wrapper);
        // 検索対象項目と共有の権限を適用
        List<Account> records = Database.queryWithBinds(plan.query, plan.binds, AccessLevel.USER_MODE);
        // 権限を適用した取得結果を返却
        return records;
    }

    /** 組織機能の判定値から検索条件を生成し、機能未有効の組織でも条件を検証
     * @param wrapper 検証済みの検索条件
     * @return 検索クエリと入力値のバインド
     */
    @TestVisible
    private SearchQuery createSearchQuery(AccountMassUpdateWrapper wrapper) {
        // 引数を変更せずクエリとバインドを返却
        SearchQuery plan = new SearchQuery();
        // 任意フィルターが未指定でも法人のみを問い合わせ
        String query = 'SELECT Id, Name, OwnerId, Industry, Type, Rating';
        // 検証済みの組織機能に対応する固定項目だけを追加
        if (wrapper.recordTypesEnabled) {
            query += ', RecordTypeId';
        }
        // 標準の監査日時をページ境界と競合検出に使用
        query += ', CreatedDate, LastModifiedDate FROM Account WHERE Id != null';
        // 個人取引先機能のない組織にも対応
        if (wrapper.personAccountsEnabled) {
            query += ' AND IsPersonAccount = false';
        }
        // ワイルドカード文字を通常文字として検索
        if (String.isNotBlank(wrapper.searchTerm)) {
            plan.binds.put(
                'term',
                '%' + wrapper.searchTerm.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'
            );
            query += ' AND Name LIKE :term';
        }
        // 開始日の現地時刻午前零時を含める
        if (wrapper.startAt != null) {
            plan.binds.put('startAt', wrapper.startAt);
            query += ' AND CreatedDate >= :startAt';
        }
        // 終了日の翌日午前零時を含めない
        if (wrapper.endBefore != null) {
            plan.binds.put('endBefore', wrapper.endBefore);
            query += ' AND CreatedDate < :endBefore';
        }
        // 同一作成日時の行もIDで安定して分割
        if (wrapper.afterId != null) {
            plan.binds.put('afterCreated', wrapper.afterCreated);
            plan.binds.put('afterId', wrapper.afterId);
            query += ' AND (CreatedDate < :afterCreated OR (CreatedDate = :afterCreated AND Id < :afterId))';
        }
        // OFFSET上限に依存せず表示分だけ取得
        query += ' ORDER BY CreatedDate DESC, Id DESC LIMIT 201';
        // 入力値を埋め込まないクエリを呼び出し元へ返す
        plan.query = query;
        // 実行に必要な計画全体を返す
        return plan;
    }

    /**
     * 更新対象を利用者権限でロックして取得
     * @param recordIds 検証済みの最大200件の取引先ID、空なら問い合わせない
     * @param wrapper 検証済みの対象範囲
     * @return 現在の値を持つ更新対象
     */
    public List<Account> lockAccounts(Set<Id> recordIds, AccountMassUpdateWrapper wrapper) {
        // 必須IDがない場合に全件を検索しない
        if (recordIds == null || recordIds.isEmpty()) {
            // 対象未指定を空結果として返却
            return new List<Account>();
        }
        // 検証済みの組織機能からロック条件を組み立て
        String query = createLockQuery(wrapper);
        // 利用者が参照できる対象だけを返却
        List<Account> records = Database.queryWithBinds(
            query,
            new Map<String, Object>{ 'recordIds' => recordIds },
            AccessLevel.USER_MODE
        );
        // 権限を適用した取得結果を返却
        return records;
    }
    /** 組織機能の判定値からロック条件を生成し、個人取引先除外を検証
     * @param wrapper 検証済みの対象範囲
     * @return 更新対象をロックするクエリ
     */
    @TestVisible
    private String createLockQuery(AccountMassUpdateWrapper wrapper) {
        // 同時編集確認とDMLの間の変更をロックで防止
        String query = 'SELECT Id, OwnerId, Industry, Type, Rating, LastModifiedDate FROM Account WHERE Id IN :recordIds';
        // 改ざんされた個人取引先IDを対象から除外
        if (wrapper.personAccountsEnabled) {
            query += ' AND IsPersonAccount = false';
        }
        // DMLまで同じトランザクションでロックを保持
        query += ' FOR UPDATE';
        // 利用者権限を適用する実行処理へクエリを返す
        return query;
    }

    /** 入力値をSOQL本文と分離した検索計画 */
    public class SearchQuery {
        public String query = '';
        public Map<String, Object> binds = new Map<String, Object>();
    }

}
