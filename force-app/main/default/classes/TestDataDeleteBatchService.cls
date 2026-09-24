/** オブジェクト単位の削除可否、結果集計、次の処理への継続条件を判定 */
public with sharing class TestDataDeleteBatchService {
    /** Developer Editionまたは有効なScratchだけを許可
     * @param organizations 現在組織の種別と有効期限
     * @return 削除機能専用の環境判定
     */
    public static TestDataDeleteBatchWrapper.Environment getEnvironment(List<Organization> organizations) {
        // 情報が取れない場合は削除を許可しない
        if (organizations == null || organizations.isEmpty()) {
            return TestDataDeleteBatchWrapper.Environment.DISALLOWED;
        }
        // SandboxのEditionだけを見てDeveloper Editionと誤認しない
        Organization organization = organizations[0];
        Boolean developer = organization.IsSandbox == false && organization.OrganizationType == 'Developer Edition';
        // Salesforce CLIと同じ組織項目で通常SandboxとScratchを区別
        Boolean scratch =
            organization.IsSandbox == true &&
            organization.TrialExpirationDate != null &&
            organization.TrialExpirationDate > System.now();
        return developer || scratch
            ? TestDataDeleteBatchWrapper.Environment.DEVELOPMENT
            : TestDataDeleteBatchWrapper.Environment.DISALLOWED;
    }

    /**
     * 実効権限と処理対象を検証
     * @param current 現在の削除計画
     * @param permissions 実行ユーザーの実効権限
     * @param environment 開発環境の判定結果
     * @return 拒否理由を反映した集計値
     */
    public TestDataDeleteBatchWrapper checkExecution(
        TestDataDeleteBatchWrapper current,
        List<UserPermissionAccess> permissions,
        TestDataDeleteBatchWrapper.Environment environment
    ) {
        // 前のスコープで停止した場合も拒否状態を維持
        TestDataDeleteBatchWrapper wrapper = new TestDataDeleteBatchWrapper(current);
        if (String.isNotEmpty(wrapper.errorMessage)) {
            return wrapper;
        }
        // 組織・実効権限を各非同期トランザクションで再確認
        if (
            environment != TestDataDeleteBatchWrapper.Environment.DEVELOPMENT ||
            permissions.isEmpty() ||
            permissions[0].PermissionsModifyAllData != true
        ) {
            wrapper.errorMessage = '開発組織と「すべてのデータの編集」権限が必要です。';
            return wrapper;
        }
        // 外部から書き換えられた計画を固定の許可リストと照合
        TestDataDeleteBatchWrapper expected = new TestDataDeleteBatchWrapper();
        if (
            wrapper.objectNames != expected.objectNames ||
            wrapper.position < 0 ||
            wrapper.position >= wrapper.objectNames.size()
        ) {
            wrapper.errorMessage = '削除対象の定義が不正です。';
            return wrapper;
        }
        // 固定計画の確認後にオブジェクト固有の実行条件を判定
        String objectName = wrapper.objectNames[wrapper.position];
        wrapper.errorMessage = getObjectError(objectName, permissions);
        return wrapper;
    }

    /** オブジェクトの機能状態と必要な実効権限を確認
     * @param objectName 検証済みの対象名
     * @param permissions 実行者の実効権限
     * @return 停止理由または空文字
     */
    private String getObjectError(String objectName, List<UserPermissionAccess> permissions) {
        // 全ファイルの照会は通常データの管理権限と別に確認
        if (objectName == 'ContentDocument' && permissions[0].PermissionsQueryAllFiles != true) {
            return '全ファイルを対象にするため「すべてのファイルを照会」権限も必要です。';
        }
        // 機能自体が存在しないoptional objectだけを対象外とする
        Schema.SObjectType objectType = Schema.getGlobalDescribe().get(objectName);
        if (objectType == null) {
            return '';
        }
        // 読み取り不能を空データと誤認しない
        Schema.DescribeSObjectResult description = objectType.getDescribe(SObjectDescribeOptions.DEFERRED);
        if (!description.isAccessible() || !description.isQueryable() || !description.isDeletable()) {
            return objectName + 'の参照・削除権限が必要です。';
        }
        return '';
    }

    /**
     * 個人取引先のContactを親削除へ委ねる必要があるか判定
     * @param objectName 対象API名
     * @return 検証済みのレコード抽出条件
     */
    public String getRecordFilter(String objectName) {
        // 無効な組織では存在しない項目をクエリへ含めない
        Boolean excludePersonContacts =
            objectName == 'Contact' &&
            Contact.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED)
                .fields.getMap()
                .containsKey('IsPersonAccount');
        return excludePersonContacts ? 'IsDeleted = false AND IsPersonAccount = false' : 'IsDeleted = false';
    }

    /**
     * DML結果を一度だけ走査して部分失敗を集計
     * @param current 現在の集計値
     * @param results スコープの削除結果
     * @return 更新後の集計値
     */
    public TestDataDeleteBatchWrapper aggregateResults(
        TestDataDeleteBatchWrapper current,
        List<Database.DeleteResult> results
    ) {
        // バッチに保持された値を直接変更しない
        TestDataDeleteBatchWrapper wrapper = new TestDataDeleteBatchWrapper(current);
        for (Database.DeleteResult result : results) {
            // 同じレコードに複数のエラーがあっても失敗件数は一件
            if (result.isSuccess()) {
                wrapper.successCount++;
            } else {
                wrapper.failureCount++;
                for (Database.Error error : result.getErrors()) {
                    // 個人情報を含み得るDMLメッセージとレコードIDは公開しない
                    String code = String.valueOf(error.getStatusCode());
                    if (wrapper.errorCodes.size() < 10 && !wrapper.errorCodes.contains(code)) {
                        wrapper.errorCodes.add(code);
                    }
                }
            }
        }
        return wrapper;
    }

    /**
     * 未処理例外・部分失敗・残存を確認し次の親へ進むか判定
     * @param current 現在の集計値
     * @param jobs 現在の標準ジョブ
     * @param remaining 対象の残件数
     * @return 停止理由または空文字
     */
    public String getStopReason(TestDataDeleteBatchWrapper current, List<AsyncApexJob> jobs, Integer remaining) {
        // 権限喪失や開始拒否は後続処理へ引き継がない
        if (String.isNotEmpty(current.errorMessage)) {
            return current.errorMessage;
        }
        // Statefulに残らないスコープ例外も標準ジョブで検知
        if (jobs.isEmpty() || jobs[0].NumberOfErrors > 0) {
            return '未処理のバッチエラーがあるため後続の削除を停止しました。';
        }
        // 部分成功を全件成功として扱わない
        if (current.failureCount > 0) {
            return '削除失敗: ' + current.failureCount + '件。' + String.join(current.errorCodes, ',');
        }
        // 実行中に追加されたデータも残存として検知
        if (remaining != 0) {
            return '対象レコードが残っているため後続の削除を停止しました。';
        }
        return '';
    }

    /**
     * 一つ先のオブジェクト用にスコープ集計を初期化
     * @param current 完了したオブジェクトの集計値
     * @return 次のオブジェクトの集計値
     */
    public TestDataDeleteBatchWrapper createNext(TestDataDeleteBatchWrapper current) {
        // 計画と位置だけを引き継ぎオブジェクトごとの結果を分離
        TestDataDeleteBatchWrapper wrapper = new TestDataDeleteBatchWrapper();
        wrapper.position = current.position + 1;
        return wrapper;
    }
}
