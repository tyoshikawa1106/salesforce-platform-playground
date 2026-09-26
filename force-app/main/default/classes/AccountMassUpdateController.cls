/** 法人取引先の検索と最大200件の一括更新の入口 */
public with sharing class AccountMassUpdateController {

    private static AccountMassUpdateService service = new AccountMassUpdateService();
    private static AccountMassUpdateSelector selector = new AccountMassUpdateSelector();

    /**
     * 利用者権限で法人取引先を検索
     * @param request 名前・作成日・ページ境界を持つ検索条件
     * @return 最大200件の検索結果
     */
    @AuraEnabled
    public static AccountMassUpdateWrapper searchAccounts(AccountMassUpdateWrapper request) {
        // 検索例外から内部情報が画面へ漏れないよう変換
        try {
            // データ取得前に条件と権限を検証
            AccountMassUpdateWrapper wrapper = service.prepareSearch(request);
            // 拒否時はクエリを実行しない
            if (String.isNotEmpty(wrapper.errorMessage)) {
                // 判定結果を呼び出し元へ返却
                return wrapper;
            }
            // 現在ページに必要な件数のみ問い合わせ
            List<Account> records = selector.searchAccounts(wrapper);
            // 表示件数と後続ページの有無を組み立て
            wrapper = service.createPage(records, wrapper.editableFields);
            // 判定結果を呼び出し元へ返却
            return wrapper;
        } catch (Exception e) {
            // 安全な共通エラーへ変換
            throw new AuraHandledException('検索できませんでした。日付と参照権限を確認してください。');
        }
    }

    /**
     * 変更された項目だけを利用者権限で部分成功保存
     * @param changes 最大200件の変更値
     * @param versions 読取時点の最終更新日時
     * @return 保存済みIDと行単位エラー、保存後は再検索が必要
     */
    @AuraEnabled
    public static AccountMassUpdateWrapper saveAccounts(List<Account> changes, Map<Id, Datetime> versions) {
        // 想定外のエラー後も部分的な更新を残さない
        Savepoint savepoint = Database.setSavepoint();
        // 読取から更新まで同じトランザクションで実行
        try {
            // 件数と更新可能な項目を検証
            AccountMassUpdateWrapper wrapper = service.prepareSave(changes, versions);
            // 不正な要求は検索前に終了
            if (String.isNotEmpty(wrapper.errorMessage)) {
                // 判定結果を呼び出し元へ返却
                return wrapper;
            }
            // ロックした現在値を取得
            List<Account> currentRecords = selector.lockAccounts(wrapper.recordIds, wrapper);
            // 同時編集を除外して差分だけを生成
            wrapper = service.buildUpdates(changes, versions, currentRecords);
            // 項目権限と所有者移転権限をプラットフォームで強制
            List<Database.SaveResult> results = Database.update(wrapper.records, false, AccessLevel.USER_MODE);
            // 行ごとの保存結果を一括で返却
            wrapper = service.createSaveResult(wrapper, results);
            // 判定結果を呼び出し元へ返却
            return wrapper;
        } catch (Exception e) {
            // 更新結果を返せない場合に保存済みと未保存を曖昧にしない
            Database.rollback(savepoint);
            // 内部例外を安全な案内へ変換
            throw new AuraHandledException('保存できませんでした。時間をおいて再実行してください。');
        }
    }
}
