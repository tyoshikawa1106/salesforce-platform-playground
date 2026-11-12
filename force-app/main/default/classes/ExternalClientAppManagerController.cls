/** 本人確認から資格情報の更新・削除までの画面操作を制御 */
public with sharing class ExternalClientAppManagerController {
    private static ExternalClientAppManagerService service = new ExternalClientAppManagerService();
    private static ExternalClientAppManagerService.Stages stages = new ExternalClientAppManagerService.Stages();
    private static ExternalClientAppManagerService.View view = new ExternalClientAppManagerService.View();
    private static ExternalClientAppManagerApiClient client = new ExternalClientAppManagerApiClient();

    /** 本人の管理用API認証状態を取得
     * @return 認証済み・要認証・確認不能の区分
     */
    @AuraEnabled
    public static Map<String, Object> getAuthentication() {
        try {
            // 認証操作でも機能権限を必須にする
            service.requireAccess();
            // 保存状態だけでなくAPI接続の本人性を検証
            String status = client.getAuthenticationStatus();
            return new Map<String, Object>{ 'status' => status };
        } catch (Exception error) {
            // 設定不備や権限不足を未認証と推測しない
            return new Map<String, Object>{ 'status' => 'UNAVAILABLE' };
        }
    }

    /** 接続確認の結果と独立して標準認証URLを取得
     * @return 機能利用権限を持つ本人の認証開始URL
     */
    @AuraEnabled
    public static String getAuthenticationUrl() {
        try {
            // URL取得でも管理機能の利用権限を確認
            service.requireAccess();
            // 本人確認失敗時も別アカウントで認証し直せる標準URLを準備
            return client.getAuthenticationUrl();
        } catch (Exception error) {
            throw failure('認証を開始できません。接続設定と権限を管理者に確認してください。');
        }
    }

    /** 機能権限を持つ本人の管理用API認証を解除 */
    @AuraEnabled
    public static void revokeAuthentication() {
        try {
            service.requireAccess();
            // 他の利用者や接続設定には触れない
            client.revokeAuthentication();
        } catch (Exception error) {
            throw failure('認証の解除結果を確認できません。画面を再読み込みして確認してください。');
        }
    }

    /** 所属確認済みの対象に一覧参照・生成・適用・削除を実行
     * @param input action、対象アプリID、確認ID・API名、適用・削除時はステージIDと状態
     * @return 秘密を含まない一覧、または変更前拒否・完了・結果未確認の区分
     */
    @AuraEnabled
    public static Map<String, Object> execute(Map<String, String> input) {
        try {
            service.requireAccess();
            service.requireRequest(input);
            // 改ざんされた接続主体で管理操作させない
            client.verifyIdentity();
            // 検索語は候補取得だけに使い、操作対象はIDで直接照合する
            Map<String, Object> response = client.listApplications(
                input.get('action') == 'list' ? input.get('term') : null,
                input.get('appId')
            );
            List<Object> applications = view.applications(response);
            if (input.get('action') == 'list') {
                return new Map<String, Object>{ 'applications' => applications };
            }
            Map<String, Object> app = service.requireApplication(applications, input);
            String appId = (String) app.get('id');
            // 更新対象コンシューマーはサーバーで一意に確定
            Map<String, Object> credentials = client.readConsumers(appId);
            List<Object> consumers = view.consumers(credentials);
            String path = service.stagePath(appId, consumers);
            return executeOperation(path, input);
        } catch (Exception error) {
            // 変更処理は内側で結果不明を捕捉するため、ここは変更前の失敗
            String message = error instanceof ExternalClientAppManagerService.ValidationException
                ? error.getMessage()
                : ExternalClientAppManagerApiClient.accessFailureMessage(error);
            if (new Set<String>{ 'generate', 'apply', 'deleteStage' }.contains(input?.get('action'))) {
                return new Map<String, Object>{ 'state' => 'notStarted', 'message' => message };
            }
            throw failure(message);
        }
    }

    private static Map<String, Object> executeOperation(String path, Map<String, String> input) {
        // 変更の直前に最新のステージを確認する
        List<Object> rows = readStages(path);
        String action = input.get('action');
        if (action == 'stages') {
            return new Map<String, Object>{ 'stages' => rows };
        }
        // 変更前の拒否は結果不明と区別する
        if (action == 'generate') {
            stages.requireEmptyStages(rows);
        } else {
            stages.requireStage(rows, input);
            if (action == 'apply') {
                stages.requireApplicable(rows, input);
            }
        }
        // 変更要求後の失敗だけを結果不明として返し、自動再送しない
        try {
            String stageId = input.get('stageId');
            switch on action {
                when 'generate' {
                    Map<String, Object> generated = client.request(path, 'POST', '{}');
                    stageId = stages.generatedStageId(view.stages(generated));
                }
                when 'apply' {
                    stages.requireRotated(client.request(path + '/' + stageId, 'PATCH', '{"command":"rotate"}'));
                }
                when 'deleteStage' {
                    client.request(path + '/' + stageId, 'DELETE', null);
                }
            }
            // 一操作ごとに再取得し、次工程は本人の別操作へ委ねる
            rows = readStages(path);
            // 生成ID・適用状態・削除対象の消失を操作別に照合する
            stages.requireOperationResult(action, rows, stageId);
            return new Map<String, Object>{ 'state' => 'complete', 'stages' => rows, 'confirmedAt' => Datetime.now() };
        } catch (Exception e) {
            // 秘密や例外本文を返さず、再取得による確認を案内する
            return new Map<String, Object>{ 'state' => 'unconfirmed' };
        }
    }

    private static List<Object> readStages(String path) {
        // 生のAPI応答はController内で公開項目に変換
        Map<String, Object> response = client.request(path, 'GET', null);
        return view.stages(response);
    }

    private static AuraHandledException failure(String message) {
        // 自ら生成した固定案内だけを画面へ返す
        AuraHandledException error = new AuraHandledException(message);
        error.setMessage(message);
        return error;
    }
}