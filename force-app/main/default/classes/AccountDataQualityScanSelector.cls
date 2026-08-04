/**
 * 取引先Cursorとスキャン管理レコードのデータアクセス
 */
public virtual with sharing class AccountDataQualityScanSelector {

    // 品質判定に必要な取引先項目だけを固定順で取得するSOQL
    private static final String ACCOUNT_CURSOR_QUERY =
        'SELECT Id, Phone, Industry, BillingStreet, BillingCity, BillingState, ' +
        'BillingPostalCode, BillingCountry, Website, AccountNumber ' +
        'FROM Account ORDER BY Id';

    /**
     * 利用者が参照できる取引先のCursorを作成
     *
     * @return ID順に固定された取引先Cursor
     */
    public virtual Database.Cursor createAccountCursor() {
        return Database.getCursor(ACCOUNT_CURSOR_QUERY, AccessLevel.USER_MODE);
    }

    /**
     * Cursorの指定位置から取引先を取得
     *
     * @param accountCursor 取引先Cursor
     * @param position 取得開始位置
     * @param fetchSize 1トランザクションの取得件数
     * @return 品質判定対象の取引先
     */
    public virtual List<Account> fetchAccounts(Database.Cursor accountCursor, Integer position, Integer fetchSize) {
        if (accountCursor == null || position == null || position < 0 || fetchSize == null || fetchSize <= 0) {
            return new List<Account>();
        }
        Integer remainingCount = accountCursor.getNumRecords() - position;
        if (remainingCount <= 0) {
            return new List<Account>();
        }
        return accountCursor.fetch(position, Math.min(fetchSize, remainingCount));
    }

    /**
     * Accountを対象に実行中のスキャンを取得
     *
     * @return 実行中スキャン一覧、存在しない場合は空の List
     */
    public virtual List<DataQualityScan__c> getActiveScans() {
        // Account を対象にした実行中スキャンだけを取得
        return [
            SELECT Id, Status__c
            FROM DataQualityScan__c
            WHERE Active_Key__c = :AccountDataQualityScanService.ACCOUNT_ACTIVE_KEY
            WITH USER_MODE
            LIMIT 1
        ];
    }

    /**
     * 利用者が参照できる直近スキャンを取得
     *
     * @return 作成日時が最新のスキャン一覧、存在しない場合は空の List
     */
    public virtual List<DataQualityScan__c> getLatestScans() {
        // 利用者が参照できる直近スキャンだけを取得
        return [
            SELECT Id, Status__c, Total_Count__c, Processed_Count__c,
                Missing_Phone_Count__c, Missing_Industry_Count__c,
                Missing_Address_Count__c, Missing_Website_Count__c,
                Missing_Account_Number_Count__c, Started_At__c,
                Completed_At__c, Error_Message__c
            FROM DataQualityScan__c
            WITH USER_MODE
            ORDER BY CreatedDate DESC
            LIMIT 1
        ];
    }

    /**
     * IDでスキャン管理レコードを取得
     *
     * @param scanId 取得対象のスキャン管理レコードID
     * @return 指定スキャン一覧、存在しない場合は空の List
     */
    public virtual List<DataQualityScan__c> getScansById(Id scanId) {
        // スキャン ID 未指定時は SOQL を実行せず空結果へ短絡
        if (scanId == null) {
            return new List<DataQualityScan__c>();
        }
        // 指定 ID のスキャン管理レコードだけを取得
        return [
            SELECT Id, Status__c, Active_Key__c, Total_Count__c, Processed_Count__c,
                Missing_Phone_Count__c, Missing_Industry_Count__c,
                Missing_Address_Count__c, Missing_Website_Count__c,
                Missing_Account_Number_Count__c, Started_At__c,
                Completed_At__c, Error_Message__c
            FROM DataQualityScan__c
            WHERE Id = :scanId
            WITH USER_MODE
            LIMIT 1
        ];
    }
}
