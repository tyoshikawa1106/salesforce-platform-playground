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
        // 作成前レコードは旧値なしで名称補正を判定
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
        // 更新前後の差分を使って変更された名称だけを補正
        normalizeNames(accounts, oldAccountsById);
    }

    private void normalizeNames(
        List<Account> accounts,
        Map<Id, Account> oldAccountsById
    ) {
        // 空リストではトリガー処理を即時終了
        Boolean hasAccounts = accounts != null && !accounts.isEmpty();
        if (!hasAccounts) {
            return;
        }

        for (Account accountRecord : accounts) {
            // レコード単位で補正対象かを判定
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
        // 更新時は旧値がある場合だけ名称差分を比較
        Boolean hasOldAccount = oldAccountsById != null &&
            accountRecord.Id != null &&
            oldAccountsById.containsKey(accountRecord.Id);
        if (
            !hasOldAccount
        ) {
            return true;
        }
        // 旧値が削除済み扱いの場合は補正対象として扱う
        Account oldAccount = oldAccountsById.get(accountRecord.Id);
        return oldAccount == null || accountRecord.Name != oldAccount.Name;
    }

    private String normalizeName(String accountName) {
        // 入力位置を保ったまま法人格略称だけを正式名称へ置換
        return accountName.replace(STOCK_COMPANY_SYMBOL, STOCK_COMPANY_FORMAL)
            .replace(STOCK_COMPANY_FULL_WIDTH, STOCK_COMPANY_FORMAL)
            .replace(STOCK_COMPANY_HALF_WIDTH, STOCK_COMPANY_FORMAL)
            .replace(LIMITED_COMPANY_SYMBOL, LIMITED_COMPANY_FORMAL)
            .replace(LIMITED_COMPANY_FULL_WIDTH, LIMITED_COMPANY_FORMAL)
            .replace(LIMITED_COMPANY_HALF_WIDTH, LIMITED_COMPANY_FORMAL);
    }
}
