Integer bulkEmailCount = 240;
Integer shortBodySequence = 18;
String targetCaseSubject = '[TEST] ノートPCの初期設定方法を確認したい';
String bulkEmailSubjectPrefix = '[TEST-LWC-BULK]';
String bulkEmailSubjectLike = bulkEmailSubjectPrefix + '%';

void putIfCreateable(SObject record, String fieldName, Object value) {
    Map<String, Schema.SObjectField> fields = record.getSObjectType().getDescribe().fields.getMap();
    if (value != null && fields.containsKey(fieldName) && fields.get(fieldName).getDescribe().isCreateable()) {
        record.put(fieldName, value);
    }
}

String buildBody(Integer sequence, Integer shortSequence, String detail) {
    String sequenceLabel = String.valueOf(sequence).leftPad(3, '0');
    if (sequence == shortSequence) {
        return 'メール番号 ' + sequenceLabel + ' の確認結果です。設定内容に問題はありません。';
    }
    List<String> lines = new List<String>{
        'お問い合わせありがとうございます。',
        'メール番号: ' + sequenceLabel,
        '確認テーマ: ' + detail,
        '',
        '確認結果'
    };
    for (Integer lineNumber = 1; lineNumber <= 20; lineNumber++) {
        String lineLabel = String.valueOf(lineNumber).leftPad(2, '0');
        lines.add(
            lineLabel + '. 設定内容と動作状況を確認しました。確認項目 ' + lineLabel + ' の結果に問題はありません。'
        );
    }
    lines.add('');
    lines.add('以上が今回の確認結果です。追加のご質問があればご返信ください。');
    return String.join(lines, '\n');
}

List<Case> targetCases = [
    SELECT Id
    FROM Case
    WHERE Subject = :targetCaseSubject
    ORDER BY CreatedDate ASC, Id ASC
    LIMIT 1
];
System.assert(!targetCases.isEmpty(), '対象の合成テストケースが見つかりません。');
System.assert(EmailMessage.SObjectType.getDescribe().isCreateable(), 'EmailMessage を作成する権限がありません。');

Id targetCaseId = targetCases[0].Id;
List<EmailMessage> existingEmailMessages = [
    SELECT Id
    FROM EmailMessage
    WHERE ParentId = :targetCaseId AND Subject LIKE :bulkEmailSubjectLike
];
Database.DeleteResult[] deleteResults = Database.delete(existingEmailMessages, false);

List<String> subjectDetails = new List<String>{
    '初期設定手順の確認',
    'ネットワーク接続の確認',
    'アカウント設定の確認',
    'セキュリティ設定の確認',
    'ソフトウェア更新の確認',
    '利用開始後のフォローアップ'
};

List<EmailMessage> emailMessagesToInsert = new List<EmailMessage>();
for (Integer sequence = 1; sequence <= bulkEmailCount; sequence++) {
    String sequenceLabel = String.valueOf(sequence).leftPad(3, '0');
    Integer contentIndex = Math.mod(sequence - 1, subjectDetails.size());
    String subject = bulkEmailSubjectPrefix + ' ' + sequenceLabel + ' ' + subjectDetails[contentIndex];
    String body = buildBody(sequence, shortBodySequence, subjectDetails[contentIndex]);

    Boolean incoming = Math.mod(sequence, 2) == 1;
    EmailMessage emailMessage = new EmailMessage();
    putIfCreateable(emailMessage, 'ParentId', targetCaseId);
    putIfCreateable(emailMessage, 'RelatedToId', targetCaseId);
    putIfCreateable(emailMessage, 'Subject', subject);
    putIfCreateable(emailMessage, 'FromAddress', incoming ? 'customer.demo@example.com' : 'support.demo@example.com');
    putIfCreateable(emailMessage, 'ToAddress', incoming ? 'support.demo@example.com' : 'customer.demo@example.com');
    putIfCreateable(emailMessage, 'MessageDate', Datetime.now().addHours(-(bulkEmailCount - sequence) * 6));
    putIfCreateable(emailMessage, 'Incoming', incoming);
    putIfCreateable(emailMessage, 'Status', incoming ? '0' : '3');
    putIfCreateable(emailMessage, 'TextBody', body);
    emailMessagesToInsert.add(emailMessage);
}

Database.SaveResult[] insertResults = Database.insert(emailMessagesToInsert, false);
Integer deletedCount = 0;
Integer createdCount = 0;
List<String> errors = new List<String>();
for (Database.DeleteResult result : deleteResults) {
    if (result.isSuccess()) {
        deletedCount++;
        continue;
    }
    for (Database.Error error : result.getErrors()) {
        errors.add(error.getStatusCode() + ' ' + error.getMessage());
    }
}
for (Database.SaveResult result : insertResults) {
    if (result.isSuccess()) {
        createdCount++;
        continue;
    }
    for (Database.Error error : result.getErrors()) {
        errors.add(error.getStatusCode() + ' ' + error.getMessage());
    }
}

System.debug('Deleted records: Case email message list: ' + deletedCount);
System.debug('Created records: Case email message list: ' + createdCount);
System.assert(errors.isEmpty(), 'メールテストデータの再作成に失敗しました: ' + String.join(errors, ' / '));
