/**
 * 取引先データ品質スキャンの画面表示値
 */
public with sharing class AccountDataQualityScanWrapper {

    // スキャン管理レコードのID
    @AuraEnabled
    public Id scanId { get; private set; }
    // スキャンの状態値
    @AuraEnabled
    public String status { get; private set; }
    // 対象取引先の総件数
    @AuraEnabled
    public Integer totalCount { get; private set; }
    // Cursor上で処理済みの件数
    @AuraEnabled
    public Integer processedCount { get; private set; }
    // 進捗率
    @AuraEnabled
    public Decimal progressPercent { get; private set; }
    // 電話番号がない取引先件数
    @AuraEnabled
    public Integer missingPhoneCount { get; private set; }
    // 業種がない取引先件数
    @AuraEnabled
    public Integer missingIndustryCount { get; private set; }
    // 請求先住所が不足する取引先件数
    @AuraEnabled
    public Integer missingAddressCount { get; private set; }
    // Webサイトがない取引先件数
    @AuraEnabled
    public Integer missingWebsiteCount { get; private set; }
    // 取引先番号がない取引先件数
    @AuraEnabled
    public Integer missingAccountNumberCount { get; private set; }
    // スキャン開始日時
    @AuraEnabled
    public Datetime startedAt { get; private set; }
    // スキャン終了日時
    @AuraEnabled
    public Datetime completedAt { get; private set; }
    // 利用者へ表示できる最終エラー
    @AuraEnabled
    public String errorMessage { get; private set; }

    /**
     * 管理レコードから画面表示値を作成
     *
     * @param scanRecord 表示対象のスキャン管理レコード
     * @param progressPercent 算出済みの進捗率
     */
    public AccountDataQualityScanWrapper(DataQualityScan__c scanRecord, Decimal progressPercent) {
        this.scanId = scanRecord.Id;
        this.status = scanRecord.Status__c;
        this.totalCount = toInteger(scanRecord.Total_Count__c);
        this.processedCount = toInteger(scanRecord.Processed_Count__c);
        this.progressPercent = progressPercent;
        this.missingPhoneCount = toInteger(scanRecord.Missing_Phone_Count__c);
        this.missingIndustryCount = toInteger(scanRecord.Missing_Industry_Count__c);
        this.missingAddressCount = toInteger(scanRecord.Missing_Address_Count__c);
        this.missingWebsiteCount = toInteger(scanRecord.Missing_Website_Count__c);
        this.missingAccountNumberCount = toInteger(scanRecord.Missing_Account_Number_Count__c);
        this.startedAt = scanRecord.Started_At__c;
        this.completedAt = scanRecord.Completed_At__c;
        this.errorMessage = scanRecord.Error_Message__c;
    }

    private static Integer toInteger(Decimal value) {
        return value == null ? 0 : value.intValue();
    }
}
