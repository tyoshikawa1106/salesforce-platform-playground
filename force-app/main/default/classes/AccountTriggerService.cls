/**
 * 取引先トリガーから呼び出されるユースケースを調整します。
 */
public with sharing class AccountTriggerService {
    /**
     * 取引先作成前の補正処理を適用します。
     * @param accounts Trigger.new から渡された取引先レコード
     */
    public static void beforeInsert(List<Account> accounts) {
        AccountDomain.normalizeNames(accounts, null);
    }

    /**
     * 取引先更新前の補正処理を適用します。
     * @param accounts Trigger.new から渡された取引先レコード
     * @param oldAccountsById Id をキーにした変更前の取引先レコード
     */
    public static void beforeUpdate(
        List<Account> accounts,
        Map<Id, Account> oldAccountsById
    ) {
        AccountDomain.normalizeNames(accounts, oldAccountsById);
    }
}
