/**
 * 取引先 PDF の取引先問い合わせ
 */
public with sharing class AccountPdfSelector {
    /**
     * 指定された取引先を利用者権限で取得
     *
     * @param accountId 取引先 ID
     * @return PDF 出力項目を持つ取引先、不存在または null の場合は null
     */
    public Account getById(Id accountId) {
        if (accountId == null) {
            return null;
        }

        List<Account> accounts = [
            SELECT
                Id,
                Name,
                AccountNumber,
                Type,
                Industry,
                Phone,
                Website,
                BillingPostalCode,
                BillingState,
                BillingCity,
                BillingStreet,
                BillingCountry,
                ShippingPostalCode,
                ShippingState,
                ShippingCity,
                ShippingStreet,
                ShippingCountry,
                Description
            FROM Account
            WHERE Id = :accountId
            WITH USER_MODE
            LIMIT 1
        ];
        return accounts.isEmpty() ? null : accounts[0];
    }
}
