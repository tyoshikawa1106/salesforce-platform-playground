/**
 * 取引先トリガーの各イベントを専用 handler へ委譲します。
 */
trigger AccountTrigger on Account(before insert, before update) {
    AccountTriggerHandler.run();
}
