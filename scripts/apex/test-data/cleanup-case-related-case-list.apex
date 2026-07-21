String relatedCaseSubjectLike = '[TEST-LWC-RELATED]%';

List<Case> relatedCases = [
    SELECT Id
    FROM Case
    WHERE Subject LIKE :relatedCaseSubjectLike
    LIMIT 10000
];
System.assert(Case.SObjectType.getDescribe().isDeletable(), 'Case を削除する権限がありません。');

Database.DeleteResult[] results = Database.delete(relatedCases, false);
Integer deletedCount = 0;
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

System.debug('Deleted records: Case related case list: ' + deletedCount);
System.assert(errors.isEmpty(), '関連ケーステストデータの削除に失敗しました: ' + String.join(errors, ' / '));
