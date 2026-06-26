Integer countPerObject = 20;
String seedPrefix = 'CLI Standard Seed';
String seedKey = seedPrefix + ' ' + Datetime.now().formatGmt('yyyyMMddHHmmss');

List<Account> accounts = new List<Account>();
for (Integer i = 1; i <= countPerObject; i += 1) {
    accounts.add(
        new Account(
            Name = seedKey + ' Account ' + String.valueOf(i).leftPad(2, '0'),
            AccountNumber = 'ACC-' + seedKey.right(14) + '-' + i,
            Phone = '03-5555-' + String.valueOf(1000 + i),
            Fax = '03-5555-' + String.valueOf(2000 + i),
            Website = 'https://example.invalid/seed/account-' + i,
            Site = 'Tokyo Office ' + i,
            TickerSymbol = 'SD' + i,
            AnnualRevenue = 50000000 + (i * 1000000),
            NumberOfEmployees = 80 + i,
            Sic = '737' + Math.mod(i, 10),
            BillingStreet = '1-' + i + '-1 Marunouchi',
            BillingCity = 'Chiyoda-ku',
            BillingPostalCode = '100-' + String.valueOf(1000 + i),
            ShippingStreet = '2-' + i + '-1 Nihonbashi',
            ShippingCity = 'Chuo-ku',
            ShippingPostalCode = '103-' + String.valueOf(1000 + i),
            Description = 'Synthetic account for standard object seed ' + i + '.'
        )
    );
}

Database.SaveResult[] results = Database.insert(accounts, false);
Integer successCount = 0;
List<String> errors = new List<String>();
for (Database.SaveResult result : results) {
    if (result.isSuccess()) {
        successCount += 1;
    } else {
        for (Database.Error error : result.getErrors()) {
            errors.add(error.getStatusCode() + ' ' + error.getMessage());
        }
    }
}

System.debug('Seed key: ' + seedKey);
System.debug('Created records: Account: ' + successCount);
if (!errors.isEmpty()) {
    System.debug('Skipped records: Account: ' + String.join(errors, ' / '));
}
