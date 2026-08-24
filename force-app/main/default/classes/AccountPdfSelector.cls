/**
 * 取引先 PDF の取引先問い合わせ
 */
public with sharing class AccountPdfSelector {
    /**
     * 指定された取引先を利用者権限で取得
     *
     * @param accountId 取引先 ID
     * @return PDF 出力項目を持つ取引先一覧、不存在または null の場合は空の List
     */
    public List<Account> getById(Id accountId) {
        // 取引先 ID 未指定時は SOQL を実行せず空結果へ短絡
        if (accountId == null) {
            return new List<Account>();
        }

        // 利用者が参照できる PDF 出力対象項目だけを取得
        return [
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
    }
}