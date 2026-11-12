/** 外部クライアントアプリ管理の入力・状態検証と公開情報の選別 */
public with sharing class ExternalClientAppManagerService {
    private static final String ROOT = '/services/data/v68.0/apps/oauth/credentials/';

    /** 画面へ公開できる検証エラー */
    public class ValidationException extends Exception {
    }

    /** 実行権限を持たない直接呼び出しを拒否 */
    public void requireAccess() {
        // API管理権限とは別に画面機能の利用を制限
        if (!FeatureManagement.checkPermission('ManageExternalClientAppCredentials')) {
            throw new ValidationException('資格情報の更新権限がありません。');
        }
    }

    /** 公開している操作と必須入力を検証
     * @param input 操作と対象識別子
     */
    public void requireRequest(Map<String, String> input) {
        // 公開していない一括操作を受け付けない
        if (
            input == null ||
            !new Set<String>{ 'list', 'generate', 'apply', 'stages', 'deleteStage' }.contains(input.get('action'))
        ) {
            throw new ValidationException('操作を確認できません。画面を開き直してください。');
        }
        // 適用と削除では画面で確認した状態も照合対象にする
        if (
            new Set<String>{ 'apply', 'deleteStage' }.contains(input.get('action')) &&
            (String.isBlank(input.get('stageId')) ||
            !new Set<String>{ 'active', 'rotated', 'expired' }.contains(input.get('stageState')))
        ) {
            throw new ValidationException('操作対象を確認できません。一覧を再取得してください。');
        }
    }

    /** 所属確認済みの候補と対象名を照合
     * @param applications APIから取得した選択候補
     * @param input 画面で確認したアプリIDとAPI名
     * @return 所属と名前が一致する候補
     */
    public Map<String, Object> requireApplication(List<Object> applications, Map<String, String> input) {
        // APIパスへ任意文字列を含めさせない
        requireId(input.get('appId'), '0xI');
        // 本人が入力したIDも正式な外部クライアントアプリIDとして検証する
        String confirmationId = input.get('confirmationId')?.trim();
        requireId(confirmationId, '0xI');
        // Id型で15桁と18桁を同じ対象として照合する
        if ((Id) confirmationId != (Id) input.get('appId')) {
            throw new ValidationException('選択したアプリと入力したIDが一致しません。IDを確認してください。');
        }
        // クライアントが送った表示名や管理状態は信用しない
        for (Object item : applications) {
            Map<String, Object> row = (Map<String, Object>) item;
            // 一覧と同じ認証元除外・ローカル条件を適用
            if (row.get('id') == input.get('appId') && row.get('name') == input.get('confirmation')) {
                return row;
            }
        }
        // 古い選択や認証元自身への操作を拒否
        throw new ValidationException('更新可能なローカルアプリと対象名を確認できません。一覧を再取得してください。');
    }

    /** 唯一のコンシューマーから固定のステージAPIパスを構築
     * @param appId 所属確認済みのアプリID
     * @param consumers 秘密を除去したコンシューマー一覧
     * @return 外部URLを含まないAPIパス
     */
    public String stagePath(String appId, List<Object> consumers) {
        // アプリとコンシューマーを一意に特定してからパスへ使用
        requireId(appId, '0xI');
        if (consumers.size() != 1) {
            throw new ValidationException('コンシューマーを一意に確認できません。標準設定画面で確認してください。');
        }
        // 返されたURLの有無には依存しない
        String consumerId = (String) ((Map<String, Object>) consumers[0]).get('id');
        requireId(consumerId, '888');
        return ROOT + appId + '/' + consumerId + '/staged';
    }

    private static void requireRows(Map<String, Object> response, String key) {
        // 必須コレクションを返さない応答は確認不能として停止する
        if (response == null || !(response.get(key) instanceof List<Object>)) {
            throw new ValidationException('API応答の一覧を確認できません。一覧を再取得してください。');
        }
    }

    private static void requireId(String value, String prefix) {
        // Salesforce ID以外をパスへ含めない
        if (value == null || !Pattern.matches(prefix + '[a-zA-Z0-9]{12}([a-zA-Z0-9]{3})?', value)) {
            throw new ValidationException('識別子の形式が不正です。');
        }
    }

    /** ステージの生成・適用・削除に必要な状態を検証 */
    public class Stages {
        /** 変更後の一覧と今回の操作結果を照合
         * @param action 実行した変更操作
         * @param rows 再取得した一覧
         * @param stageId 変更対象のステージID
         */
        public void requireOperationResult(String action, List<Object> rows, String stageId) {
            switch on action {
                when 'generate' {
                    if (generatedStageId(rows) != stageId) {
                        throw new ValidationException('生成したステージを確認できません。');
                    }
                }
                when 'apply' {
                    requireRetiredStage(rows, stageId);
                }
                when 'deleteStage' {
                    requireDeleted(rows, stageId);
                }
            }
        }

        /** 新規生成前にすべてのステージが整理済みであることを検証
         * @param rows 現在のステージ一覧
         */
        public void requireEmptyStages(List<Object> rows) {
            // 旧認証を残した再生成による置き換えを防ぐ
            if (!rows.isEmpty()) {
                throw new ValidationException(
                    'ステージに資格情報が残っています。一覧を確認し、手動で削除してから生成してください。'
                );
            }
        }

        /** 生成したステージの一意性と状態を検証
         * @param rows 生成APIの公開応答
         * @return 適用対象のステージID
         */
        public String generatedStageId(List<Object> rows) {
            // 旧資格情報から分離して未適用の生成結果を抽出
            List<Map<String, Object>> activeRows = new List<Map<String, Object>>();
            // 状態を確認して今回の生成候補だけを収集
            for (Object item : rows) {
                // 公開属性だけを対象に判定
                Map<String, Object> row = (Map<String, Object>) item;
                // 適用済みの旧資格情報は候補から除外
                if (String.valueOf(row.get('state')).toLowerCase() == 'active') {
                    activeRows.add(row);
                }
            }
            // 一覧全体ではなく生成候補の一意性を保証
            if (activeRows.size() != 1) {
                throw new ValidationException('生成したステージの状態を一意に確認できません。');
            }
            // APIの識別子をパスへ使用する前に検証
            String stageId = (String) activeRows[0].get('id');
            requireId(stageId, '0ug');
            return stageId;
        }

        /** 適用APIの成功状態を検証
         * @param response 適用APIの応答
         */
        public void requireRotated(Map<String, Object> response) {
            // 新しい資格情報の適用が確認できた場合だけ次工程へ進む
            if (String.valueOf(response.get('state')).toLowerCase() != 'rotated') {
                throw new ValidationException('新しい鍵・秘密の適用を確認できません。');
            }
        }

        /** 適用後の同一ステージが旧資格情報になったことを検証
         * @param rows 適用後に取得したステージ一覧
         * @param stageId 今回生成・適用したステージID
         */
        public void requireRetiredStage(List<Object> rows, String stageId) {
            // 他の旧資格情報が共存していても今回のIDだけを照合
            List<Map<String, Object>> matches = new List<Map<String, Object>>();
            // 対象の欠落と重複を検出
            for (Object item : rows) {
                // 公開属性から同一IDの行を抽出
                Map<String, Object> row = (Map<String, Object>) item;
                // 今回適用した行以外には変更を加えない
                if (row.get('id') == stageId) {
                    matches.add(row);
                }
            }
            // 一件に特定できない結果を成功にしない
            if (matches.size() != 1) {
                throw new ValidationException('適用後のステージが変更され、一意に確認できません。');
            }
            // 同じIDが適用済みになったことを確認
            requireRotated(matches[0]);
        }

        /** 利用者が確認したステージと現在の状態を照合
         * @param rows 削除直前のステージ一覧
         * @param input 削除対象IDと画面で確認した状態
         */
        public void requireStage(List<Object> rows, Map<String, String> input) {
            // 正式な識別子だけを削除APIへ渡す
            requireId(input.get('stageId'), '0ug');
            for (Object item : rows) {
                Map<String, Object> row = (Map<String, Object>) item;
                // 確認中に適用されたステージは別の削除対象として再確認する
                if (row.get('id') == input.get('stageId') && row.get('state') == input.get('stageState')) {
                    return;
                }
            }
            throw new ValidationException('ステージが削除または変更されています。一覧を再取得して確認してください。');
        }

        /** 未適用の現在ステージだけを適用可能とする
         * @param rows 最新のステージ一覧
         * @param input 本人が確認したステージIDと状態
         */
        public void requireApplicable(List<Object> rows, Map<String, String> input) {
            // 適用済み・期限切れ・未知の状態を再適用させない
            for (Object item : rows) {
                Map<String, Object> row = (Map<String, Object>) item;
                if (
                    row.get('id') == input.get('stageId') &&
                    String.valueOf(row.get('state')).toLowerCase() == 'active'
                ) {
                    return;
                }
            }
            throw new ValidationException('未適用のステージだけを適用できます。一覧を再取得してください。');
        }

        /** 削除対象が一覧から消えたことを検証
         * @param rows 削除後に再取得したステージ一覧
         * @param stageId 削除要求を送った識別子
         */
        public void requireDeleted(List<Object> rows, String stageId) {
            // 別のステージがあることと対象の削除失敗を区別
            for (Object item : rows) {
                if (((Map<String, Object>) item).get('id') == stageId) {
                    throw new ValidationException('ステージの削除完了を確認できません。一覧を再取得してください。');
                }
            }
        }
    }

    /** API応答から画面へ返す項目だけを選別 */
    public class View {
        /** ローカルアプリを画面の候補へ変換
         * @param response Tooling APIの応答
         * @return 認証元を除いた候補
         */
        public List<Object> applications(Map<String, Object> response) {
            // 欠落した応答を空一覧として扱わない
            requireRows(response, 'records');
            // 検索候補は最大200件を表示し、残りは検索語で絞り込む
            List<Object> result = new List<Object>();
            for (Object item : (List<Object>) response.get('records')) {
                Map<String, Object> row = (Map<String, Object>) item;
                // 認証元の自己失効とパッケージアプリへの操作を防止
                if (row.get('DistributionState') == 'Local' && row.get('DeveloperName') != 'ExternalClientAppManager') {
                    result.add(
                        new Map<String, Object>{
                            'id' => row.get('Id'),
                            'name' => row.get('DeveloperName'),
                            'label' => row.get('MasterLabel')
                        }
                    );
                }
            }
            return result;
        }

        /** 鍵を公開しないコンシューマー一覧へ変換
         * @param response 資格情報一覧APIの応答
         * @return コンシューマーの識別子と名前
         */
        public List<Object> consumers(Map<String, Object> response) {
            List<Object> result = new List<Object>();
            // 応答欠落のまま生成・削除の完了判定へ進めない
            requireRows(response, 'consumers');
            for (Object item : (List<Object>) response.get('consumers')) {
                Map<String, Object> row = (Map<String, Object>) item;
                result.add(new Map<String, Object>{ 'id' => row.get('id'), 'name' => row.get('name') });
            }
            return result;
        }

        /** 鍵・秘密を返さずステージの確認情報だけを公開
         * @param response ステージAPIの応答
         * @return ステージID・状態・有効期限
         */
        public List<Object> stages(Map<String, Object> response) {
            List<Object> result = new List<Object>();
            // 応答欠落のまま生成・削除の完了判定へ進めない
            requireRows(response, 'stagedCredentials');
            for (Object item : (List<Object>) response.get('stagedCredentials')) {
                Map<String, Object> row = (Map<String, Object>) item;
                result.add(
                    new Map<String, Object>{
                        'id' => row.get('id'),
                        'state' => row.get('state'),
                        'expirationDate' => row.get('expirationDate')
                    }
                );
            }
            return result;
        }
    }
}