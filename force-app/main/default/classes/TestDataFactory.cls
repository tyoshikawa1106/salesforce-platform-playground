/**
 * Creates reusable test data for Apex tests.
 */
@IsTest
public with sharing class TestDataFactory {
    /**
     * Creates Account records with default values.
     * @param count Number of Accounts to create
     * @return Created Account records
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
     * Creates and inserts Account records with default values.
     * @param count Number of Accounts to insert
     * @return Inserted Account records
     */
    public static List<Account> insertAccounts(Integer count) {
        List<Account> accounts = createAccounts(count);
        insert accounts;
        return accounts;
    }

    /**
     * Creates one unsaved Account with a custom name.
     * @param accountName Account name to use
     * @return Created Account record
     */
    public static Account createAccount(String accountName) {
        return new Account(Name = accountName);
    }

    /**
     * Creates and inserts one Account with a custom name.
     * @param accountName Account name to use
     * @return Inserted Account record
     */
    public static Account insertAccount(String accountName) {
        Account accountRecord = createAccount(accountName);
        insert accountRecord;
        return accountRecord;
    }
}
