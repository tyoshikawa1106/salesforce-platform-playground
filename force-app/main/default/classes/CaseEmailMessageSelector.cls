/**
 * ケースに紐づくメールメッセージ問い合わせ
 */
public virtual with sharing class CaseEmailMessageSelector {

    // レコードページで一度に表示する上限
    private static final Integer MAX_EMAIL_MESSAGES = 50;

    /**
     * 指定ケースに紐づく最新のメールメッセージを取得
     *
     * @param caseId ケースレコード ID、null の場合は空のリスト
     * @return 送信日時の降順で最大 50 件のメールメッセージ
     */
    public virtual List<EmailMessage> getByCaseId(Id caseId) {
        if (caseId == null) {
            return new List<EmailMessage>();
        }

        return [
            SELECT Id, ParentId, Subject, FromAddress, ToAddress, MessageDate, Incoming
            FROM EmailMessage
            WHERE ParentId = :caseId
            WITH USER_MODE
            ORDER BY MessageDate DESC NULLS LAST, CreatedDate DESC, Id DESC
            LIMIT :MAX_EMAIL_MESSAGES
        ];
    }
}
