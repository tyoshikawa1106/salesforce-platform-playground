/**
 * ケースに紐づくメールメッセージ一覧の Apex 入口
 */
public with sharing class CaseEmailMessageController {

    private static final String INVALID_CASE_MESSAGE = 'ケースレコードを確認できませんでした。ページを再読み込みしてください。';
    private static final String LOAD_ERROR_MESSAGE = 'メールメッセージを読み込めませんでした。時間をおいてもう一度お試しください。';

    private CaseEmailMessageSelector selector = new CaseEmailMessageSelector();

    /**
     * 指定ケースに紐づく最新のメールメッセージを返す
     *
     * @param caseId ケースレコード ID、null の場合は空のリスト
     * @return 送信日時の降順で最大 50 件のメールメッセージ
     */
    @AuraEnabled(cacheable=true)
    public static List<EmailMessage> getEmailMessages(Id caseId) {
        if (caseId == null) {
            return new List<EmailMessage>();
        }
        if (caseId.getSObjectType() != Case.SObjectType) {
            throw createHandledException(INVALID_CASE_MESSAGE);
        }

        CaseEmailMessageController controller = new CaseEmailMessageController();
        return controller.getEmailMessagesForCase(caseId);
    }

    private List<EmailMessage> getEmailMessagesForCase(Id caseId) {
        try {
            return this.selector.getByCaseId(caseId);
        } catch (QueryException e) {
            throw createHandledException(LOAD_ERROR_MESSAGE);
        } catch (Exception e) {
            throw createHandledException(LOAD_ERROR_MESSAGE);
        }
    }

    private static AuraHandledException createHandledException(String message) {
        return new AuraHandledException(message);
    }
}
