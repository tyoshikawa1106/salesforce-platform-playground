// 最近の問い合わせ一覧で使用する関連ケースの件数と識別用件名を定義
Integer relatedCaseCount = 5;
String targetCaseSubject = '[TEST] ノートPCの初期設定方法を確認したい';
String relatedCaseSubjectPrefix = '[TEST-LWC-RELATED]';
String relatedCaseSubjectLike = relatedCaseSubjectPrefix + '%';

// 基準ケースから取引先、取引先責任者、選択リスト値を引き継ぐ
List<Case> targetCases = [
    SELECT Id, AccountId, ContactId, Type, Origin, Status, Priority, Reason
    FROM Case
    WHERE Subject = :targetCaseSubject
    ORDER BY CreatedDate ASC, Id ASC
    LIMIT 1
];
// 親レコード、必須参照、作成・削除権限を組織変更より前に確認
System.assert(!targetCases.isEmpty(), '対象の合成テストケースが見つかりません。');
System.assert(targetCases[0].ContactId != null, '対象ケースに顧客が設定されていません。');
System.assert(targetCases[0].AccountId != null, '対象ケースに会社が設定されていません。');
System.assert(Case.SObjectType.getDescribe().isCreateable(), 'Case を作成する権限がありません。');
System.assert(Case.SObjectType.getDescribe().isDeletable(), 'Case を削除する権限がありません。');

Case targetCase = targetCases[0];
// 同じ識別用件名の既存データを削除し、再実行時の件数を一定に保つ
List<Case> existingRelatedCases = [
    SELECT Id
    FROM Case
    WHERE Subject LIKE :relatedCaseSubjectLike
    LIMIT 10000
];
Database.DeleteResult[] deleteResults = Database.delete(existingRelatedCases, false);

// 一覧で内容を判別できる問い合わせテーマを準備
List<String> subjectDetails = new List<String>{
    'アカウント設定を確認したい',
    'ネットワーク接続が不安定',
    'セキュリティ設定を見直したい',
    'ソフトウェア更新について確認したい',
    '利用開始後の操作を相談したい'
};

// 基準ケースと同じ顧客・会社へ、表示順を確認できる関連ケースを追加
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

// 削除と作成を部分成功で実行し、双方の失敗理由をまとめる
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

// 作成・削除件数を記録し、失敗があればスクリプト全体をエラーにする
System.debug('Deleted records: Case related case list: ' + deletedCount);
System.debug('Created records: Case related case list: ' + createdCount);
System.assert(errors.isEmpty(), '関連ケーステストデータの再作成に失敗しました: ' + String.join(errors, ' / '));
