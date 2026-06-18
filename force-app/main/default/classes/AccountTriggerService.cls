/**
 * Coordinates Account trigger use cases.
 */
public with sharing class AccountTriggerService {
    /**
     * Applies Account before insert behavior.
     * @param accounts Account records from Trigger.new
     */
    public static void beforeInsert(List<Account> accounts) {
        AccountDomain.normalizeNames(accounts, null);
    }

    /**
     * Applies Account before update behavior.
     * @param accounts Account records from Trigger.new
     * @param oldAccountsById Previous Account values keyed by Id
     */
    public static void beforeUpdate(
        List<Account> accounts,
        Map<Id, Account> oldAccountsById
    ) {
        AccountDomain.normalizeNames(accounts, oldAccountsById);
    }
}
