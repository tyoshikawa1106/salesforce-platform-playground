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
     * 指定ケースに紐づくメールメッセージ件数を返す
     *
     * @param caseId ケースレコード ID、null の場合は 0 件
     * @return ケースに紐づくメールメッセージ件数
     */
    @AuraEnabled(cacheable=true)
    public static Integer getEmailMessageCount(Id caseId) {
        try {
            Id validatedCaseId = SERVICE.validateCaseId(caseId);
            return SELECTOR.getCountByCaseId(validatedCaseId);
        } catch (CaseEmailMessageService.CaseEmailMessageServiceException e) {
            String errorMessage = e.getMessage();
            throw createHandledException(errorMessage);
        } catch (Exception e) {
            throw createHandledException(LOAD_ERROR_MESSAGE);
        }
    }

    /**
     * 指定ケースに紐づくメールメッセージを古い順に返す
     *
     * @param caseId ケースレコード ID、null の場合は空のページ
     * @param pageToken 次のメールメッセージを取得するためのカーソルトークン
     * @return 最大 50 件と次ページ情報を持つメールメッセージページ
     */
    @AuraEnabled(cacheable=true)
    public static CaseEmailMessagePageWrapper getEmailMessages(
        Id caseId,
        String pageToken
    ) {
        try {
            // 画面からの ID を検証し、問い合わせ対象を確定
            Id validatedCaseId = SERVICE.validateCaseId(caseId);
            CaseEmailMessageService.PageQuery pageQuery = SERVICE.createPageQuery(
                validatedCaseId,
                pageToken
            );
            List<EmailMessage> emailMessages = SELECTOR.getByCaseId(
                pageQuery
            );
            return SERVICE.createPage(emailMessages);
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