/**
 * Applies Account business rules.
 */
public with sharing class AccountDomain {
    /**
     * Normalizes company abbreviations in Account names.
     * @param accounts Account records to normalize
     * @param oldAccountsById Previous Account values keyed by Id for update contexts
     */
    public static void normalizeNames(
        List<Account> accounts,
        Map<Id, Account> oldAccountsById
    ) {
        AccountNameNormalizer.normalize(accounts, oldAccountsById);
    }
}
