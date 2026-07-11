trigger AccountTrigger on Account (before insert, before update) {

    AccountTriggerHandler handler = new AccountTriggerHandler();

    if (Trigger.isInsert) {
        // 取引先名の法人格略称を補正
        handler.normalizeAccountNamesForInsert(Trigger.new);
    } else if (Trigger.isUpdate) {
        // 取引先名の法人格略称を補正
        handler.normalizeChangedAccountNamesForUpdate(Trigger.new, Trigger.oldMap);
    }
}