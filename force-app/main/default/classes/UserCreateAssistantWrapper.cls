/** ユーザー作成アシスタントの表示項目と編集条件 */
public with sharing class UserCreateAssistantWrapper {
    // 参照権限のある標準・カスタム項目の値と入力条件
    @AuraEnabled
    public List<Map<String, Object>> fields { get; set; }

    // サーバーで読み直すコピー元
    @AuraEnabled
    public Id sourceId { get; set; }
    // コピー元の更新・無効化を要求
    @AuraEnabled
    public Boolean deactivateSource;
    // 権限セットの直接割り当てを引き継ぐ
    @AuraEnabled
    public Boolean copyPermissionSets;
    // グループ単位の割り当てを引き継ぐ
    @AuraEnabled
    public Boolean copyPermissionSetGroups;
    // 作成したユーザーだけにパスワードリセットメールを送信
    @AuraEnabled
    public Boolean sendResetEmail;
    // コピー元の変更項目だけを受け取る
    @AuraEnabled
    public String sourceValuesJson { get; set; }
    // 新規ユーザーに明示的に入力した値を受け取る
    @AuraEnabled
    public String targetValuesJson { get; set; }
    // 作成に成功したサーバー内部の割り当て先
    public Id targetId { get; set; }

    /** 項目の未取得状態で初期化 */
    public UserCreateAssistantWrapper() {
        // 未取得時も空の一覧を返却
        fields = new List<Map<String, Object>>();
        // コピー元は既定で参照のみ
        deactivateSource = false;
        sendResetEmail = false;
        // 直接の割り当ては既定で引き継ぐ
        copyPermissionSets = true;
        // グループの割り当ても既定で引き継ぐ
        copyPermissionSetGroups = true;
    }
}
