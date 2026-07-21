Integer relatedCaseCount = 5;
String targetCaseSubject = '[TEST] ノートPCの初期設定方法を確認したい';
String relatedCaseSubjectPrefix = '[TEST-LWC-RELATED]';
String relatedCaseSubjectLike = relatedCaseSubjectPrefix + '%';

List<Case> targetCases = [
    SELECT Id, AccountId, ContactId, Type, Origin, Status, Priority, Reason
    FROM Case
    WHERE Subject = :targetCaseSubject
    ORDER BY CreatedDate ASC, Id ASC
    LIMIT 1
];
System.assert(!targetCases.isEmpty(), '対象の合成テストケースが見つかりません。');
System.assert(targetCases[0].ContactId != null, '対象ケースに顧客が設定されていません。');
System.assert(targetCases[0].AccountId != null, '対象ケースに会社が設定されていません。');
System.assert(Case.SObjectType.getDescribe().isCreateable(), 'Case を作成する権限がありません。');
System.assert(Case.SObjectType.getDescribe().isDeletable(), 'Case を削除する権限がありません。');

Case targetCase = targetCases[0];
List<Case> existingRelatedCases = [
    SELECT Id
    FROM Case
    WHERE Subject LIKE :relatedCaseSubjectLike
    LIMIT 10000
];
Database.DeleteResult[] deleteResults = Database.delete(existingRelatedCases, false);

List<String> subjectDetails = new List<String>{
    'アカウント設定を確認したい',
    'ネットワーク接続が不安定',
    'セキュリティ設定を見直したい',
    'ソフトウェア更新について確認したい',
    '利用開始後の操作を相談したい'
};

List<Case> relatedCasesToInsert = new List<Case>();
for (Integer sequence = 1; sequence <= relatedCaseCount; sequence++) {
    String sequenceLabel = String.valueOf(sequence).leftPad(3, '0');
    relatedCasesToInsert.add(
        new Case(
            AccountId = targetCase.AccountId,
            ContactId = targetCase.ContactId,
            Subject = relatedCaseSubjectPrefix + ' ' + sequenceLabel + ' ' + subjectDetails[sequence - 1],
            Type = targetCase.Type,
            Origin = targetCase.Origin,
            Status = targetCase.Status,
            Priority = targetCase.Priority,
            Reason = targetCase.Reason,
            Description = '最近の問い合わせコンポーネント確認用の合成ケース。'
        )
    );
}

Database.SaveResult[] insertResults = Database.insert(relatedCasesToInsert, false);
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

System.debug('Deleted records: Case related case list: ' + deletedCount);
System.debug('Created records: Case related case list: ' + createdCount);
System.assert(errors.isEmpty(), '関連ケーステストデータの再作成に失敗しました: ' + String.join(errors, ' / '));
