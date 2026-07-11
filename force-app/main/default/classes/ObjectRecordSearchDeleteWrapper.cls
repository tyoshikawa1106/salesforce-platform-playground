/**
 * 汎用レコード検索画面に返す削除結果 Wrapper
 */
public with sharing class ObjectRecordSearchDeleteWrapper {

    // LWC から削除要求された ID 件数
    @AuraEnabled
    public Integer requestedCount { get; private set; }

    // 削除に成功した件数
    @AuraEnabled
    public Integer deletedCount { get; private set; }

    // 削除に失敗した場合のユーザー表示向けメッセージ
    @AuraEnabled
    public List<String> errors { get; private set; }

    /**
     * 削除結果を作成
     *
     * @param requestedCount LWC から削除要求された ID 件数
     * @param deletedCount 削除に成功した件数
     * @param errors 削除に失敗した場合のユーザー表示向けメッセージ
     */
    public ObjectRecordSearchDeleteWrapper(Integer requestedCount, Integer deletedCount, List<String> errors) {
        // 削除対象として受け取った件数を画面へ返す
        this.requestedCount = requestedCount;
        // 削除済み件数を完了メッセージに使えるようにする
        this.deletedCount = deletedCount;
        // 削除できなかった理由を画面へ返す
        this.errors = errors;
    }
}