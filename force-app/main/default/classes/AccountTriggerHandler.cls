/**
 * 取引先トリガーハンドラークラス
 */
public with sharing class AccountTriggerHandler {

    private AccountTriggerService service = new AccountTriggerService();

    /**
     * 新規取引先名の法人格略称を正式名称に補正
     *
     * @param accounts 新規取引先
     */
    public void normalizeAccountNamesForInsert(List<Account> accounts) {
        // 新規取引先名の法人格略称を正式名称へ補正
        this.service.normalizeAccountNamesForInsert(accounts);
    }

    /**
     * 変更された取引先名の法人格略称を正式名称に補正
     *
     * @param accounts 更新後の取引先
     * @param oldAccountMap 更新前の取引先
     */
    public void normalizeChangedAccountNamesForUpdate(List<Account> accounts, Map<Id, Account> oldAccountMap) {
        // 変更された取引先名の法人格略称だけを正式名称へ補正
        this.service.normalizeChangedAccountNamesForUpdate(accounts, oldAccountMap);
    }
}
