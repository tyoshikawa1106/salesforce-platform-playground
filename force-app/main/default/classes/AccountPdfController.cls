/**
 * 取引先 PDF を表示する Visualforce 入口
 */
public with sharing class AccountPdfController {
    // 予期しない取得失敗時に PDF へ表示する案内
    private static final String LOAD_ERROR_MESSAGE =
        '取引先情報を表示できませんでした。時間をおいてもう一度お試しください。';

    private AccountPdfService service = new AccountPdfService();
    private AccountPdfSelector selector = new AccountPdfSelector();

    public AccountPdfViewModel accountData { get; private set; }
    public Boolean hasError { get; private set; }
    public String errorMessage { get; private set; }

    /**
     * URL の取引先 ID を検証して PDF 表示データを準備
     */
    public AccountPdfController() {
        this.accountData = new AccountPdfViewModel();
        this.hasError = false;
        this.errorMessage = '';

        try {
            String accountIdParameter = ApexPages.currentPage().getParameters().get('accountId');
            String sanitizedAccountIdParameter = accountIdParameter?.escapeHtml4();
            Id accountId = this.service.validateAccountId(sanitizedAccountIdParameter);
            // 利用者権限で PDF 出力対象の取引先一覧を取得
            List<Account> accounts = this.selector.getById(accountId);
            // 単一取引先の取得確認と表示値作成を Service へ委譲
            this.accountData = this.service.createViewModel(accounts);
        } catch (AccountPdfService.AccountPdfServiceException e) {
            setError(e.getMessage());
        } catch (Exception e) {
            setError(LOAD_ERROR_MESSAGE);
        }
    }

    private void setError(String message) {
        this.hasError = true;
        this.errorMessage = message;
    }
}
