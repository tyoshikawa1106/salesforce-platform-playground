/**
 * Handles Account trigger events.
 */
public with sharing class AccountTriggerHandler {
    /**
     * Routes Account trigger contexts to the matching handler behavior.
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
