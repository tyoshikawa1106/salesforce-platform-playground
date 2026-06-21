/**
 * 取引先トリガーのコンテキスト判定だけを担当します。
 *
 * トリガー本体に分岐や業務ロジックを置かないための入口です。
 * 各コンテキストで必要な処理は AccountTriggerService に委譲します。
 */
public with sharing class AccountTriggerHandler {
    /**
     * 実行中のトリガーコンテキストに応じて対象処理へ振り分けます。
     *
     * 現時点の対象は before insert / before update だけです。
     * それ以外のコンテキストでは何も行わずに戻り、意図しない処理追加を避けます。
     */
    public static void run() {
        if (!Trigger.isBefore) {
            return;
        }

        if (Trigger.isInsert) {
            AccountTriggerService.beforeInsert((List<Account>) Trigger.new);
        } else if (Trigger.isUpdate) {
            AccountTriggerService.beforeUpdate(
                (List<Account>) Trigger.new,
                (Map<Id, Account>) Trigger.oldMap
            );
        }
    }
}
