/** 法人取引先のページ取得と保存対象のロック */
public with sharing class AccountMassUpdateSelector {

    /**
     * 検証済み条件から次ページ判定用の一行を含めて取得
     * @param wrapper 正規化済みの検索条件
     * @return 作成日時とIDの降順の最大201行
     */
    public List<Account> searchAccounts(AccountMassUpdateWrapper wrapper) {
        // 任意フィルターが未指定でも法人のみを問い合わせ
        String query = 'SELECT Id, Name, OwnerId, Industry, Type, Rating';
        // 検証済みの組織機能に対応する固定項目だけを追加
        if (wrapper.recordTypesEnabled) {
            query += ', RecordTypeId';
        }
        // 標準の監査日時をページ境界と競合検出に使用
        query += ', CreatedDate, LastModifiedDate FROM Account WHERE Id != null';
        // 利用者の入力をクエリ文字列から分離
        Map<String, Object> binds = new Map<String, Object>();
        // 個人取引先機能のない組織にも対応
        if (wrapper.personAccountsEnabled) {
            query += ' AND IsPersonAccount = false';
        }
        // ワイルドカード文字を通常文字として検索
        if (String.isNotBlank(wrapper.searchTerm)) {
            binds.put(
                'term',
                '%' + wrapper.searchTerm.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'
            );
            query += ' AND Name LIKE :term';
        }
        // 開始日の現地時刻午前零時を含める
        if (wrapper.startAt != null) {
            binds.put('startAt', wrapper.startAt);
            query += ' AND CreatedDate >= :startAt';
        }
        // 終了日の翌日午前零時を含めない
        if (wrapper.endBefore != null) {
            binds.put('endBefore', wrapper.endBefore);
            query += ' AND CreatedDate < :endBefore';
        }
        // 同一作成日時の行もIDで安定して分割
        if (wrapper.afterId != null) {
            binds.put('afterCreated', wrapper.afterCreated);
            binds.put('afterId', wrapper.afterId);
            query += ' AND (CreatedDate < :afterCreated OR (CreatedDate = :afterCreated AND Id < :afterId))';
        }
        // OFFSET上限に依存せず表示分だけ取得
        query += ' ORDER BY CreatedDate DESC, Id DESC LIMIT 201';
        // 検索対象項目と共有の権限を適用
        List<Account> records = Database.queryWithBinds(query, binds, AccessLevel.USER_MODE);
        // 権限を適用した取得結果を返却
        return records;
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
        // 同時編集確認とDMLの間の変更をロックで防止
        String query = 'SELECT Id, OwnerId, Industry, Type, Rating, LastModifiedDate FROM Account WHERE Id IN :recordIds';
        // 改ざんされた個人取引先IDを対象から除外
        if (wrapper.personAccountsEnabled) {
            query += ' AND IsPersonAccount = false';
        }
        // DMLまで同じトランザクションでロックを保持
        query += ' FOR UPDATE';
        // 利用者が参照できる対象だけを返却
        List<Account> records = Database.queryWithBinds(
            query,
            new Map<String, Object>{ 'recordIds' => recordIds },
            AccessLevel.USER_MODE
        );
        // 権限を適用した取得結果を返却
        return records;
    }
}
