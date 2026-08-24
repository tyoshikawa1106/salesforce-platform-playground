/**
 * ケースに紐づくメールメッセージ問い合わせ
 */
public with sharing class CaseEmailMessageSelector {
    // UI で表示する最古メールを最大 100,000 件へ制限
    private static final String EMAIL_MESSAGE_QUERY =
        'SELECT Id, ParentId, Subject, FromAddress, ToAddress, MessageDate, ' +
        'Incoming, TextBody, CreatedDate ' +
        'FROM EmailMessage ' +
        'WHERE ParentId = :caseId ' +
        'ORDER BY MessageDate ASC NULLS LAST, CreatedDate ASC, Id ASC ' +
        'LIMIT 100000';

    /**
     * 指定ケースに紐づくメールメッセージ件数を取得
     *
     * @param caseId ケースレコード ID、null の場合は 0 件
     * @return ケースに紐づくメールメッセージ件数
     */
    public Integer getCountByCaseId(Id caseId) {
        if (caseId == null) {
            return 0;
        }

        return [
            SELECT COUNT()
            FROM EmailMessage
            WHERE ParentId = :caseId
            WITH USER_MODE
        ];
    }

    /**
     * 指定ケースに紐づくメールメッセージの PaginationCursor を作成
     *
     * @param caseId ケースレコード ID、null の場合は null
     * @return 利用者権限で作成した PaginationCursor
     */
    public Database.PaginationCursor getPaginationCursorByCaseId(Id caseId) {
        // ケース ID 未指定時は Cursor を作成せず短絡
        if (caseId == null) {
            // Cursor が存在しないことを呼び出し元へ通知
            return null;
        }

        // 利用者権限でケースメールの固定順 Cursor を作成
        Database.PaginationCursor paginationCursor = Database.getPaginationCursorWithBinds(
            EMAIL_MESSAGE_QUERY,
            new Map<String, Object>{ 'caseId' => caseId },
            AccessLevel.USER_MODE
        );
        // LWC のページ取得間で引き継ぐ Cursor を返却
        return paginationCursor;
    }

    /**
     * 指定ケースに紐づくメールメッセージを PaginationCursor で取得
     *
     * @param pageQuery ケース ID、PaginationCursor、取得位置、取得件数を持つ問い合わせ条件
     * @return 送信日時、作成日時、ID の昇順で取得したページ結果
     */
    public Database.CursorFetchResult getByCaseId(CaseEmailMessageService.PageQuery pageQuery) {
        // Cursor と取得範囲が不足する場合はページ取得を実行せず短絡
        if (
            pageQuery == null ||
            pageQuery.caseId == null ||
            pageQuery.paginationCursor == null ||
            pageQuery.startIndex == null ||
            pageQuery.fetchSize == null ||
            pageQuery.fetchSize <= 0
        ) {
            return null;
        }
        // Service が確定した位置と件数で未加工の Cursor ページを取得
        Database.CursorFetchResult cursorFetchResult = pageQuery.paginationCursor.fetchPage(
            pageQuery.startIndex,
            pageQuery.fetchSize
        );
        // 取得した未加工の Cursor ページを Controller へ返却
        return cursorFetchResult;
    }

}