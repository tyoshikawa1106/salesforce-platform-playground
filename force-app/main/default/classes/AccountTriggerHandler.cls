/**
 * 取引先トリガーのコンテキスト判定だけを担当します。
 *
 * トリガー本体に分岐や業務ロジックを置かないための入口です。
 * 各コンテキストで必要な処理は AccountTriggerService に委譲します。
 */
public with sharing class AccountTriggerHandler {
    private AccountTriggerService service;

    private AccountTriggerHandler(AccountTriggerService service) {
        this.service = service;
    }

    /**
     * 実行中のトリガーコンテキストに応じて対象処理へ振り分けます。
     *
     * 現時点の対象は before insert / before update だけです。
     * それ以外のコンテキストでは何も行わずに戻り、意図しない処理追加を避けます。
     */
    public static void run() {
        AccountTriggerHandler handler = new AccountTriggerHandler(
            new AccountTriggerService()
        );
        handler.normalizeAccountNames();
    }

    private void normalizeAccountNames() {
        if (!Trigger.isBefore) {
            return;
        }

        if (Trigger.isInsert) {
            // 作成前の取引先名略称を正式名称に補正
            service.normalizeAccountNamesForInsert((List<Account>) Trigger.new);
        } else if (Trigger.isUpdate) {
            // 変更された取引先名略称を正式名称に補正
            service.normalizeChangedAccountNamesForUpdate(
                (List<Account>) Trigger.new,
                (Map<Id, Account>) Trigger.oldMap
            );
        }
    }
}
