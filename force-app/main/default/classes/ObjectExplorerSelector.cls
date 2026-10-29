/** 項目定義・分類と所有者候補の読み取り */
public inherited sharing class ObjectExplorerSelector {

    /**
     * 日時取得に必要な項目名と識別子だけを取得
     * @param objectName 選択中オブジェクトAPI名
     * @return 項目定義の識別子
     */
    public List<FieldDefinition> selectFieldAuditTargets(String objectName) {
        // 必須の対象がない場合は全項目検索へ広げない
        if (String.isBlank(objectName)) { return new List<FieldDefinition>(); }
        // ユーザー権限で対象オブジェクトの項目識別子だけを照会
        List<FieldDefinition> records = [SELECT QualifiedApiName, DurableId FROM FieldDefinition
            WHERE EntityDefinition.QualifiedApiName = :objectName WITH USER_MODE];
        // 可視性判定や加工はServiceへ委ねる
        return records;
    }

    /**
     * 構成項目・個人取引先項目も含めて設定画面の型表記を取得
     * @param objectName Describeで検証済みのオブジェクトAPI名
     * @return 言語設定に応じた項目定義の型表記
     */
    public List<EntityParticle> selectFieldTypes(String objectName) {
        if (String.isBlank(objectName)) { return new List<EntityParticle>(); }
        List<EntityParticle> records = [SELECT QualifiedApiName, FieldDefinition.DataType FROM EntityParticle
            WHERE EntityDefinition.QualifiedApiName = :objectName WITH USER_MODE];
        return records;
    }

    /**
     * 対象オブジェクトの分類を取得
     * @param objectName Describe検証済みのAPI名
     * @return 項目定義上の分類
     */
    public List<FieldDefinition> selectFields(String objectName) {
        if (String.isBlank(objectName)) { return new List<FieldDefinition>(); }
        List<FieldDefinition> records = [SELECT QualifiedApiName, DurableId, ComplianceGroup,
            SecurityClassification, BusinessStatus, BusinessOwnerId FROM FieldDefinition
            WHERE EntityDefinition.QualifiedApiName = :objectName WITH USER_MODE];
        return records;
    }

    /**
     * 項目定義の作成者・更新者を実行ユーザーの可視範囲で取得
     * @param ids 日時応答に含まれるユーザーID、空は照会しない
     * @return 可視なIDとユーザー名
     */
    public List<User> selectAuditUsers(Set<Id> ids) {
        // 対象未指定を全ユーザー検索へ広げない
        if (ids == null || ids.isEmpty()) { return new List<User>(); }
        // 連携ユーザーの参照権限を画面の人物表示へ持ち込まない
        List<User> records = [SELECT Id, Name FROM User WHERE Id IN :ids WITH USER_MODE];
        // 表示の対応付けはFieldServiceへ委ねる
        return records;
    }

    /**
     * 所有者表示に必要なユーザーをまとめて取得
     * @param ids 所有者IDの集合
     * @return 可視なユーザーの表示名
     */
    public List<User> selectOwnerUsers(Set<Id> ids) {
        if (ids == null || ids.isEmpty()) { return new List<User>(); }
        List<User> records = [SELECT Id, Name, Username, IsActive FROM User WHERE Id IN :ids WITH USER_MODE];
        return records;
    }

    /**
     * 所有者表示に必要な公開グループをまとめて取得
     * @param ids 所有者IDの集合
     * @return 可視なグループの表示名
     */
    public List<Group> selectOwnerGroups(Set<Id> ids) {
        if (ids == null || ids.isEmpty()) { return new List<Group>(); }
        List<Group> records = [SELECT Id, Name, DeveloperName FROM Group WHERE Id IN :ids AND Type = 'Regular' WITH USER_MODE];
        return records;
    }

    /**
     * 有効ユーザーから所有者候補を検索
     * @param term 正規化済み検索語
     * @return 可視ユーザーの候補
     */
    public List<User> selectUsers(String term) {
        // 空欄から全件検索を開始しない
        if (String.isBlank(term)) { return new List<User>(); }
        // ワイルドカードを検索文字として扱い、前方一致に限定
        String pattern = term.trim().replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%';
        List<User> records = [SELECT Id, Name, Username FROM User WHERE IsActive = true AND (Name LIKE :pattern OR Email LIKE :pattern)
            WITH USER_MODE ORDER BY Name, Id LIMIT 20];
        return records;
    }

    /**
     * 公開グループから所有者候補を検索
     * @param term 正規化済み検索語
     * @return 可視グループの候補
     */
    public List<Group> selectGroups(String term) {
        // 空欄から全件検索を開始しない
        if (String.isBlank(term)) { return new List<Group>(); }
        // 公開グループ名も同じ前方一致で検索
        String pattern = term.trim().replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%';
        List<Group> records = [SELECT Id, Name, DeveloperName FROM Group WHERE Type = 'Regular' AND Name LIKE :pattern
            WITH USER_MODE ORDER BY Name, Id LIMIT 20];
        return records;
    }

    /**
     * 一括保存対象の識別情報をまとめて取得
     * @param objectName 参照可否を確認した対象
     * @param fieldNames Describeで確認した項目名
     * @return 項目名と完全な識別子
     */
    public List<FieldDefinition> selectFieldsByNames(String objectName, Set<String> fieldNames) {
        // 必須条件がない場合に全項目の取得へ広げない
        if (String.isBlank(objectName) || fieldNames == null || fieldNames.isEmpty()) { return new List<FieldDefinition>(); }
        // 結果は加工せず定義レコードのまま引き渡す
        List<FieldDefinition> records = [SELECT QualifiedApiName, DurableId FROM FieldDefinition
            WHERE EntityDefinition.QualifiedApiName = :objectName AND QualifiedApiName IN :fieldNames WITH USER_MODE];
        // 同じ定義の識別子をService側で照合
        return records;
    }

    /**
     * 実行ユーザー自身の有効なカスタマイズ権限を取得
     * @return プロファイルと権限セットを反映した実効権限
     */
    public List<UserPermissionAccess> selectCurrentPermissions() {
        // 実効権限はプラットフォームの現在ユーザー用オブジェクトから取得
        List<UserPermissionAccess> records = [SELECT PermissionsModifyDataClassification, PermissionsCustomizeApplication FROM UserPermissionAccess WITH USER_MODE LIMIT 1];
        // 個別の権限セットやプロファイルの合成を独自実装しない
        return records;
    }
}