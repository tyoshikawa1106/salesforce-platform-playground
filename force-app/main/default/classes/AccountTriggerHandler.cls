/**
 * Handles Account trigger events.
 */
public with sharing class AccountTriggerHandler {
    private static final String STOCK_COMPANY_SYMBOL = '㈱';
    private static final String STOCK_COMPANY_FULL_WIDTH = '（株）';
    private static final String STOCK_COMPANY_HALF_WIDTH = '(株)';
    private static final String STOCK_COMPANY_FORMAL = '株式会社';
    private static final String LIMITED_COMPANY_SYMBOL = '㈲';
    private static final String LIMITED_COMPANY_FULL_WIDTH = '（有）';
    private static final String LIMITED_COMPANY_HALF_WIDTH = '(有)';
    private static final String LIMITED_COMPANY_FORMAL = '有限会社';

    /**
     * Routes Account trigger contexts to the matching handler behavior.
     */
    public static void run() {
        if (!Trigger.isBefore) {
            return;
        }

        if (Trigger.isInsert) {
            normalizeCompanyAbbreviations(Trigger.new, null);
        } else if (Trigger.isUpdate) {
            normalizeCompanyAbbreviations(Trigger.new, Trigger.oldMap);
        }
    }

    private static void normalizeCompanyAbbreviations(
        List<SObject> accounts,
        Map<Id, SObject> oldAccountsById
    ) {
        if (accounts == null || accounts.isEmpty()) {
            return;
        }

        for (SObject accountSObject : accounts) {
            Account accountRecord = (Account) accountSObject;
            if (!shouldNormalize(accountRecord, oldAccountsById)) {
                continue;
            }

            accountRecord.Name = normalizeName(accountRecord.Name);
        }
    }

    private static Boolean shouldNormalize(
        Account accountRecord,
        Map<Id, SObject> oldAccountsById
    ) {
        if (accountRecord == null || String.isBlank(accountRecord.Name)) {
            return false;
        }

        if (
            oldAccountsById == null ||
            accountRecord.Id == null ||
            !oldAccountsById.containsKey(accountRecord.Id)
        ) {
            return true;
        }

        Account oldAccount = (Account) oldAccountsById.get(accountRecord.Id);
        return oldAccount == null || accountRecord.Name != oldAccount.Name;
    }

    private static String normalizeName(String accountName) {
        return accountName.replace(STOCK_COMPANY_SYMBOL, STOCK_COMPANY_FORMAL)
            .replace(STOCK_COMPANY_FULL_WIDTH, STOCK_COMPANY_FORMAL)
            .replace(STOCK_COMPANY_HALF_WIDTH, STOCK_COMPANY_FORMAL)
            .replace(LIMITED_COMPANY_SYMBOL, LIMITED_COMPANY_FORMAL)
            .replace(LIMITED_COMPANY_FULL_WIDTH, LIMITED_COMPANY_FORMAL)
            .replace(LIMITED_COMPANY_HALF_WIDTH, LIMITED_COMPANY_FORMAL);
    }
}
