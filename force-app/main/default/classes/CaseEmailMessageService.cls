/**
 * ケースメールメッセージ一覧の入力値検証
 */
public with sharing class CaseEmailMessageService {
    // 画面が 1 回に追加表示するメール件数
    private static final Integer PAGE_SIZE = 50;
    // Case 以外のレコードページからの呼び出しを LWC へ通知
    private static final String INVALID_CASE_MESSAGE = 'ケースレコードを確認できませんでした。ページを再読み込みしてください。';
    // 不正なページ取得位置を LWC へ通知
    private static final String INVALID_START_INDEX_MESSAGE = '次のメールを読み込めませんでした。再読み込みしてください。';

    /**
     * 画面から受け取った ID が Case ID かを検証
     *
     * @param caseId Case レコード ID
     * @return 検証済み Case ID、入力が null の場合は null
     * @throws CaseEmailMessageServiceException Case 以外の ID の場合
     */
    public Id validateCaseId(Id caseId) {
        if (caseId == null) {
            return null;
        }
        Schema.SObjectType objectType = caseId.getSObjectType();
        Boolean isCaseId = objectType == Case.SObjectType;
        if (!isCaseId) {
            throw new CaseEmailMessageServiceException(INVALID_CASE_MESSAGE);
        }
        return caseId;
    }

    /**
     * ケース ID と PaginationCursor から問い合わせ条件を作成
     *
     * @param caseId 検証済みケースレコード ID
     * @param paginationCursor 前回ページから引き継いだ PaginationCursor
     * @param startIndex ページ取得を開始する 0 始まりの位置
     * @return PaginationCursor、取得位置、取得件数を持つページ問い合わせ条件
     * @throws CaseEmailMessageServiceException 取得位置が不正な場合
     */
    public PageQuery createPageQuery(Id caseId, Database.PaginationCursor paginationCursor, Integer startIndex) {
        Integer validatedStartIndex = startIndex ?? 0;
        if (validatedStartIndex < 0 || (paginationCursor == null && validatedStartIndex != 0)) {
            throw new CaseEmailMessageServiceException(INVALID_START_INDEX_MESSAGE);
        }

        PageQuery pageQuery = new PageQuery();
        pageQuery.caseId = caseId;
        pageQuery.paginationCursor = paginationCursor;
        pageQuery.startIndex = validatedStartIndex;
        pageQuery.fetchSize = PAGE_SIZE;
        return pageQuery;
    }

    /**
     * PaginationCursor の取得結果から LWC 返却用ページを作成
     *
     * @param paginationCursor ページ取得に使用した PaginationCursor
     * @param cursorFetchResult PaginationCursor が返したページ取得結果
     * @return 送信日時の昇順で並ぶメールと次ページ情報
     */
    public CaseEmailMessagePageWrapper createPage(
        Database.PaginationCursor paginationCursor,
        Database.CursorFetchResult cursorFetchResult
    ) {
        if (paginationCursor == null || cursorFetchResult == null) {
            return new CaseEmailMessagePageWrapper();
        }

        List<EmailMessage> emailMessages = new List<EmailMessage>();
        for (SObject record : cursorFetchResult.getRecords()) {
            emailMessages.add((EmailMessage) record);
        }

        Integer nextIndex = cursorFetchResult.getNextIndex();
        return new CaseEmailMessagePageWrapper(emailMessages, paginationCursor, nextIndex);
    }

    /**
     * Selector へ渡すメールメッセージページ問い合わせ条件
     */
    public class PageQuery {
        public Id caseId;
        public Database.PaginationCursor paginationCursor;
        public Integer startIndex;
        public Integer fetchSize;
    }

    /**
     * ケースメールメッセージの入力値例外
     */
    public class CaseEmailMessageServiceException extends Exception {
    }
}
