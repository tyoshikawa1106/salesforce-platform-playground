/**
 * 取引先 PDF の入力検証と表示値作成
 */
public with sharing class AccountPdfService {
    // 不正な URL パラメーターを安全に案内
    private static final String INVALID_ACCOUNT_MESSAGE =
        '取引先を確認できませんでした。取引先レコードからもう一度お試しください。';
    // 権限外と不存在を区別せず安全に案内
    private static final String UNAVAILABLE_ACCOUNT_MESSAGE =
        '取引先情報を表示できませんでした。参照権限を確認してください。';
    // PDF の空項目表示
    private static final String EMPTY_VALUE = '―';

    /**
     * URL パラメーターが取引先 ID かを検証
     *
     * @param accountIdParameter URL から受け取った取引先 ID
     * @return 取引先 ID の検証結果
     */
    public AccountIdValidationResult validateAccountId(String accountIdParameter) {
        if (String.isBlank(accountIdParameter)) {
            return new AccountIdValidationResult(false, null, INVALID_ACCOUNT_MESSAGE);
        }

        try {
            Id accountId = Id.valueOf(accountIdParameter.trim());
            if (accountId.getSObjectType() != Account.SObjectType) {
                return new AccountIdValidationResult(false, null, INVALID_ACCOUNT_MESSAGE);
            }
            return new AccountIdValidationResult(true, accountId, '');
        } catch (StringException e) {
            return new AccountIdValidationResult(false, null, INVALID_ACCOUNT_MESSAGE);
        }
    }

    /**
     * 取引先から PDF 表示モデルを作成
     *
     * @param accounts 利用者権限で取得した取引先一覧
     * @return 空値表現と住所改行を統一した表示モデルの作成結果
     */
    public ViewModelResult createViewModel(List<Account> accounts) {
        // 取得結果が空の場合は不存在と権限外を区別せず拒否
        if (accounts == null || accounts.isEmpty()) {
            return new ViewModelResult(false, null, UNAVAILABLE_ACCOUNT_MESSAGE);
        }

        // 単一レコード用 SOQL の先頭結果を表示対象として確定
        Account accountRecord = accounts[0];
        // PDF へ返す表示値を非 null の ViewModel へ集約
        AccountPdfViewModel viewModel = new AccountPdfViewModel();
        // 取引先名の空値を PDF 共通表現へ統一
        viewModel.accountName = normalizeValue(accountRecord.Name);
        // 取引先番号の空値を PDF 共通表現へ統一
        viewModel.accountNumber = normalizeValue(accountRecord.AccountNumber);
        // 種別の空値を PDF 共通表現へ統一
        viewModel.accountType = normalizeValue(accountRecord.Type);
        // 業種の空値を PDF 共通表現へ統一
        viewModel.industry = normalizeValue(accountRecord.Industry);
        // 電話の空値を PDF 共通表現へ統一
        viewModel.phone = normalizeValue(accountRecord.Phone);
        // Web サイトの空値を PDF 共通表現へ統一
        viewModel.website = normalizeValue(accountRecord.Website);
        // 請求先住所を改行済みの表示値へ変換
        viewModel.billingAddress = formatAddress(
            new List<String>{
                accountRecord.BillingPostalCode,
                joinAddressParts(accountRecord.BillingState, accountRecord.BillingCity),
                accountRecord.BillingStreet,
                accountRecord.BillingCountry
            }
        );
        // 納入先住所を改行済みの表示値へ変換
        viewModel.shippingAddress = formatAddress(
            new List<String>{
                accountRecord.ShippingPostalCode,
                joinAddressParts(accountRecord.ShippingState, accountRecord.ShippingCity),
                accountRecord.ShippingStreet,
                accountRecord.ShippingCountry
            }
        );
        // 説明の空値を PDF 共通表現へ統一
        viewModel.description = normalizeValue(accountRecord.Description);
        // 完成した PDF 表示モデルを呼び出し元へ返却
        return new ViewModelResult(true, viewModel, '');
    }

    private String formatAddress(List<String> addressParts) {
        List<String> addressLines = new List<String>();
        for (String addressPart : addressParts) {
            addAddressLine(addressLines, addressPart);
        }
        return addressLines.isEmpty() ? EMPTY_VALUE : String.join(addressLines, '\n');
    }

    private String joinAddressParts(String firstPart, String secondPart) {
        String normalizedFirstPart = String.isBlank(firstPart) ? '' : firstPart.trim();
        String normalizedSecondPart = String.isBlank(secondPart) ? '' : secondPart.trim();
        return normalizedFirstPart + normalizedSecondPart;
    }

    private void addAddressLine(List<String> addressLines, String value) {
        if (!String.isBlank(value)) {
            addressLines.add(value.trim());
        }
    }

    private String normalizeValue(String value) {
        return String.isBlank(value) ? EMPTY_VALUE : value;
    }

    /**
     * 取引先 ID の検証結果
     */
    public class AccountIdValidationResult {
        public Boolean isValid;
        public Id accountId;
        public String errorMessage;

        private AccountIdValidationResult(Boolean isValid, Id accountId, String errorMessage) {
            this.isValid = isValid == true;
            this.accountId = accountId;
            this.errorMessage = errorMessage ?? '';
        }
    }

    /**
     * PDF 表示モデルの作成結果
     */
    public class ViewModelResult {
        public Boolean isValid;
        public AccountPdfViewModel viewModel;
        public String errorMessage;

        private ViewModelResult(Boolean isValid, AccountPdfViewModel viewModel, String errorMessage) {
            this.isValid = isValid == true;
            this.viewModel = viewModel;
            this.errorMessage = errorMessage ?? '';
        }
    }
}