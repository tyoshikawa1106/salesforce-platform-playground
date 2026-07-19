/**
 * ケースメールメッセージ一覧の入力値検証
 */
public with sharing class CaseEmailMessageService {

    // 画面が 1 回に追加表示するメール件数
    private static final Integer PAGE_SIZE = 50;
    // Case 以外のレコードページからの呼び出しを LWC へ通知
    private static final String INVALID_CASE_MESSAGE = 'ケースレコードを確認できませんでした。ページを再読み込みしてください。';
    // 改ざんまたは破損したページトークンを LWC へ通知
    private static final String INVALID_PAGE_TOKEN_MESSAGE = '次のメールを読み込めませんでした。再読み込みしてください。';

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
     * ケース ID とページトークンから問い合わせ条件を作成
     *
     * @param caseId 検証済みケースレコード ID
     * @param pageToken 次ページ取得用トークン
     * @return カーソルと取得件数を持つページ問い合わせ条件
     * @throws CaseEmailMessageServiceException ページトークンが不正な場合
     */
    public PageQuery createPageQuery(Id caseId, String pageToken) {
        PageCursor pageCursor = parsePageToken(pageToken);
        PageQuery pageQuery = new PageQuery();
        pageQuery.caseId = caseId;
        pageQuery.cursorMessageDate = pageCursor.messageDate;
        pageQuery.cursorCreatedDate = pageCursor.createdDate;
        pageQuery.cursorRecordId = pageCursor.recordId;
        pageQuery.fetchSize = PAGE_SIZE;
        return pageQuery;
    }

    /**
     * LWC から受け取ったページトークンをカーソルに変換
     *
     * @param pageToken 次ページ取得用トークン、空白の場合は初回ページ
     * @return 問い合わせ境界となるページカーソル
     * @throws CaseEmailMessageServiceException ページトークンが不正な場合
     */
    public PageCursor parsePageToken(String pageToken) {
        if (String.isBlank(pageToken)) {
            return new PageCursor();
        }

        PageCursor pageCursor;
        try {
            pageCursor = (PageCursor) JSON.deserialize(
                pageToken,
                PageCursor.class
            );
        } catch (Exception e) {
            throw new CaseEmailMessageServiceException(
                INVALID_PAGE_TOKEN_MESSAGE,
                e
            );
        }

        if (!isValidPageCursor(pageCursor)) {
            throw new CaseEmailMessageServiceException(
                INVALID_PAGE_TOKEN_MESSAGE
            );
        }
        return pageCursor;
    }

    /**
     * 昇順で取得したメールから LWC 返却用ページを作成
     *
     * @param emailMessages 最大表示件数まで取得したメールメッセージ
     * @return 送信日時の昇順で並ぶメールと次ページ情報
     */
    public CaseEmailMessagePageWrapper createPage(
        List<EmailMessage> emailMessages
    ) {
        List<EmailMessage> pageEmailMessages = new List<EmailMessage>();
        if (emailMessages != null) {
            pageEmailMessages.addAll(emailMessages);
        }

        Boolean hasNextPage = pageEmailMessages.size() == PAGE_SIZE;
        String nextPageToken = hasNextPage
            ? createNextPageToken(pageEmailMessages)
            : null;
        return new CaseEmailMessagePageWrapper(
            pageEmailMessages,
            PAGE_SIZE,
            nextPageToken
        );
    }

    private String createNextPageToken(
        List<EmailMessage> emailMessages
    ) {
        EmailMessage cursorEmailMessage = emailMessages[
            emailMessages.size() - 1
        ];
        PageCursor pageCursor = new PageCursor();
        pageCursor.messageDate = cursorEmailMessage.MessageDate;
        pageCursor.createdDate = cursorEmailMessage.CreatedDate;
        pageCursor.recordId = cursorEmailMessage.Id;
        return JSON.serialize(pageCursor);
    }

    private Boolean isValidPageCursor(PageCursor pageCursor) {
        return pageCursor != null &&
            pageCursor.createdDate != null &&
            pageCursor.recordId != null &&
            pageCursor.recordId.getSObjectType() == EmailMessage.SObjectType;
    }

    /**
     * メールメッセージ取得位置を表すページカーソル
     */
    public class PageCursor {

        public Datetime messageDate;
        public Datetime createdDate;
        public Id recordId;
    }

    /**
     * Selector へ渡すメールメッセージページ問い合わせ条件
     */
    public class PageQuery {

        public Id caseId;
        public Datetime cursorMessageDate;
        public Datetime cursorCreatedDate;
        public Id cursorRecordId;
        public Integer fetchSize;
    }

    /**
     * ケースメールメッセージの入力値例外
     */
    public class CaseEmailMessageServiceException extends Exception {}
}