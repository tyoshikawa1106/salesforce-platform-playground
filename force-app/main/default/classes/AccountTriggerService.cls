/**
 * 取引先トリガーから呼び出されるユースケース調整
 */
public with sharing class AccountTriggerService {
    private static final String STOCK_COMPANY_SYMBOL = '㈱';
    private static final String STOCK_COMPANY_FULL_WIDTH = '（株）';
    private static final String STOCK_COMPANY_HALF_WIDTH = '(株)';
    private static final String STOCK_COMPANY_FORMAL = '株式会社';
    private static final String LIMITED_COMPANY_SYMBOL = '㈲';
    private static final String LIMITED_COMPANY_FULL_WIDTH = '（有）';
    private static final String LIMITED_COMPANY_HALF_WIDTH = '(有)';
    private static final String LIMITED_COMPANY_FORMAL = '有限会社';

    /**
     * 取引先作成前の補正処理を適用
     *
     * @param accounts Trigger.new から渡された取引先レコード
     */
    public void normalizeAccountNamesForInsert(List<Account> accounts) {
        normalizeNames(accounts, null);
    }

    /**
     * 取引先更新前の補正処理を適用
     *
     * @param accounts Trigger.new から渡された取引先レコード
     * @param oldAccountsById Id をキーにした変更前の取引先レコード
     */
    public void normalizeChangedAccountNamesForUpdate(
        List<Account> accounts,
        Map<Id, Account> oldAccountsById
    ) {
        normalizeNames(accounts, oldAccountsById);
    }

    private void normalizeNames(
        List<Account> accounts,
        Map<Id, Account> oldAccountsById
    ) {
        Boolean hasAccounts = accounts != null && !accounts.isEmpty();
        if (!hasAccounts) {
            return;
        }

        for (Account accountRecord : accounts) {
            Boolean shouldNormalize = shouldNormalizeName(
                accountRecord,
                oldAccountsById
            );
            if (!shouldNormalize) {
                continue;
            }

            accountRecord.Name = normalizeName(accountRecord.Name);
        }
    }

    private Boolean shouldNormalizeName(
        Account accountRecord,
        Map<Id, Account> oldAccountsById
    ) {
        Boolean hasAccountName = accountRecord != null &&
            String.isNotBlank(accountRecord.Name);
        if (!hasAccountName) {
            return false;
        }

        Boolean hasOldAccount = oldAccountsById != null &&
            accountRecord.Id != null &&
            oldAccountsById.containsKey(accountRecord.Id);
        if (
            !hasOldAccount
        ) {
            return true;
        }

        Account oldAccount = oldAccountsById.get(accountRecord.Id);
        return oldAccount == null || accountRecord.Name != oldAccount.Name;
    }

    private String normalizeName(String accountName) {
        return accountName.replace(STOCK_COMPANY_SYMBOL, STOCK_COMPANY_FORMAL)
            .replace(STOCK_COMPANY_FULL_WIDTH, STOCK_COMPANY_FORMAL)
            .replace(STOCK_COMPANY_HALF_WIDTH, STOCK_COMPANY_FORMAL)
            .replace(LIMITED_COMPANY_SYMBOL, LIMITED_COMPANY_FORMAL)
            .replace(LIMITED_COMPANY_FULL_WIDTH, LIMITED_COMPANY_FORMAL)
            .replace(LIMITED_COMPANY_HALF_WIDTH, LIMITED_COMPANY_FORMAL);
    }
}
