/**
 * 取引先削除の実行条件判定、件数集計、実行者への通知を行う
 */
public with sharing class AccountDeleteBatchService {

    private final Integer detailLimit;

    /** 通常の削除結果で表示する詳細件数を固定 */
    public AccountDeleteBatchService() {
        // 公開入口では既存の200件を維持
        this.detailLimit = 200;
    }

    /** 少量の失敗レコードで詳細上限の境界を確認する内部生成
     * @param detailLimit 正の詳細表示上限
     */
    @TestVisible
    private AccountDeleteBatchService(Integer detailLimit) {
        // 実行データとは分離して生成時に上限を固定
        this.detailLimit = detailLimit;
    }

    /**
     * 現在の実行条件から開始拒否理由を取得
     * @return 実行可能なら空文字、それ以外は公開可能な理由
     */
    public String getBlockMessage() {
        // 公開入口では必ず実際の組織環境と実行ユーザーの権限を取得
        Boolean developmentEnvironment = OrgEnvironment.isDevelopmentEnvironment();
        // 専用機能の利用権限を取得
        Boolean canUseFeature = FeatureManagement.checkPermission('RunAccountDelete');
        // 取引先オブジェクトの権限定義を取得
        Schema.DescribeSObjectResult accountDescribe = Account.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED);
        // 参照と削除の両方が許可されているか確認
        Boolean canReadAndDelete = accountDescribe.isAccessible() && accountDescribe.isDeletable();
        // 共通判定から優先される拒否理由を返す
        return getBlockMessageForConditions(developmentEnvironment, canUseFeature, canReadAndDelete);
    }

    /** 環境と権限の判定値から優先順位に従って拒否理由を決定
     * 組織やユーザーの設定を変更せず各拒否条件をテストできるよう公開
     * @param developmentEnvironment 開発環境ならtrue、falseまたはnullの場合は実行不可
     * @param canUseFeature 機能利用のカスタム権限があるか
     * @param canReadAndDelete 取引先の参照・削除権限の両方があるか
     * @return 実行可能なら空文字、それ以外は公開可能な拒否理由
     */
    @TestVisible
    private String getBlockMessageForConditions(Boolean developmentEnvironment, Boolean canUseFeature, Boolean canReadAndDelete) {
        // 本番と判定不能な組織で削除を拒否
        if (developmentEnvironment != true) {
            // 環境判定に失敗しても許可側へ倒さない
            return 'Scratch Org・Developer Edition・Sandboxでのみ実行できます。';
        }
        // 専用の利用許可と既存のAccount権限を別々に適用
        if (canUseFeature != true) {
            // 画面経由以外でも機能利用権限を必須にする
            return '取引先一括削除の利用権限がありません。';
        }
        // オブジェクトの参照権限と削除権限を事前確認
        if (canReadAndDelete != true) {
            // 共有レコードの削除可否は後続のユーザーモードDMLで判定
            return '取引先の参照・削除権限が必要です。';
        }
        // 許可済みの要求だけを開始処理へ渡す
        return '';
    }

    /**
     * 対象取得前の実行条件を判定
     * @param current これまでの集計結果
     * @return 開始可否と拒否理由を設定した新しいWrapper
     */
    public AccountDeleteBatchWrapper checkStartConditions(AccountDeleteBatchWrapper current) {
        // 開始時の実環境と権限による判定結果を反映
        return applyStartConditions(current, getBlockMessage());
    }

    /** 開始判定の結果を反映し、既存の集計値を保持
     * 拒否時の状態保持を組織環境に依存せずテストできるよう公開
     * @param current これまでの集計結果
     * @param blockMessage 実行可能なら空文字、それ以外は拒否理由
     * @return 開始可否と拒否理由を設定した新しいWrapper
     */
    @TestVisible
    private AccountDeleteBatchWrapper applyStartConditions(AccountDeleteBatchWrapper current, String blockMessage) {
        // 入力の状態を変更せず実行可否を反映
        AccountDeleteBatchWrapper wrapper = new AccountDeleteBatchWrapper(current);
        // 毎回の判定結果で前回のエラーメッセージを置き換える
        wrapper.errorMessage = blockMessage;
        if (String.isNotEmpty(wrapper.errorMessage)) {
            // 対象取得前のため件数を推測せず拒否理由だけを保持
            wrapper = addFailures(wrapper, 0, 'START_BLOCKED');
        }
        // メインクラスへ開始可否を返す
        return wrapper;
    }

    /**
     * 削除直前の実行条件を判定し、中止時の対象を失敗に加算
     * @param current これまでの集計結果
     * @param accounts 今回の削除対象
     * @return 実行可否と集計結果を設定した新しいWrapper
     */
    public AccountDeleteBatchWrapper checkExecutionConditions(AccountDeleteBatchWrapper current, List<Account> accounts) {
        // 削除直前に実環境と権限を再確認して反映
        return applyExecutionConditions(current, accounts, getBlockMessage());
    }

    /** 実行判定の結果を反映し、拒否時の対象を失敗に集計
     * 拒否時の失敗集計を組織環境に依存せずテストできるよう公開
     * @param current これまでの集計結果
     * @param accounts 今回の削除対象
     * @param blockMessage 実行可能なら空文字、それ以外は拒否理由
     * @return 実行可否と集計結果を設定した新しいWrapper
     */
    @TestVisible
    private AccountDeleteBatchWrapper applyExecutionConditions(AccountDeleteBatchWrapper current, List<Account> accounts, String blockMessage) {
        // 入力の状態を変更せず実行可否を反映
        AccountDeleteBatchWrapper wrapper = new AccountDeleteBatchWrapper(current);
        // 前のスコープの判定に依存せず今回の判定結果で置き換える
        wrapper.errorMessage = blockMessage;
        if (String.isNotEmpty(wrapper.errorMessage)) {
            // 今回の対象を削除できないため全件を失敗に加算
            wrapper.failureCount += accounts.size();
            for (Account account : accounts) {
                if (wrapper.recordErrors.size() < this.detailLimit) {
                    wrapper.recordErrors.put(account.Id, buildRecordError(
                        account.Name, new Set<String>{ 'EXECUTION_BLOCKED' }, new List<String>{ wrapper.errorMessage }
                    ));
                }
            }
        }
        // メインクラスへ実行可否と集計値を返す
        return wrapper;
    }

    /**
     * 削除結果をレコード単位で累積集計
     * @param results メイン処理で実行したDMLの結果
     * @param accounts DMLへ渡した削除対象（結果と同じ順序）
     * @param current これまでの集計結果
     * @return 今回の結果を加算した新しい集計結果
     */
    public AccountDeleteBatchWrapper aggregateDeleteResults(List<Database.DeleteResult> results, List<Account> accounts, AccountDeleteBatchWrapper current) {
        AccountDeleteBatchWrapper wrapper = new AccountDeleteBatchWrapper(current);
        // DeleteResultのIDが空でも、DMLへ渡した同じ位置のレコードを識別する
        for (Integer index = 0; index < results.size(); index++) {
            Database.DeleteResult result = results[index];
            Boolean succeeded = result.isSuccess();
            if (succeeded) {
                wrapper.successCount++;
            } else {
                wrapper.failureCount++;
                if (wrapper.recordErrors.size() < this.detailLimit) {
                    List<String> messages = new List<String>();
                    Set<String> codes = new Set<String>();
                    for (Database.Error error : result.getErrors()) {
                        codes.add(String.valueOf(error.getStatusCode()));
                        messages.add(error.getMessage());
                    }
                    wrapper.recordErrors.put(accounts[index].Id, buildRecordError(accounts[index].Name, codes, messages));
                }
            }
        }
        return wrapper;
    }

    /**
     * レコード名とコードを分離し、削除理由を箇条書きに整形
     * @param accountName 削除対象の取引先名
     * @param codes Salesforceのエラーコード
     * @param messages Salesforceのエラーメッセージ
     * @return 取引先名、コード、文字数を制限した理由
     */
    public String buildRecordError(String accountName, Set<String> codes, List<String> messages) {
        // 名前は一度だけ表示し、理由に繰り返される定型の前置きを除去
        String prefix = '削除を試みた' + accountName + 'は、';
        List<String> reasons = new List<String>();
        for (String message : messages) {
            // 一つのエラーメッセージに複数の関連先が含まれる場合も行ごとに表示
            for (String line : message.replace('\r\n', '\n').split('\n')) {
                String reason = line.startsWith(prefix) ? line.substring(prefix.length()) : line;
                if (String.isNotBlank(reason)) {
                    reasons.add('・' + reason);
                }
            }
        }
        // コードは重複を除いた安定した順序で表示
        List<String> sortedCodes = new List<String>(codes);
        sortedCodes.sort();
        String reasonText = String.join(reasons, '\n');
        return '取引先名: ' + accountName + '\nエラーコード: ' + String.join(sortedCodes, ', ') +
            '\n理由:\n' + reasonText.abbreviate(1000);
    }

    /**
     * 削除を実行できなかった対象を失敗件数へ加算
     * @param current これまでの集計結果
     * @param failureCount 削除を実行できなかった対象件数
     * @param code 公開可能な固定理由コード
     * @return 失敗件数と理由を反映した新しい集計結果
     */
    public AccountDeleteBatchWrapper addFailures(AccountDeleteBatchWrapper current, Integer failureCount, String code) {
        // 呼び出し元の状態を変更せず更新後の値を用意
        AccountDeleteBatchWrapper wrapper = new AccountDeleteBatchWrapper(current);
        // 対象件数が分かる処理中止を失敗件数へ含める
        wrapper.failureCount += failureCount;
        String message = wrapper.errorMessage;
        if (code == 'JOB_NOT_FULLY_PROCESSED') {
            message = 'バッチ処理中に未処理例外が発生しました。詳細は設定のApexジョブを確認してください。';
        }
        wrapper.failureReasons = collectFailureReason(wrapper.failureReasons, code, message);
        // 更新後の集計結果を呼び出し元へ返す
        return wrapper;
    }

    /**
     * finish時点で確定したexecute結果を通知
     * @param jobs 検索したバッチジョブ、nullまたは空の場合は通知不可
     * @param wrapper バッチが保持する集計結果
     * @return ジョブが取得でき、メール送信が受け付けられた場合true
     */
    public Boolean finishRun(List<AsyncApexJob> jobs, AccountDeleteBatchWrapper wrapper) {
        // ジョブ情報がない場合は先頭要素を参照せず通知不可を返す
        if (jobs?.isEmpty() != false) {
            return false;
        }
        // 検索結果が存在することを確認して通知対象を取得
        AsyncApexJob job = jobs[0];
        // Batchから渡された集計値とジョブ情報から通知を生成
        String body = buildBody(job, wrapper);
        // 送信結果を返し、失敗時の扱いはバッチの入口で決定
        return sendMessage('取引先一括削除の処理結果', body);
    }

    /**
     * Account単位の確定件数からメール本文を生成
     * @param job 現在のバッチジョブ
     * @param current バッチが保持する集計結果
     * @return 件数、失敗理由、実行条件を含む通知本文
     */
    public String buildBody(AsyncApexJob job, AccountDeleteBatchWrapper current) {
        // 通知用の追加情報でバッチの状態を変更しない
        AccountDeleteBatchWrapper wrapper = new AccountDeleteBatchWrapper(current);
        // finish中のProcessingを失敗扱いせず、未処理例外を確認
        if (job.NumberOfErrors > 0) {
            // 失敗したスコープのレコード件数は推測しない
            wrapper = addFailures(wrapper, 0, 'JOB_NOT_FULLY_PROCESSED');
        }
        List<Id> recordIds = new List<Id>(wrapper.recordErrors.keySet());
        recordIds.sort();
        List<String> details = new List<String>();
        for (Id recordId : recordIds) {
            details.add('取引先ID: ' + recordId + '\n' + wrapper.recordErrors.get(recordId));
        }
        List<String> reasons = new List<String>(wrapper.failureReasons);
        reasons.sort();
        details.addAll(reasons);
        String errorText = details.isEmpty() ? 'なし' : String.join(details, '\n\n');
        String displayCount = '失敗レコードの詳細表示件数: ' + recordIds.size() + ' / ' + wrapper.failureCount + '件（最大' + this.detailLimit + '件）';
        if (wrapper.failureCount > recordIds.size()) {
            displayCount += '\n表示していない失敗レコードがあります。';
        }
        return '【集計結果】\n削除成功件数（確定済み）: ' + wrapper.successCount +
            '\n削除失敗件数（確定済み）: ' + wrapper.failureCount +
            '\nジョブID: ' + job.Id +
            '\n件数は個人取引先を含むAccount単位です。連動削除された関連レコードは含みません。' +
            '\n\n【実行条件】' +
            '\n・実行可能な環境: Scratch Org・Developer Edition・Sandbox' +
            '\n・必要な権限: 取引先一括削除の利用権限、および取引先の参照・削除権限' +
            '\n・削除対象: バッチ開始時に実行ユーザーが参照できる取引先全件（法人・個人取引先を含む）' +
            '\n・削除時の権限: 実行ユーザーのレコード削除権限を適用' +
            '\n・削除方式: 通常削除（ごみ箱の完全削除は行わない）' +
            '\n\n【エラー詳細】\n' + displayCount + '\n\n' + errorText;
    }

    /**
     * 定期起動の拒否を実行者へ通知
     * @param reason 公開可能な拒否理由
     * @return メール送信が受け付けられた場合true
     */
    public Boolean sendRejection(String reason) {
        // 定期起動の入口へ送信受付結果を返す
        return sendMessage('取引先一括削除を開始できませんでした', reason);
    }

    /**
     * 通知用の失敗理由を重複させずに収集
     * @param current これまでの失敗理由
     * @param code エラーコード
     * @param message Salesforceの削除エラーまたは実行拒否理由
     * @return メッセージの文字数を制限した新しい失敗理由のSet
     */
    private Set<String> collectFailureReason(Set<String> current, String code, String message) {
        Set<String> reasons = current.clone();
        String detail = String.isBlank(message) ? '詳細な失敗理由を取得できませんでした。' : message.abbreviate(1000);
        reasons.add(code + ': ' + detail);
        return reasons;
    }

    private Boolean sendMessage(String subject, String body) {
        Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
        mail.setTargetObjectId(UserInfo.getUserId());
        mail.setSaveAsActivity(false);
        mail.setUseSignature(false);
        mail.setSubject(subject);
        mail.setPlainTextBody(body);
        // 想定外の送信例外は捕捉・変換せず呼び出し元へ伝播
        return Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{ mail }, false)[0].isSuccess();
    }
}