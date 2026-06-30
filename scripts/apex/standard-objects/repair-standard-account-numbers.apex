// Run: sf apex run --file scripts/apex/standard-objects/repair-standard-account-numbers.apex --target-org <alias>
String seedPrefix = '[TEST]';
String seedLike = seedPrefix + '%';
String longAccountNumberLike = 'ACCT-%-%';

List<Account> accounts = [
    SELECT Id, AccountNumber
    FROM Account
    WHERE Name LIKE :seedLike AND AccountNumber LIKE :longAccountNumberLike
    ORDER BY CreatedDate ASC, Id ASC
    LIMIT 10000
];

List<Account> updates = new List<Account>();
for (Account accountRecord : accounts) {
    List<String> parts = accountRecord.AccountNumber.split('-');
    if (parts.size() < 3) {
        continue;
    }

    String sequence = parts[parts.size() - 1];
    updates.add(
        new Account(Id = accountRecord.Id, AccountNumber = 'ACCT-' + sequence)
    );
}

if (!updates.isEmpty()) {
    update updates;
}

System.debug('Updated records: Account: ' + updates.size());
