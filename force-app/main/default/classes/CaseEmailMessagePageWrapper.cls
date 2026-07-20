/**
 * ケースメールメッセージ一覧に返すページ情報 Wrapper
 */
public with sharing class CaseEmailMessagePageWrapper {
    // 活動タイムラインに追加表示するメールメッセージ
    @AuraEnabled
    public List<EmailMessage> emailMessages { get; private set; }

    // 次のメールメッセージがさらに存在するかどうか
    @AuraEnabled
    public Boolean hasNextPage { get; private set; }

    // 次ページ取得へ引き継ぐ Salesforce 標準 PaginationCursor
    @AuraEnabled
    public Database.PaginationCursor paginationCursor { get; private set; }

    // 次ページ取得を開始する 0 始まりの位置
    @AuraEnabled
    public Integer nextIndex { get; private set; }

    /**
     * 空のメールメッセージページを作成
     */
    public CaseEmailMessagePageWrapper() {
        this.emailMessages = new List<EmailMessage>();
        this.hasNextPage = false;
        this.paginationCursor = null;
        this.nextIndex = null;
    }

    /**
     * メールメッセージとページ情報を初期化
     *
     * @param emailMessages 活動タイムラインに返すメールメッセージ
     * @param paginationCursor 次ページ取得へ引き継ぐ PaginationCursor
     * @param nextIndex 次ページ取得を開始する 0 始まりの位置
     */
    public CaseEmailMessagePageWrapper(
        List<EmailMessage> emailMessages,
        Database.PaginationCursor paginationCursor,
        Integer nextIndex
    ) {
        this();
        this.emailMessages = emailMessages ?? new List<EmailMessage>();
        this.paginationCursor = paginationCursor;
        this.nextIndex = nextIndex;
        this.hasNextPage =
            paginationCursor != null &&
            nextIndex != null &&
            nextIndex < paginationCursor.getNumRecords();
    }
}
