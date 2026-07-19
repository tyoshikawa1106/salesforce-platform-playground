/**
 * ケースに紐づくメールメッセージ問い合わせ
 */
public with sharing class CaseEmailMessageSelector {

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
     * 指定ケースに紐づくメールメッセージをカーソルより後から取得
     *
     * @param pageQuery ケース ID、カーソル、取得件数を持つ問い合わせ条件
     * @return 送信日時、作成日時、ID の昇順で取得したメールメッセージ
     */
    public List<EmailMessage> getByCaseId(
        CaseEmailMessageService.PageQuery pageQuery
    ) {
        if (
            pageQuery == null ||
            pageQuery.caseId == null ||
            pageQuery.fetchSize == null ||
            pageQuery.fetchSize <= 0
        ) {
            return new List<EmailMessage>();
        }

        Id caseId = pageQuery.caseId;
        Datetime cursorMessageDate = pageQuery.cursorMessageDate;
        Datetime cursorCreatedDate = pageQuery.cursorCreatedDate;
        Id cursorRecordId = pageQuery.cursorRecordId;
        Integer fetchSize = pageQuery.fetchSize;

        if (cursorRecordId == null) {
            return [
                SELECT Id, ParentId, Subject, FromAddress, ToAddress, MessageDate, Incoming, TextBody, CreatedDate
                FROM EmailMessage
                WHERE ParentId = :caseId
                WITH USER_MODE
                ORDER BY MessageDate ASC NULLS LAST, CreatedDate ASC, Id ASC
                LIMIT :fetchSize
            ];
        }

        if (cursorMessageDate == null) {
            return [
                SELECT Id, ParentId, Subject, FromAddress, ToAddress, MessageDate, Incoming, TextBody, CreatedDate
                FROM EmailMessage
                WHERE
                    ParentId = :caseId
                    AND MessageDate = NULL
                    AND (
                        CreatedDate > :cursorCreatedDate
                        OR (
                            CreatedDate = :cursorCreatedDate
                            AND Id > :cursorRecordId
                        )
                    )
                WITH USER_MODE
                ORDER BY MessageDate ASC NULLS LAST, CreatedDate ASC, Id ASC
                LIMIT :fetchSize
            ];
        }

        return [
            SELECT Id, ParentId, Subject, FromAddress, ToAddress, MessageDate, Incoming, TextBody, CreatedDate
            FROM EmailMessage
            WHERE
                ParentId = :caseId
                AND (
                    MessageDate > :cursorMessageDate
                    OR (
                        MessageDate = :cursorMessageDate
                        AND CreatedDate > :cursorCreatedDate
                    )
                    OR (
                        MessageDate = :cursorMessageDate
                        AND CreatedDate = :cursorCreatedDate
                        AND Id > :cursorRecordId
                    )
                    OR MessageDate = NULL
                )
            WITH USER_MODE
            ORDER BY MessageDate ASC NULLS LAST, CreatedDate ASC, Id ASC
            LIMIT :fetchSize
        ];
    }
}