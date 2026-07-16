/**
 * ケースに紐づくメールメッセージ一覧の Apex 入口
 */
public with sharing class CaseEmailMessageController {

    // 予期しない取得失敗時に LWC へ返す案内
    private static final String LOAD_ERROR_MESSAGE = 'メールメッセージを読み込めませんでした。時間をおいてもう一度お試しください。';

    // 静的 Apex 入口から入力検証を委譲
    private static final CaseEmailMessageService SERVICE = new CaseEmailMessageService();
    // 静的 Apex 入口からデータ取得を委譲
    private static final CaseEmailMessageSelector SELECTOR = new CaseEmailMessageSelector();

    /**
     * 指定ケースに紐づく最新のメールメッセージを返す
     *
     * @param caseId ケースレコード ID、null の場合は空のリスト
     * @return 送信日時の降順で最大 50 件のメールメッセージ
     */
    @AuraEnabled(cacheable=true)
    public static List<EmailMessage> getEmailMessages(Id caseId) {
        try {
            // 画面からの ID を検証し、問い合わせ対象を確定
            Id validatedCaseId = SERVICE.validateCaseId(caseId);
            List<EmailMessage> emailMessages = SELECTOR.getByCaseId(
                validatedCaseId
            );
            return emailMessages;
        } catch (CaseEmailMessageService.CaseEmailMessageServiceException e) {
            String errorMessage = e.getMessage();
            throw createHandledException(errorMessage);
        } catch (Exception e) {
            throw createHandledException(LOAD_ERROR_MESSAGE);
        }
    }

    private static AuraHandledException createHandledException(String message) {
        return new AuraHandledException(message);
    }
}
