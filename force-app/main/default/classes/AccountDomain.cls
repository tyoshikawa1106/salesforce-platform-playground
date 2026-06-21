/**
 * 取引先に関する業務ルールを適用します。
 */
public with sharing class AccountDomain {
    private static final String STOCK_COMPANY_SYMBOL = '㈱';
    private static final String STOCK_COMPANY_FULL_WIDTH = '（株）';
    private static final String STOCK_COMPANY_HALF_WIDTH = '(株)';
    private static final String STOCK_COMPANY_FORMAL = '株式会社';
    private static final String LIMITED_COMPANY_SYMBOL = '㈲';
    private static final String LIMITED_COMPANY_FULL_WIDTH = '（有）';
    private static final String LIMITED_COMPANY_HALF_WIDTH = '(有)';
    private static final String LIMITED_COMPANY_FORMAL = '有限会社';

    /**
     * 取引先名に含まれる会社種別の略称を正式名称へ補正します。
     * @param accounts 補正対象の取引先レコード
     * @param oldAccountsById 更新時に使う、Id をキーにした変更前の取引先レコード
     */
    public static void normalizeNames(
        List<Account> accounts,
        Map<Id, Account> oldAccountsById
    ) {
        if (accounts == null || accounts.isEmpty()) {
            return;
        }

        for (Account accountRecord : accounts) {
            if (!shouldNormalizeName(accountRecord, oldAccountsById)) {
                continue;
            }

            accountRecord.Name = normalizeName(accountRecord.Name);
        }
    }

    private static Boolean shouldNormalizeName(
        Account accountRecord,
        Map<Id, Account> oldAccountsById
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

        Account oldAccount = oldAccountsById.get(accountRecord.Id);
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
