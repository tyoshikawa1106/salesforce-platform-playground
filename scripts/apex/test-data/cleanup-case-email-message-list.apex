String targetCaseSubject = '[TEST] ノートPCの初期設定方法を確認したい';
String bulkEmailSubjectLike = '[TEST-LWC-BULK]%';

List<Case> targetCases = [
    SELECT Id
    FROM Case
    WHERE Subject = :targetCaseSubject
    ORDER BY CreatedDate ASC, Id ASC
    LIMIT 1
];

Integer deletedCount = 0;
if (!targetCases.isEmpty()) {
    List<EmailMessage> emailMessages = [
        SELECT Id
        FROM EmailMessage
        WHERE ParentId = :targetCases[0].Id AND Subject LIKE :bulkEmailSubjectLike
        LIMIT 10000
    ];
    Database.DeleteResult[] results = Database.delete(emailMessages, false);
    List<String> errors = new List<String>();
    for (Database.DeleteResult result : results) {
        if (result.isSuccess()) {
            deletedCount++;
            continue;
        }
        for (Database.Error error : result.getErrors()) {
            errors.add(error.getStatusCode() + ' ' + error.getMessage());
        }
    }
    System.assert(errors.isEmpty(), 'メールテストデータの削除に失敗しました: ' + String.join(errors, ' / '));
}

System.debug('Deleted records: Case email message list: ' + deletedCount);
