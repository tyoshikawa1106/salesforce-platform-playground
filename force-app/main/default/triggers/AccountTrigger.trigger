/**
 * Routes Account trigger events to the Account trigger handler.
 */
trigger AccountTrigger on Account(before insert, before update) {
  AccountTriggerHandler.run();
}
