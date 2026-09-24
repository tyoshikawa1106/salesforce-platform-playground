/** 削除画面の実行条件と対象一覧を構成 */
public with sharing class TestDataDeleteService {
    /**
     * 実効権限と開発環境を確認して対象一覧を返却
     * @param permissions 実行ユーザーの実効権限
     * @param environment 開発環境の判定結果
     * @return 画面の対象一覧と拒否理由
     */
    public TestDataDeleteWrapper createView(
        List<UserPermissionAccess> permissions,
        TestDataDeleteBatchWrapper.Environment environment
    ) {
        // 権限を確認するまで対象データを問い合わせない
        TestDataDeleteWrapper wrapper = new TestDataDeleteWrapper();
        if (environment != TestDataDeleteBatchWrapper.Environment.DEVELOPMENT) {
            wrapper.errorMessage = '開発組織でのみ実行できます。';
            return wrapper;
        }
        // 個別の権限セット名に依存せずSalesforceの実効権限を使用
        if (permissions.isEmpty() || permissions[0].PermissionsModifyAllData != true) {
            wrapper.errorMessage = '「すべてのデータの編集」権限が必要です。';
            return wrapper;
        }
        // 許可済みユーザーにだけ対象一覧を構成
        return createTargets();
    }

    /** 組織で利用可能な固定対象と権限不足をまとめる
     * @return 固定対象とその実行可否
     */
    private TestDataDeleteWrapper createTargets() {
        // 画面へ返すデータはこの処理で新しく生成
        TestDataDeleteWrapper wrapper = new TestDataDeleteWrapper();
        // バッチと画面で同じ固定の削除計画を使用
        TestDataDeleteBatchWrapper plan = new TestDataDeleteBatchWrapper();
        wrapper.objectNames = plan.objectNames.clone();
        Map<String, Schema.SObjectType> objectTypes = Schema.getGlobalDescribe();
        for (String objectName : wrapper.objectNames) {
            // 存在しないoptional objectだけを対象外と表示
            Schema.SObjectType objectType = objectTypes.get(objectName);
            if (objectType == null) {
                wrapper.unavailableObjects.add(objectName);
                wrapper.labels.put(objectName, objectName);
                continue;
            }
            // 一つでも権限不足なら削除開始前に拒否
            Schema.DescribeSObjectResult description = objectType.getDescribe(SObjectDescribeOptions.DEFERRED);
            wrapper.labels.put(objectName, description.getLabel());
            if (!description.isAccessible() || !description.isQueryable() || !description.isDeletable()) {
                wrapper.errorMessage = objectName + 'の参照・削除権限が必要です。';
            }
        }
        return wrapper;
    }

    /**
     * 任意のAPI名で対象外データを参照させない
     * @param current 権限確認済みの画面情報
     * @param objectName 要求された対象名
     * @return 検証後の画面情報
     */
    public TestDataDeleteWrapper checkObject(TestDataDeleteWrapper current, String objectName) {
        // 画面応答を複製して呼び出し元の値を変更しない
        TestDataDeleteWrapper wrapper = (TestDataDeleteWrapper) JSON.deserialize(
            JSON.serialize(current),
            TestDataDeleteWrapper.class
        );
        if (!wrapper.objectNames.contains(objectName) || wrapper.unavailableObjects.contains(objectName)) {
            wrapper.errorMessage = '指定されたオブジェクトは削除対象ではありません。';
        }
        wrapper.objectName = objectName ?? '';
        return wrapper;
    }

    /**
     * 重複起動と最終確認の有無を判定
     * @param current 権限確認済みの画面情報
     * @param activeJobs 実行中の同機能ジョブ
     * @param confirmation 全件削除の確認文字列
     * @return 受付可否
     */
    public TestDataDeleteWrapper checkStart(
        TestDataDeleteWrapper current,
        List<AsyncApexJob> activeJobs,
        String confirmation
    ) {
        // メイン処理が使う判定結果を副作用なく返却
        TestDataDeleteWrapper wrapper = (TestDataDeleteWrapper) JSON.deserialize(
            JSON.serialize(current),
            TestDataDeleteWrapper.class
        );
        wrapper.executionState = activeJobs.isEmpty() ? 'IDLE' : 'RUNNING';
        if (confirmation != 'DELETE_ALL') {
            wrapper.errorMessage = '対象オブジェクトの全件削除を確認してください。';
        }
        if (wrapper.executionState == 'RUNNING') {
            wrapper.errorMessage = '削除処理が実行中です。終了後に再確認してください。';
        }
        return wrapper;
    }
}