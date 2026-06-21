/**
 * Apex テストで再利用するテストデータを作成します。
 */
@IsTest
public with sharing class TestDataFactory {
    /**
     * 既定値を持つ取引先レコードを作成します。
     * @param count 作成する取引先件数
     * @return 作成した取引先レコード
     */
    public static List<Account> createAccounts(Integer count) {
        List<Account> accounts = new List<Account>();
        if (count == null || count <= 0) {
            return accounts;
        }

        for (Integer index = 0; index < count; index++) {
            accounts.add(new Account(Name = 'Test Account ' + index));
        }

        return accounts;
    }

    /**
     * 既定値を持つ取引先レコードを作成して保存します。
     * @param count 保存する取引先件数
     * @return 保存した取引先レコード
     */
    public static List<Account> insertAccounts(Integer count) {
        List<Account> accounts = createAccounts(count);
        insert accounts;
        return accounts;
    }

    /**
     * 指定した名前の未保存取引先を 1 件作成します。
     * @param accountName 使用する取引先名
     * @return 作成した取引先レコード
     */
    public static Account createAccount(String accountName) {
        return new Account(Name = accountName);
    }

    /**
     * 指定した名前の取引先を 1 件作成して保存します。
     * @param accountName 使用する取引先名
     * @return 保存した取引先レコード
     */
    public static Account insertAccount(String accountName) {
        Account accountRecord = createAccount(accountName);
        insert accountRecord;
        return accountRecord;
    }
}
