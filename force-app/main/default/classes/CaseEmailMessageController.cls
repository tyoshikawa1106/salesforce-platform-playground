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
     * 指定ケースに紐づくメールメッセージの PaginationCursor を返す
     *
     * @param caseId ケースレコード ID、null の場合は null
     * @return LWC がページ取得間で保持する PaginationCursor
     */
    @AuraEnabled
    public static Database.PaginationCursor getEmailMessagePaginationCursor(Id caseId) {
        try {
            Id validatedCaseId = SERVICE.validateCaseId(caseId);
            return SELECTOR.getPaginationCursorByCaseId(validatedCaseId);
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
     * @param paginationCursor メールメッセージ取得に使用するページネーションカーソル
     * @param startIndex ページ取得を開始する 0 始まりの位置
     * @return 最大 50 件と次ページ情報を持つメールメッセージページ
     */
    @AuraEnabled
    public static CaseEmailMessagePageWrapper getEmailMessages(
        Id caseId,
        Database.PaginationCursor paginationCursor,
        Integer startIndex
    ) {
        try {
            // 画面からの ID を検証し、問い合わせ対象を確定
            Id validatedCaseId = SERVICE.validateCaseId(caseId);
            CaseEmailMessageService.PageQuery pageQuery = SERVICE.createPageQuery(
                validatedCaseId,
                paginationCursor,
                startIndex
            );
            Database.CursorFetchResult cursorFetchResult = SELECTOR.getByCaseId(pageQuery);
            return SERVICE.createPage(pageQuery.paginationCursor, cursorFetchResult);
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
