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
        // 未指定の開始位置を初回ページの 0 へ正規化
        Integer validatedStartIndex = startIndex ?? 0;
        // 負の位置または Cursor なしの途中位置を拒否
        if (validatedStartIndex < 0 || (paginationCursor == null && validatedStartIndex != 0)) {
            throw new CaseEmailMessageServiceException(INVALID_START_INDEX_MESSAGE);
        }

        // Selector へ渡す問い合わせ条件を非 null の DTO として作成
        PageQuery pageQuery = new PageQuery();
        // 検証済み Case ID を問い合わせ対象として保持
        pageQuery.caseId = caseId;
        // 継続ページで受け取った Cursor を保持
        pageQuery.paginationCursor = paginationCursor;
        // 検証済みの取得開始位置を保持
        pageQuery.startIndex = validatedStartIndex;
        // 画面が一度に取得する既定件数を保持
        pageQuery.fetchSize = PAGE_SIZE;
        // 検証済みの問い合わせ条件を返却
        return pageQuery;
    }

    /**
     * PaginationCursor の残件数に合わせてページ取得条件を確定
     *
     * @param pageQuery 検証済みのページ問い合わせ条件
     * @param paginationCursor Selector が作成した PaginationCursor
     * @return Cursor と残件数以内の取得件数を持つ問い合わせ条件
     */
    public PageQuery preparePageFetch(PageQuery pageQuery, Database.PaginationCursor paginationCursor) {
        // 問い合わせ条件がない場合も非 null の空条件を返却
        if (pageQuery == null) {
            return new PageQuery();
        }
        // 初回または継続ページで使用する Cursor を問い合わせ条件へ設定
        pageQuery.paginationCursor = paginationCursor;
        // Cursor がない場合は Selector のページ取得を短絡する件数へ設定
        if (paginationCursor == null) {
            pageQuery.fetchSize = 0;
            return pageQuery;
        }
        // 現在位置以降に残るレコード件数を算出
        Integer remainingRecords = paginationCursor.getNumRecords() - pageQuery.startIndex;
        // 残件数がない場合は Selector のページ取得を短絡する件数へ設定
        if (remainingRecords <= 0) {
            pageQuery.fetchSize = 0;
            return pageQuery;
        }
        // 既定ページサイズと残件数の小さい方を取得件数へ確定
        pageQuery.fetchSize = Math.min(pageQuery.fetchSize, remainingRecords);
        // Selector がそのまま実行できる問い合わせ条件を返却
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
