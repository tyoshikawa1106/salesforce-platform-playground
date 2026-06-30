// Run: sf apex run --file scripts/apex/test-data/repair-standard-urls.apex --target-org <alias>
String seedPrefix = '[TEST]';
String seedLike = seedPrefix + '%';
String testUrl = 'https://example.com';

List<Account> accounts = [
    SELECT Id, Website
    FROM Account
    WHERE Name LIKE :seedLike AND Website != :testUrl
    LIMIT 10000
];
List<Account> accountUpdates = new List<Account>();
for (Account accountRecord : accounts) {
    accountUpdates.add(new Account(Id = accountRecord.Id, Website = testUrl));
}
if (!accountUpdates.isEmpty()) {
    update accountUpdates;
}

List<Lead> leads = [
    SELECT Id, Website
    FROM Lead
    WHERE LastName LIKE :seedLike AND Website != :testUrl
    LIMIT 10000
];
List<Lead> leadUpdates = new List<Lead>();
for (Lead leadRecord : leads) {
    leadUpdates.add(new Lead(Id = leadRecord.Id, Website = testUrl));
}
if (!leadUpdates.isEmpty()) {
    update leadUpdates;
}

System.debug('Updated records: Account URL: ' + accountUpdates.size());
System.debug('Updated records: Lead URL: ' + leadUpdates.size());
