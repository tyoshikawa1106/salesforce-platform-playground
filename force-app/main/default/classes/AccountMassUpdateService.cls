/** 法人取引先一括更新の入力検証と応答生成 */
public with sharing class AccountMassUpdateService {

    // 保存要求とページ表示で共用する不変の件数上限
    private final Integer recordLimit;

    /** 通常の一括更新上限を設定 */
    public AccountMassUpdateService() {
        // 公開入口の保存・表示上限を維持
        this.recordLimit = 200;
    }

    /** 少量データで保存と表示の境界を確認する内部生成
     * @param recordLimit 正の保存・表示上限
     */
    @TestVisible
    private AccountMassUpdateService(Integer recordLimit) {
        // 本番と同じ判定をインスタンスごとの固定上限で実行
        this.recordLimit = recordLimit;
    }

    /**
     * 検索条件と利用権限を確認
     * @param request 名前・作成日・ページ境界を持つ検索条件
     * @return 正規化済み条件または拒否理由
     */
    public AccountMassUpdateWrapper prepareSearch(AccountMassUpdateWrapper request) {
        // 公開入口は現在ユーザーの実権限から判定を作成
        Boolean canRead = Account.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).isAccessible();
        // 判定済みの権限と要求を同じ検証へ渡す
        return prepareSearchWithAccess(request, canRead);
    }

    /** 取得済み権限から要求を検証し、拒否をテスト可能にする
     * @param request 検索要求
     * @param canRead 取引先の参照可否
     * @return 検証結果
     */
    @TestVisible
    private AccountMassUpdateWrapper prepareSearchWithAccess(AccountMassUpdateWrapper request, Boolean canRead) {
        // 引数を変更せず新しい応答に権限情報を設定
        AccountMassUpdateWrapper wrapper = createAccess(canRead);
        // 権限不足では入力に関係なく検索を拒否
        if (String.isNotEmpty(wrapper.errorMessage)) {
            // 判定結果を呼び出し元へ返却
            return wrapper;
        }
        // 未指定の条件は空検索として扱う
        AccountMassUpdateWrapper input = request ?? new AccountMassUpdateWrapper();
        // 日付の逆転と不完全なページ境界を拒否
        Boolean reversed = input.endDate != null && input.startDate?.daysBetween(input.endDate) < 0;
        // 不完全なページ境界も日付不正と同じ案内で拒否
        if (reversed || ((input.afterCreated == null) != (input.afterId == null))) {
            wrapper.errorMessage = '検索条件が不正です。開始日・終了日とページを確認してください。';
            // 判定結果を呼び出し元へ返却
            return wrapper;
        }
        // 空白だけの入力を検索なしに正規化
        wrapper.searchTerm = input.searchTerm?.trim() ?? '';
        // 利用者のタイムゾーンで日付境界を生成
        wrapper.startAt = input.startDate == null
            ? null
            : Datetime.newInstance(input.startDate, Time.newInstance(0, 0, 0, 0));
        // 翌日未満で終了日全体を含める
        wrapper.endBefore = input.endDate == null
            ? null
            : Datetime.newInstance(input.endDate.addDays(1), Time.newInstance(0, 0, 0, 0));
        // ページ境界を検索条件に保持
        wrapper.afterCreated = input.afterCreated;
        // 同一日時の境界を識別するIDを保持
        wrapper.afterId = input.afterId;
        // 判定結果を呼び出し元へ返却
        return wrapper;
    }

    /**
     * 取得結果を200件の画面応答に変換
     * @param records 追加一行を含む検索結果
     * @param editableFields 編集可能な項目
     * @return 表示行と次ページ有無
     */
    public AccountMassUpdateWrapper createPage(List<Account> records, List<String> editableFields) {
        // 入力のレコード一覧を変更せず応答を生成
        AccountMassUpdateWrapper wrapper = new AccountMassUpdateWrapper();
        // 後続行の存在を追加一行から判定
        wrapper.hasNext = records.size() > this.recordLimit;
        // 権限情報を画面へ返却
        wrapper.editableFields.addAll(editableFields);
        // 表示上限以内の行だけを返す
        for (Integer position = 0; position < Math.min(this.recordLimit, records.size()); position++) {
            // 画面で表示可能な行だけを追加
            wrapper.records.add(records[position]);
        }
        // 判定結果を呼び出し元へ返却
        return wrapper;
    }

    /**
     * 保存要求の件数と項目を検証
     * @param changes 変更項目だけを含む取引先
     * @param versions 画面で取得した最終更新日時
     * @return 対象IDと拒否理由
     */
    public AccountMassUpdateWrapper prepareSave(List<Account> changes, Map<Id, Datetime> versions) {
        // 公開入口は現在ユーザーの実権限から判定を作成
        Boolean canRead = Account.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).isAccessible();
        // 判定済みの権限と要求を同じ検証へ渡す
        return prepareSaveWithAccess(changes, versions, canRead);
    }

    /** 取得済み権限から要求を検証し、拒否をテスト可能にする
     * @param changes 更新要求
     * @param versions 更新前の日時
     * @param canRead 取引先の参照可否
     * @return 検証結果
     */
    @TestVisible
    private AccountMassUpdateWrapper prepareSaveWithAccess(List<Account> changes, Map<Id, Datetime> versions, Boolean canRead) {
        // 引数を変更せず新しい応答に権限情報を設定
        AccountMassUpdateWrapper wrapper = createAccess(canRead);
        // 権限不足ではレコード取得も行わない
        if (String.isNotEmpty(wrapper.errorMessage)) {
            // 判定結果を呼び出し元へ返却
            return wrapper;
        }
        // オブジェクト更新権限と保存件数を検証
        if (
            !Account.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).isUpdateable() ||
            changes?.isEmpty() != false ||
            changes.size() > this.recordLimit ||
            versions == null
        ) {
            wrapper.errorMessage = '更新権限を確認し、1〜' + this.recordLimit + '件の変更を指定してください。';
            // 判定結果を呼び出し元へ返却
            return wrapper;
        }
        // 各行の項目・ID・更新前バージョンを検証
        for (Account change : changes) {
            // 行検証で許可項目と重複を一緒に確認
            String errorMessage = validateChange(change, versions, wrapper);
            // 最初の不正行で要求全体を拒否
            if (String.isNotEmpty(errorMessage)) {
                wrapper.errorMessage = errorMessage;
                // 判定結果を呼び出し元へ返却
                return wrapper;
            }
            // 検証済みのIDだけを問い合わせに使用
            wrapper.recordIds.add(change.Id);
        }
        // 判定結果を呼び出し元へ返却
        return wrapper;
    }

    /**
     * ロックした現在値と照合し変更項目だけを組み立て
     * @param changes 要求された変更値
     * @param versions 読取時点の最終更新日時
     * @param currentRecords 利用者権限でロックした法人取引先
     * @return DML対象と行単位の拒否理由
     */
    public AccountMassUpdateWrapper buildUpdates(
        List<Account> changes,
        Map<Id, Datetime> versions,
        List<Account> currentRecords
    ) {
        // 元の要求を変更せず判定結果を構成
        AccountMassUpdateWrapper wrapper = new AccountMassUpdateWrapper();
        // 取得できない行と同時変更を区別して判定
        Map<Id, Account> currentMap = new Map<Id, Account>(currentRecords);
        // 各要求は検証済みで最大200件
        for (Account change : changes) {
            // アクセス不能・削除・個人取引先を共通の案内で拒否
            if (!currentMap.containsKey(change.Id)) {
                wrapper.errors.put(
                    change.Id,
                    '対象を更新できません。アクセス権と法人取引先であることを確認してください。'
                );
                // 拒否した行をDMLへ渡さず次の要求へ進む
                continue;
            }
            // 他の利用者による変更を上書きしない
            Account current = currentMap.get(change.Id);
            // ロック後の日時で競合を検出
            if (current.LastModifiedDate != versions.get(change.Id)) {
                wrapper.errors.put(change.Id, '検索後に変更されています。再検索して内容を確認してください。');
                // 拒否した行をDMLへ渡さず次の要求へ進む
                continue;
            }
            // JSON由来のレコード全体を直接DMLへ渡さない
            Account updateRecord = new Account(Id = change.Id);
            // 許可済みで実際に指定された項目だけを転記
            Map<String, Object> fields = change.getPopulatedFieldsAsMap();
            // 空欄へのクリアも変更値として保持
            for (String fieldName : fields.keySet()) {
                // 同じ値は不要な更新の対象にしない
                if (fieldName != 'Id' && fields.get(fieldName) != current.get(fieldName)) {
                    updateRecord.put(fieldName, fields.get(fieldName));
                }
            }
            // 差分がない行ではトリガーを再実行しない
            if (updateRecord.getPopulatedFieldsAsMap().size() > 1) {
                wrapper.records.add(updateRecord);
            } else {
                wrapper.successIds.add(change.Id);
            }
        }
        // 判定結果を呼び出し元へ返却
        return wrapper;
    }

    /**
     * 部分成功DMLの結果を一回の走査で集計
     * @param prepared 更新対象と事前判定結果
     * @param results DMLの行単位結果
     * @return 保存済みIDと行単位エラー
     */
    public AccountMassUpdateWrapper createSaveResult(
        AccountMassUpdateWrapper prepared,
        List<Database.SaveResult> results
    ) {
        // 引数を変更せず結果を生成
        AccountMassUpdateWrapper wrapper = new AccountMassUpdateWrapper();
        // DML前に判定済みの行を保持
        wrapper.errors.putAll(prepared.errors);
        // 変更不要と判定済みの行を完了結果へ引継ぎ
        wrapper.successIds.addAll(prepared.successIds);
        // DML結果の順序を更新対象の順序へ対応
        for (Integer position = 0; position < results.size(); position++) {
            // 対象行IDを要求から特定
            Id recordId = prepared.records[position].Id;
            // 成功行を失敗行の再送対象から除外
            if (results[position].isSuccess()) {
                // 保存済み行を再送対象から除外
                wrapper.successIds.add(recordId);
            } else {
                // 内部情報を公開せずエラー種別を案内
                List<Database.Error> errors = results[position].getErrors();
                wrapper.errors.put(
                    recordId,
                    '保存できませんでした（' +
                        String.valueOf(errors[0].getStatusCode()) +
                        '）。入力値、入力規則、所有者変更権限を確認してください。'
                );
            }
        }
        // 判定結果を呼び出し元へ返却
        return wrapper;
    }

    /** 参照可否を引数で検証し、現在ユーザーの編集可能項目を取得
     * @param canRead 取引先の参照可否
     * @return 権限情報または拒否理由
     */
    @TestVisible
    private AccountMassUpdateWrapper createAccess(Boolean canRead) {
        // 画面に必要なすべての項目を参照できる場合だけ検索
        AccountMassUpdateWrapper wrapper = new AccountMassUpdateWrapper();
        // 個人取引先未有効組織でも動作するよう項目の存在を確認
        Map<String, Schema.SObjectField> fieldMap = Account.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED)
            .fields.getMap();
        // 個人取引先の除外条件を生成できるか保持
        wrapper.personAccountsEnabled = fieldMap.containsKey('IsPersonAccount');
        // レコードタイプ機能がない組織でも検索できるようにする
        wrapper.recordTypesEnabled = fieldMap.containsKey('RecordTypeId');
        // 更新候補は合意した四項目に限定
        Set<String> updateFields = new Set<String>{ 'OwnerId', 'Industry', 'Type', 'Rating' };
        // オブジェクト参照権限を確認
        if (canRead != true) {
            wrapper.errorMessage = '取引先の参照権限がありません。';
            // 判定結果を呼び出し元へ返却
            return wrapper;
        }
        // 編集候補の権限を表示へ反映し、読取権限はUSER_MODE検索で強制
        for (String fieldName : updateFields) {
            // 利用者が更新できる項目だけを有効化
            if (fieldMap.get(fieldName).getDescribe().isUpdateable()) {
                // 更新権限のある項目だけを公開
                wrapper.editableFields.add(fieldName);
            }
        }
        // 判定結果を呼び出し元へ返却
        return wrapper;
    }

    private String validateChange(Account change, Map<Id, Datetime> versions, AccountMassUpdateWrapper wrapper) {
        // nullレコードと更新前バージョン欠落を拒否
        if (versions.get(change?.Id) == null) {
            return '更新対象または更新前の情報が不正です。再検索してください。';
        }
        // 同じレコードを二回DMLへ渡さない
        if (wrapper.recordIds.contains(change.Id)) {
            return '更新対象が重複しています。';
        }
        // ID以外の入力が許可項目だけで構成されることを確認
        Set<String> suppliedFields = change.getPopulatedFieldsAsMap().keySet();
        // 更新値ではない識別子を検証対象から除外
        suppliedFields.remove('Id');
        // 一覧の項目以外を更新する要求を拒否
        Set<String> allowedFields = new Set<String>(wrapper.editableFields);
        return allowedFields.containsAll(suppliedFields) ? '' : '更新できない項目が含まれています。';
    }
}
