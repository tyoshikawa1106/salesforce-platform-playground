/**
 * 取引先 PDF に表示する文字列
 */
public with sharing class AccountPdfViewModel {
    // PDF の空項目表示
    private static final String EMPTY_VALUE = '―';

    public String accountName { get; set; }
    public String accountNumber { get; set; }
    public String accountType { get; set; }
    public String industry { get; set; }
    public String phone { get; set; }
    public String website { get; set; }
    public String billingAddress { get; set; }
    public String shippingAddress { get; set; }
    public String description { get; set; }

    /**
     * 全項目を共通の空値表示で初期化
     */
    public AccountPdfViewModel() {
        this.accountName = EMPTY_VALUE;
        this.accountNumber = EMPTY_VALUE;
        this.accountType = EMPTY_VALUE;
        this.industry = EMPTY_VALUE;
        this.phone = EMPTY_VALUE;
        this.website = EMPTY_VALUE;
        this.billingAddress = EMPTY_VALUE;
        this.shippingAddress = EMPTY_VALUE;
        this.description = EMPTY_VALUE;
    }
}
