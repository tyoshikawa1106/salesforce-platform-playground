/**
 * 汎用レコード検索画面に返す削除結果 Wrapper です。
 */
public with sharing class ObjectRecordSearchDeleteWrapper {
    /**
     * LWC から削除要求された ID 件数です。
     */
    @AuraEnabled
    public Integer requestedCount { get; private set; }

    /**
     * 削除に成功した件数です。
     */
    @AuraEnabled
    public Integer deletedCount { get; private set; }

    /**
     * 削除に失敗した場合のユーザー表示向けメッセージです。
     */
    @AuraEnabled
    public List<String> errors { get; private set; }

    /**
     * 削除結果を作成します。
     *
     * @param requestedCount LWC から削除要求された ID 件数
     * @param deletedCount 削除に成功した件数
     * @param errors 削除に失敗した場合のユーザー表示向けメッセージ
     */
    public ObjectRecordSearchDeleteWrapper(
        Integer requestedCount,
        Integer deletedCount,
        List<String> errors
    ) {
        this.requestedCount = requestedCount;
        this.deletedCount = deletedCount;
        this.errors = errors;
    }
}