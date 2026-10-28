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
        Id validatedCaseId = getValidatedCaseId(caseId);
        try {
            return SELECTOR.getCountByCaseId(validatedCaseId);
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
        Id validatedCaseId = getValidatedCaseId(caseId);
        CaseEmailMessageService.PageQuery pageQuery = getPageQuery(
            validatedCaseId,
            paginationCursor,
            startIndex
        );
        try {
            // 初回ページだけ利用者権限で PaginationCursor を作成
            Database.PaginationCursor pageCursor = paginationCursor;
            if (pageCursor == null) {
                pageCursor = SELECTOR.getPaginationCursorByCaseId(validatedCaseId);
            }
            // Cursor の残件数に合わせた取得範囲を Service で確定
            pageQuery = SERVICE.preparePageFetch(pageQuery, pageCursor);
            // 確定済みの位置と件数で未加工の Cursor ページを取得
            Database.CursorFetchResult cursorFetchResult = SELECTOR.getByCaseId(pageQuery);
            // Cursor 取得結果を LWC 返却用ページへ変換
            CaseEmailMessagePageWrapper page = SERVICE.createPage(pageQuery.paginationCursor, cursorFetchResult);
            // 作成したページ応答を返却
            return page;
        } catch (Exception e) {
            throw createHandledException(LOAD_ERROR_MESSAGE);
        }
    }

    private static Id getValidatedCaseId(Id caseId) {
        CaseEmailMessageService.CaseIdValidationResult validationResult = SERVICE.validateCaseId(caseId);
        if (!validationResult.isValid) {
            throw createHandledException(validationResult.errorMessage);
        }
        return validationResult.caseId;
    }

    private static CaseEmailMessageService.PageQuery getPageQuery(
        Id caseId,
        Database.PaginationCursor paginationCursor,
        Integer startIndex
    ) {
        CaseEmailMessageService.PageQueryResult pageQueryResult = SERVICE.createPageQuery(
            caseId,
            paginationCursor,
            startIndex
        );
        if (!pageQueryResult.isValid) {
            throw createHandledException(pageQueryResult.errorMessage);
        }
        return pageQueryResult.pageQuery;
    }

    private static AuraHandledException createHandledException(String message) {
        return new AuraHandledException(message);
    }
}