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
            AccountNameNormalizer.normalize(Trigger.new, null);
        } else if (Trigger.isUpdate) {
            AccountNameNormalizer.normalize(Trigger.new, Trigger.oldMap);
        }
    }
}
