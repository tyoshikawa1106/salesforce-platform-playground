/**
 * 取引先トリガーのコンテキスト判定だけ担当
 */
public with sharing class AccountTriggerHandler {
    private AccountTriggerService service;

    /**
     * コンストラクタ
     */
    private AccountTriggerHandler() {
        service = new AccountTriggerService();
    }

    /**
     * 実行中のトリガーコンテキストに応じて対象処理へ振り分け
     */
    public static void run() {
        // 静的トリガー入口からインスタンス処理へ渡す
        AccountTriggerHandler handler = new AccountTriggerHandler();
        // before insert/update の対象処理へ振り分け
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
