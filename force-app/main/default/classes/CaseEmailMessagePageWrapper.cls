/**
 * ケースメールメッセージ一覧に返すページ情報 Wrapper
 */
public with sharing class CaseEmailMessagePageWrapper {

    // 活動タイムラインに追加表示するメールメッセージ
    @AuraEnabled
    public List<EmailMessage> emailMessages { get; private set; }

    // 1 回に取得する最大件数
    @AuraEnabled
    public Integer pageSize { get; private set; }

    // 次のメールメッセージがさらに存在するかどうか
    @AuraEnabled
    public Boolean hasNextPage { get; private set; }

    // 次ページ取得用のカーソルトークン
    @AuraEnabled
    public String nextPageToken { get; private set; }

    /**
     * 空のメールメッセージページを作成
     */
    public CaseEmailMessagePageWrapper() {
        this.emailMessages = new List<EmailMessage>();
        this.pageSize = 0;
        this.hasNextPage = false;
        this.nextPageToken = null;
    }

    /**
     * メールメッセージとページ情報を初期化
     *
     * @param emailMessages 活動タイムラインに返すメールメッセージ
     * @param pageSize 1 回に取得する最大件数
     * @param nextPageToken 次ページ取得用トークン
     */
    public CaseEmailMessagePageWrapper(
        List<EmailMessage> emailMessages,
        Integer pageSize,
        String nextPageToken
    ) {
        this();
        this.emailMessages = emailMessages ?? new List<EmailMessage>();
        this.pageSize = pageSize ?? 0;
        this.nextPageToken = nextPageToken;
        this.hasNextPage = String.isNotBlank(nextPageToken);
    }
}