/**
 * 現在の Salesforce 組織の実行環境情報を提供
 */
public with sharing class OrgEnvironment {

    // 同一トランザクション内で Sandbox 判定を取得済みかどうか
    private static Boolean hasCachedIsSandbox = false;
    // 同一トランザクション内の重複問い合わせを避ける Sandbox 判定結果
    private static Boolean cachedIsSandbox = false;
    // Sandbox以外で許可するDeveloper Edition判定に使用
    private static String cachedOrganizationType = '';

    /**
     * 現在の組織が Sandbox か判定
     *
     * Organization の Sandbox 区分は呼び出しユーザー権限に依存させずシステムモードで取得
     *
     * @return Sandbox の場合 true、それ以外の場合 false
     */
    public static Boolean isSandbox() {
        // 未取得の場合だけ現在組織の Sandbox 区分を問い合わせ
        if (!hasCachedIsSandbox) {
            // 判定に必要な組織情報を 1 件取得
            List<Organization> organizations = [
                SELECT IsSandbox, OrganizationType
                FROM Organization
                WITH SYSTEM_MODE
                LIMIT 1
            ];
            // 後続呼び出しで再利用する判定結果を保持
            cachedIsSandbox = organizations[0].IsSandbox;
            // 組織名やURLへ依存せずEditionを保持
            cachedOrganizationType = organizations[0].OrganizationType ?? '';
            hasCachedIsSandbox = true;
        }
        // 現在組織の Sandbox 判定結果を返却
        return cachedIsSandbox;
    }

    /**
     * Scratch Org・Sandbox・Developer Editionに該当するか判定
     * @return 開発環境として許可する組織の場合true
     */
    public static Boolean isDevelopmentEnvironment() {
        // 既存のキャッシュを使い組織情報を一度だけ取得
        return isAllowedDevelopmentType(isSandbox(), cachedOrganizationType);
    }

    @TestVisible
    private static Boolean isAllowedDevelopmentType(Boolean sandbox, String organizationType) {
        // Scratch Orgを含むSandbox区分とDeveloper Editionだけを許可
        return sandbox == true || organizationType == 'Developer Edition';
    }
}