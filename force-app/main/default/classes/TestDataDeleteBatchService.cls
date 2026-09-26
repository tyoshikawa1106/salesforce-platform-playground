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
        // 組織区分に対応する条件だけを評価し、通常Sandboxを拒否
        Boolean allowed = organization.IsSandbox == true
            ? organization.TrialExpirationDate != null && organization.TrialExpirationDate > System.now()
            : organization.IsSandbox == false && organization.OrganizationType == 'Developer Edition';
        return allowed
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
        wrapper.errorMessage = getObjectError(objectName);
        return wrapper;
    }

    /** オブジェクトの機能状態と必要な実効権限を確認
     * @param objectName 検証済みの対象名
     * @return 停止理由または空文字
     */
    private String getObjectError(String objectName) {
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
     * 直接削除するレコードと親の連動削除へ委ねるレコードを区別
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

    /** 現在の段階に対応するレコード抽出条件を構成
     * @param current 検証済みの計画と価格削除段階
     * @return カスタム価格から標準価格への順序を守る条件
     */
    public String getStageRecordFilter(TestDataDeleteBatchWrapper current) {
        // 固定の削除計画から現在の対象を確定
        String objectName = current.objectNames[current.position];
        // 個人取引先のContactは親削除へ委ねる
        String filter = getRecordFilter(objectName);
        // 標準価格の連動削除が未処理のカスタム価格へ作用しないよう分離
        if (objectName == 'PricebookEntry') {
            // 参照先が欠けたエントリも必ずカスタム側の段階で削除を試行
            String operator = current.standardPricePhase ? ' IN ' : ' NOT IN ';
            // 全エントリを標準価格とそれ以外へ漏れなく分割
            return filter + ' AND Pricebook2Id' + operator + '(SELECT Id FROM Pricebook2 WHERE IsStandard = true)';
        }
        // 価格以外はオブジェクト単位の条件を維持
        return filter;
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
                wrapper.totalSuccessCount++;
            } else {
                wrapper.failureCount++;
                wrapper.totalFailureCount++;
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
     * 次の削除段階用にスコープ集計を初期化
     * @param current 完了したオブジェクトの集計値
     * @return 次の段階の集計値
     */
    public TestDataDeleteBatchWrapper createNext(TestDataDeleteBatchWrapper current) {
        // 計画と位置だけを引き継ぎオブジェクトごとの結果を分離
        TestDataDeleteBatchWrapper wrapper = new TestDataDeleteBatchWrapper();
        // 全体の通知用件数は段階をまたいで保持
        wrapper.totalSuccessCount = current.totalSuccessCount;
        wrapper.totalFailureCount = current.totalFailureCount;
        // カスタム価格を全件削除した後に同じオブジェクトの標準価格を処理
        if (current.objectNames[current.position] == 'PricebookEntry' && !current.standardPricePhase) {
            wrapper.position = current.position;
            wrapper.standardPricePhase = true;
        } else {
            // 標準価格の完了後に商品へ進む
            wrapper.position = current.position + 1;
        }
        return wrapper;
    }

    /** 全体の終了結果を実行ユーザー宛てのメールへ変換
     * @param current 終了した段階と累計件数
     * @param outcome 完了または途中停止
     * @param detail 終了結果の説明
     * @return 送信前の結果メール
     */
    public Messaging.SingleEmailMessage buildResultMail(
        TestDataDeleteBatchWrapper current,
        String outcome,
        String detail
    ) {
        // レコードの内容や内部例外を含めず安全な集計値だけを通知
        String body =
            '削除成功（直接削除）: ' +
            current.totalSuccessCount +
            '件' +
            '\n削除失敗（DML結果）: ' +
            current.totalFailureCount +
            '件' +
            '\n連動削除された件数と未処理スコープの件数は、この集計に含みません。';
        body += '\n結果詳細: ' + detail;
        // 後続バッチも開始したユーザーのコンテキストで実行される
        Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
        mail.setTargetObjectId(UserInfo.getUserId());
        mail.setSaveAsActivity(false);
        mail.setUseSignature(false);
        mail.setSubject('テストデータ一括削除: ' + outcome);
        mail.setPlainTextBody(body);
        return mail;
    }
}