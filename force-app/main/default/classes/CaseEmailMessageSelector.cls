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
     * 指定ケースに紐づくメールメッセージを PaginationCursor で取得
     *
     * @param pageQuery ケース ID、PaginationCursor、取得位置、取得件数を持つ問い合わせ条件
     * @return 送信日時、作成日時、ID の昇順で取得したページ結果
     */
    public Database.CursorFetchResult getByCaseId(CaseEmailMessageService.PageQuery pageQuery) {
        if (pageQuery == null || pageQuery.caseId == null || pageQuery.fetchSize == null || pageQuery.fetchSize <= 0) {
            return null;
        }

        if (pageQuery.paginationCursor == null) {
            pageQuery.paginationCursor = createPaginationCursor(pageQuery.caseId);
        }

        Integer remainingRecords = pageQuery.paginationCursor.getNumRecords() - pageQuery.startIndex;
        if (remainingRecords <= 0) {
            return null;
        }

        Integer fetchSize = Math.min(pageQuery.fetchSize, remainingRecords);
        return pageQuery.paginationCursor.fetchPage(pageQuery.startIndex, fetchSize);
    }

    private Database.PaginationCursor createPaginationCursor(Id caseId) {
        return Database.getPaginationCursorWithBinds(
            EMAIL_MESSAGE_QUERY,
            new Map<String, Object>{ 'caseId' => caseId },
            AccessLevel.USER_MODE
        );
    }
}
