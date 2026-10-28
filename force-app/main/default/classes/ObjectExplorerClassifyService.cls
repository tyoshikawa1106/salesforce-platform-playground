/** 分類編集の権限・入力・競合と表示モデルの生成 */
public with sharing class ObjectExplorerClassifyService {

    private ObjectExplorerAccessPolicy access = new ObjectExplorerAccessPolicy();

    /**
     * 分類属性だけを編集用の基準値へ抽出
     * @param metadata APIから取得した最新定義
     * @return 5属性の基準値
     */
    public Map<String, Object> snapshot(Map<String, Object> metadata) {
        Map<String, Object> result = new Map<String, Object>();
        for (String key : new List<String>{'complianceGroup', 'securityClassification', 'businessStatus', 'businessOwnerUser', 'businessOwnerGroup'}) {
            // 未設定だけを空文字へ揃え、取得済みの値は保持
            result.put(key, metadata.get(key) ?? '');
        }
        String compliance = (String)result.get('complianceGroup');
        if (String.isNotBlank(compliance)) {
            List<String> values = new List<String>(new Set<String>(compliance.split(';')));
            values.sort();
            result.put('complianceGroup', String.join(values, ';'));
        }
        return result;
    }

    /**
     * 許可した分類属性だけを編集要求で受け付ける
     * @param original 編集開始時の分類
     * @param draft 編集後の分類
     * @param allowed 許可する分類属性
     */
    private void validateEditValues(Map<String, Object> original, Map<String, Object> draft, Set<String> allowed) {
        // nullを含む入力の欠落と許可外属性を同じ契約で拒否
        if (original?.keySet() != allowed || draft?.keySet() != allowed) {
            throw ObjectExplorerAccessPolicy.createException('分類の編集内容が不正です。');
        }
    }

    /**
     * 最新分類との競合を確認して変更属性だけを合成
     * @param current APIから取得した最新定義
     * @param original 編集を始めた時点の5属性
     * @param draft 編集した5属性
     * @return 分類以外を変更しない更新定義
     */
    public Map<String, Object> prepareUpdate(Map<String, Object> current, Map<String, Object> original, Map<String, Object> draft) {
        Map<String, Object> baseline = snapshot(current);
        validateEditValues(original, draft, baseline.keySet());
        if (baseline != original) { throw ObjectExplorerAccessPolicy.createException('編集中に分類が変更されました。対象オブジェクトを選び直し、最新状態を確認してください。'); }
        Map<String, Object> options = this.access.createValidationOptions(original);
        Map<String, Object> updated = new Map<String, Object>(current);
        for (String key : baseline.keySet()) {
            String value = (String)draft.get(key);
            if (value == String.valueOf(original.get(key))) { continue; }
            this.access.validateOption(key, value, options);
            updated.put(key, String.isBlank(value) ? null : value);
        }
        if (String.isNotBlank((String)updated.get('businessOwnerUser')) && String.isNotBlank((String)updated.get('businessOwnerGroup'))) {
            throw ObjectExplorerAccessPolicy.createException('データ所有者はユーザーまたはグループのどちらか一方を指定してください。');
        }
        return updated;
    }

    /** 同じ項目の入力・現在値・期待値・確定結果を保持する内部DTO */
    public class FieldContext {
        public String objectName;
        public String fieldName;
        public FieldDefinition definition;
        public Map<String, Object> change;
        public Map<String, Object> metadata;
        public Map<String, Object> original;
        public Map<String, Object> draft;
        public Map<String, Object> expected;
        public String ownerId;
        public String expectedOwnerId;
        public Boolean customField;
        public Boolean sent;
        public Boolean completed;
        public Map<String, Object> result;

        /** 未確定の一項目を空の状態で初期化 */
        public FieldContext() {
            // 対象オブジェクトを保持
            this.objectName = '';
            // 対象項目名を保持
            this.fieldName = '';
            // 編集要求を保持
            this.change = new Map<String, Object>();
            // 送信する定義を保持
            this.metadata = new Map<String, Object>();
            // 保存前の分類を保持
            this.original = new Map<String, Object>();
            // 編集後の分類を保持
            this.draft = new Map<String, Object>();
            // 保存後の期待値を保持
            this.expected = new Map<String, Object>();
            // 最新の所有者IDを保持
            this.ownerId = '';
            // 選択後の所有者IDを保持
            this.expectedOwnerId = '';
            // カスタム項目の通信方式を保持
            this.customField = false;
            // 更新要求の送信状態を保持
            this.sent = false;
            // 項目結果の確定状態を保持
            this.completed = false;
            // 項目別の保存結果を保持
            this.result = new Map<String, Object>();
        }

        /**
         * 入力の状態へ変更を加えず次の処理用の状態を複製
         * @param source 既定値を初期化済みの状態、コレクションの内容は変更しない
         */
        public FieldContext(FieldContext source) {
            // 対象オブジェクトを保持
            this.objectName = source.objectName;
            // 対象項目名を保持
            this.fieldName = source.fieldName;
            // 完全な項目識別情報を保持
            this.definition = source.definition;
            // 編集要求を保持
            this.change = source.change;
            // 送信する定義を保持
            this.metadata = source.metadata;
            // 保存前の分類を保持
            this.original = source.original;
            // 編集後の分類を保持
            this.draft = source.draft;
            // 保存後の期待値を保持
            this.expected = source.expected;
            // 最新の所有者IDを保持
            this.ownerId = source.ownerId;
            // 選択後の所有者IDを保持
            this.expectedOwnerId = source.expectedOwnerId;
            // カスタム項目の通信方式を保持
            this.customField = source.customField;
            // 更新要求の送信状態を保持
            this.sent = source.sent;
            // 項目結果の確定状態を保持
            this.completed = source.completed;
            // 項目別の保存結果を保持
            this.result = source.result;
        }
    }

    /** 同じ項目の最新分類・所有者と編集値を照合して保存定義を生成 */
    public class Preparation {
        private ObjectExplorerClassifyService service = new ObjectExplorerClassifyService();
        private ObjectExplorerOwnerService ownerService = new ObjectExplorerOwnerService();
        private ObjectExplorerAccessPolicy.RequestValidator requests = new ObjectExplorerAccessPolicy.RequestValidator();

        /**
         * 同じ完全IDの最新分類と所有者から照合値を生成
         * @param source 検証済みの対象と入力
         * @param row 最新API応答の一項目
         * @param ownerRecords IDで一括取得した所有者
         * @return 現在の所有者と分類を格納した新しい状態
         */
        private FieldContext readNativeContext(FieldContext source, Map<String, Object> row, Map<Id, SObject> ownerRecords) {
            // API名だけではなく完全なIDまで一致させる
            if (row?.get('DurableId') != source.definition.DurableId || row.get('QualifiedApiName') != source.fieldName) { throw ObjectExplorerAccessPolicy.createException('取得した項目定義が一致しません。'); }
            // 元の状態に読み取り結果を混在させない
            FieldContext context = new FieldContext(source);
            // APIのネイティブ所有者IDを保持
            context.ownerId = (String)row.get('BusinessOwnerId') ?? '';
            // 同じIDの所有者レコードだけを選択
            List<SObject> owners = this.ownerService.selectCachedOwner(context.ownerId, ownerRecords);
            // 不可視または不一致の所有者を拒否
            this.ownerService.validateOwnerReference(context.ownerId, owners);
            // nullだけを未設定値へ正規化
            Map<String, Object> values = new Map<String, Object>{'complianceGroup' => row.get('ComplianceGroup') ?? '',
                'securityClassification' => row.get('SecurityClassification') ?? '', 'businessStatus' => row.get('BusinessStatus') ?? '', 'ownerId' => context.ownerId};
            // 応答の不正な型を空値へ補完しない
            this.requests.validateOwnerDraft(values);
            // 同じ所有者レコードからAPI参照値を確定
            Map<String, Object> metadata = this.ownerService.createMetadataDraft(values, owners);
            // 取得した分類値を比較用に正規化
            context.original = this.service.snapshot(metadata);
            // 入力を変更せず新しい状態を返却
            return context;
        }

        /**
         * 競合と所有者IDを更新前に検証し標準項目の更新定義を生成
         * @param source 検証済みの対象と編集要求
         * @param row 最新の分類と所有者ID
         * @param ownerRecords 現在と編集後の所有者を含む索引
         * @return 検証済みの新しい状態
         */
        public FieldContext prepareField(FieldContext source, Map<String, Object> row, Map<Id, SObject> ownerRecords) {
            // 別項目の分類や所有者を編集基準へ使わない
            FieldContext context = readNativeContext(source, row, ownerRecords);
            // 形式確認済みの基準値と編集値だけを使用
            Map<String, Object> original = (Map<String, Object>)context.change.get('original');
            // 選択後の値を基準値と分離
            Map<String, Object> values = (Map<String, Object>)context.change.get('draft');
            // 所有者はIDの表記だけを正規化して比較
            String originalId = this.requests.normalizeOwnerId((String)original.get('ownerId'));
            // 編集中に変わった所有者を上書きしない
            if (originalId != context.ownerId) { throw ObjectExplorerAccessPolicy.createException('編集中に所有者が変更されました。最新状態を読み直してください。'); }
            // 選択後のIDと同じレコードからAPI参照値を生成
            context.expectedOwnerId = this.requests.normalizeOwnerId((String)values.get('ownerId'));
            // 選択IDと同じ実レコードだけを参照
            List<SObject> owners = this.ownerService.selectCachedOwner(context.expectedOwnerId, ownerRecords);
            // 新規指定できない所有者を更新前に拒否
            this.ownerService.validateSelectedOwner(context.expectedOwnerId, owners, context.ownerId);
            // 選択した実レコードからAPI参照値を生成
            context.draft = this.ownerService.createMetadataDraft(values, owners);
            // 複数選択の並び順を競合と誤判定しない
            Map<String, Object> baseline = this.ownerService.createMetadataDraft(original, this.ownerService.selectCachedOwner(context.ownerId, ownerRecords));
            // 複数選択の順序を比較基準へ正規化
            baseline = this.service.snapshot(baseline);
            // カスタム項目の追加通信より前に競合を拒否
            if (baseline != context.original) { throw ObjectExplorerAccessPolicy.createException('編集中に分類が変更されました。対象オブジェクトを選び直し、最新状態を確認してください。'); }
            // カスタム項目は元の定義を取得した後に合成
            if (context.customField) { return context; }
            // 標準項目は分類以外を送信しない
            Map<String, Object> current = new Map<String, Object>(context.original);
            // 完全名を同じ項目へ固定
            current.put('fullName', context.objectName + '.' + context.fieldName);
            // 確認済みの現在値から新しい更新状態を生成
            return prepareMetadata(context, current);
        }

        /**
         * カスタム項目の完全な定義を同じ対象へ照合して分類だけを変更
         * @param source 所有者と基準値を確認済みの対象
         * @param response 最新定義のAPI応答
         * @return 分類以外を保持した更新状態
         */
        public FieldContext prepareCustomField(FieldContext source, Map<String, Object> response) {
            // パスのIDと定義の完全名の両方を照合
            Map<String, Object> record = requireMetadataRecord(response, source.objectName + '.' + source.fieldName);
            // 分類以外の定義も保持して合成
            Map<String, Object> current = (Map<String, Object>)record.get('Metadata');
            // 二つの要求の間に変わった分類を上書きしない
            Map<String, Object> latest = this.service.snapshot(current);
            // 二段階取得の間に変わった分類を拒否
            if (latest != source.original) { throw ObjectExplorerAccessPolicy.createException('分類の確認中に値が変更されました。最新状態を読み直してください。'); }
            // 確認済みの現在値から新しい更新状態を生成
            return prepareMetadata(source, current);
        }

        /**
         * 基準値と編集値から更新が必要な属性だけを合成
         * @param source 競合確認済みの対象
         * @param current 更新前の最新定義
         * @return 更新要否と照合値を保持した新しい状態
         */
        private FieldContext prepareMetadata(FieldContext source, Map<String, Object> current) {
            // 呼び出し元の状態は変更しない
            FieldContext context = new FieldContext(source);
            // 設定済みの他属性を保持した新しい定義を生成
            context.metadata = this.service.prepareUpdate(current, context.original, context.draft);
            // 保存後確認用の期待値を確定
            context.expected = this.service.snapshot(context.metadata);
            // 入力を変更せず新しい状態を返却
            return context;
        }

        /**
         * 保存後の分類と所有者IDの一致を同じ項目で確認
         * @param source 保存前の基準と期待値を保持した対象
         * @param row 別API要求で取得した保存後の値
         * @param ownerRecords 保存後のIDで取得した所有者
         * @return 再取得値の一致を確認した新しい状態
         */
        public FieldContext verifyField(FieldContext source, Map<String, Object> row, Map<Id, SObject> ownerRecords) {
            // 保存前の値を上書きせず最新値を照合
            FieldContext context = readNativeContext(source, row, ownerRecords);
            // 分類と所有者IDの両方を照合
            if (context.original != context.expected || context.ownerId != context.expectedOwnerId) { throw ObjectExplorerAccessPolicy.createException('更新後の分類または所有者IDが一致しません。'); }
            // 同じ所有者のIDと表示名を組として返却
            List<SObject> owners = this.ownerService.selectCachedOwner(context.ownerId, ownerRecords);
            // 同じIDから作成した候補だけを結果へ保持
            Map<String, String> owner = this.ownerService.createOwnerChoice(owners);
            // 同じ項目の確定結果を生成
            context.result = new Map<String, Object>{'apiName' => context.fieldName, 'success' => true, 'latest' => context.original, 'owner' => owner, 'message' => ''};
            // 後続で上書きしない確定状態へ変更
            context.completed = true;
            // 入力を変更せず新しい状態を返却
            return context;
        }

        /**
         * 取得した単一定義の完全名・型を確認
         * @param response APIの項目定義応答
         * @param fullName 期待する完全名
         * @return 同じ項目と照合済みの定義
         */
        private Map<String, Object> requireMetadataRecord(Map<String, Object> response, String fullName) {
            // 単一のCustomField取得だけを受け付け、別項目やクエリ応答を採用しない
            if (response.get('FullName') != fullName || !(response.get('Metadata') instanceof Map<String, Object>)) { throw ObjectExplorerAccessPolicy.createException('取得した項目定義が一致しません。'); }
            // 完全名を照合した定義だけを返却
            return response;
        }
    }

    /** 項目別の確定結果と未確定結果を入力順で管理 */
    public class SaveResults {

        /**
         * カスタム項目の個別更新が必要な位置を入力順で選択
         * @param contexts 事前検証済みの項目状態
         * @return 未確定かつ変更があるカスタム項目の位置
         */
        public List<Integer> getCustomUpdateIndexes(List<FieldContext> contexts) {
            // 入力と同じ順序で通信対象を選択
            List<Integer> indexes = new List<Integer>();
            // 状態の書き換えを行わず更新要否だけを判定
            for (Integer index = 0; index < contexts.size(); index++) {
                // 確定済み・変更なし・標準項目は個別更新から除外
                FieldContext context = contexts[index];
                // カスタム更新が必要な位置だけを返却
                if (!context.completed && context.original != context.expected && context.customField) {
                    indexes.add(index);
                }
            }
            // 呼び出し元で通信順を組み立てられる位置一覧を返却
            return indexes;
        }

        /**
         * 一括送信する標準項目だけを完全名で選択
         * @param contexts 項目別の検証結果
         * @return 完全名と同じ項目の状態の対応
         */
        public Map<String, FieldContext> selectStandardUpdates(List<FieldContext> contexts) {
            // 検証済みで実際に変更がある標準項目だけを送信
            Map<String, FieldContext> result = new Map<String, FieldContext>();
            // 同じ対象ごとの結果を入力順で処理
            for (FieldContext context : contexts) {
                // 失敗や変更不要の項目は更新しない
                if (!context.completed && context.original != context.expected && !context.customField) { result.put(context.objectName + '.' + context.fieldName, context); }
            }
            // 生成した照合結果を返却
            return result;
        }

        /**
         * 一括更新の個別結果を応答順ではなく完全名で反映
         * @param contexts 保存対象の状態
         * @param results 接続クライアントで対象を照合済みの結果
         * @return 明示的な拒否だけを失敗へ変更した新しい状態
         */
        public List<FieldContext> applyStandardResults(List<FieldContext> contexts, Map<String, String> results) {
            // 元の項目状態は変更しない
            List<FieldContext> updated = new List<FieldContext>();
            // 同じ対象ごとの結果を入力順で処理
            for (FieldContext context : contexts) {
                // 同じ完全名の結果だけを採用
                String message = results.get(context.objectName + '.' + context.fieldName);
                // 明示的な拒否は保存後確認不能と区別
                if (String.isNotBlank(message)) { updated.add(failField(context, new MetadataApiIntegrationClient.RejectedUpdateException(message))); }
                else { updated.add(context); }
            }
            // 確定済みの結果を維持して返却
            return updated;
        }

        /**
         * 成功・失敗が確定していない項目だけを再取得対象へ選択
         * @param contexts 保存対象の状態
         * @return 保存後に確認する項目API名
         */
        public Set<String> getVerificationNames(List<FieldContext> contexts) {
            // 更新拒否済みの項目を成功へ戻さない
            Set<String> names = new Set<String>();
            // 同じ対象ごとの結果を入力順で処理
            for (FieldContext context : contexts) { if (!context.completed) { names.add(context.fieldName); } }
            // 照合済みの項目名集合を返却
            return names;
        }

        /**
         * 制御済みのエラーだけを項目別結果へ変換
         * @param source 対象と更新送信状態
         * @param error 認証値やAPI応答本文を含めないエラー
         * @return 入力を維持した失敗状態
         */
        public FieldContext failField(FieldContext source, Exception error) {
            // 元の照合値や編集値を変更しない
            FieldContext context = new FieldContext(source);
            // 拒否が明示されていない送信後の失敗は不明として案内
            String prefix = context.sent && !(error instanceof MetadataApiIntegrationClient.RejectedUpdateException) ? '更新結果を確認できませんでした。最新状態を再取得してください。' : '';
            // 制御済み業務エラーだけを画面へ返す
            String message = safeMessage(error);
            // 同じ項目の確定結果を生成
            context.result = new Map<String, Object>{'apiName' => context.fieldName, 'success' => false, 'message' => prefix + message};
            // 後続で上書きしない確定状態へ変更
            context.completed = true;
            // 入力を変更せず新しい状態を返却
            return context;
        }

        /**
         * 未確定の対象だけを通信失敗へ変更
         * @param contexts 保存対象の状態
         * @param error 保存中のエラー
         * @return 確定済みの結果を維持した状態
         */
        public List<FieldContext> failPendingFields(List<FieldContext> contexts, Exception error) {
            // 確認済みの成功や個別拒否を失わない
            List<FieldContext> updated = new List<FieldContext>();
            // 同じ対象ごとの結果を入力順で処理
            for (FieldContext context : contexts) { updated.add(context.completed ? context : failField(context, error)); }
            // 確定済みの結果を維持して返却
            return updated;
        }

        /**
         * 項目別の結果を保存要求と同じ順番に組み立て
         * @param contexts 保存処理を終えた項目
         * @return 成功・失敗・再取得値の一覧
         */
        public List<Object> createSaveResults(List<FieldContext> contexts) {
            // 空の結果を成功や失敗に補完しない
            List<Object> results = new List<Object>();
            // 同じ対象ごとの結果を入力順で処理
            for (FieldContext context : contexts) {
                // 保存結果が不明なまま一覧へ返却しない
                if (!context.completed) { throw new MetadataApiIntegrationClient.IntegrationException('保存結果を確認できませんでした。最新状態を再取得してください。'); }
                // 同じ入力順で確定結果を追加
                results.add(context.result);
            }
            // 全項目の確定結果を返却
            return results;
        }

        /**
         * 内部例外を公開せず制御した業務エラーだけを表示
         * @param error 保存中の例外
         * @return 利用者へ返せる固定形式のメッセージ
         */
        private String safeMessage(Exception error) {
            // API応答本文や認証値をエラーへ含めない
            return error instanceof AuraHandledException || error instanceof MetadataApiIntegrationClient.IntegrationException || error instanceof MetadataApiIntegrationClient.RejectedUpdateException ? error.getMessage() : '項目の保存に失敗しました。編集内容と権限を確認してください。';
        }
    }

    /**
     * 項目ごとの状態から一括取得の対象を生成
     * @param contexts 検証済みの保存対象
     * @return 項目API名の集合
     */
    public Set<String> getFieldNames(List<ObjectExplorerClassifyService.FieldContext> contexts) {
        // 検証済みの項目だけを取得要求へ渡す
        Set<String> names = new Set<String>();
        // 同じ対象ごとの結果を入力順で処理
        for (ObjectExplorerClassifyService.FieldContext context : contexts) { names.add(context.fieldName); }
        // 照合済みの項目名集合を返却
        return names;
    }

}
