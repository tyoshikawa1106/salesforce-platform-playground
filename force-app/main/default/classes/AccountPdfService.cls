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
     * @return 検証済み取引先 ID
     * @throws AccountPdfServiceException パラメーターが未指定、不正、または取引先以外の場合
     */
    public Id validateAccountId(String accountIdParameter) {
        if (String.isBlank(accountIdParameter)) {
            throw new AccountPdfServiceException(INVALID_ACCOUNT_MESSAGE);
        }

        try {
            Id accountId = Id.valueOf(accountIdParameter.trim());
            if (accountId.getSObjectType() != Account.SObjectType) {
                throw new AccountPdfServiceException(INVALID_ACCOUNT_MESSAGE);
            }
            return accountId;
        } catch (StringException e) {
            throw new AccountPdfServiceException(INVALID_ACCOUNT_MESSAGE, e);
        }
    }

    /**
     * 取引先から PDF 表示モデルを作成
     *
     * @param accountRecord 利用者権限で取得した取引先
     * @return 空値表現と住所改行を統一した表示モデル
     * @throws AccountPdfServiceException 取引先を取得できなかった場合
     */
    public AccountPdfViewModel createViewModel(Account accountRecord) {
        if (accountRecord == null) {
            throw new AccountPdfServiceException(UNAVAILABLE_ACCOUNT_MESSAGE);
        }

        AccountPdfViewModel viewModel = new AccountPdfViewModel();
        viewModel.accountName = normalizeValue(accountRecord.Name);
        viewModel.accountNumber = normalizeValue(accountRecord.AccountNumber);
        viewModel.accountType = normalizeValue(accountRecord.Type);
        viewModel.industry = normalizeValue(accountRecord.Industry);
        viewModel.phone = normalizeValue(accountRecord.Phone);
        viewModel.website = normalizeValue(accountRecord.Website);
        viewModel.billingAddress = formatAddress(
            new List<String>{
                accountRecord.BillingPostalCode,
                joinAddressParts(accountRecord.BillingState, accountRecord.BillingCity),
                accountRecord.BillingStreet,
                accountRecord.BillingCountry
            }
        );
        viewModel.shippingAddress = formatAddress(
            new List<String>{
                accountRecord.ShippingPostalCode,
                joinAddressParts(accountRecord.ShippingState, accountRecord.ShippingCity),
                accountRecord.ShippingStreet,
                accountRecord.ShippingCountry
            }
        );
        viewModel.description = normalizeValue(accountRecord.Description);
        return viewModel;
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
     * 取引先 PDF の入力または表示対象に関する例外
     */
    public class AccountPdfServiceException extends Exception {
    }
}
