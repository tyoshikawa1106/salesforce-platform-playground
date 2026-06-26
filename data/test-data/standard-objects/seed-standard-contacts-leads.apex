Integer countPerObject = 20;
String seedPrefix = 'CLI Standard Seed';
String seedKey = seedPrefix + ' ' + Datetime.now().formatGmt('yyyyMMddHHmmss');
String seedLike = seedPrefix + '%';

String pick(Schema.DescribeFieldResult fieldDescribe, List<String> preferred) {
    List<Schema.PicklistEntry> entries = fieldDescribe.getPicklistValues();
    for (String value : preferred) {
        for (Schema.PicklistEntry entry : entries) {
            if (entry.isActive() && entry.getValue() == value) {
                return entry.getValue();
            }
        }
    }
    for (Schema.PicklistEntry entry : entries) {
        if (entry.isActive() && entry.isDefaultValue()) {
            return entry.getValue();
        }
    }
    for (Schema.PicklistEntry entry : entries) {
        if (entry.isActive()) {
            return entry.getValue();
        }
    }
    return null;
}

void logResults(String objectName, Database.SaveResult[] results) {
    Integer successCount = 0;
    List<String> errors = new List<String>();
    for (Database.SaveResult result : results) {
        if (result.isSuccess()) {
            successCount += 1;
            continue;
        }
        for (Database.Error error : result.getErrors()) {
            errors.add(error.getStatusCode() + ' ' + error.getMessage());
        }
    }
    System.debug('Created records: ' + objectName + ': ' + successCount);
    if (!errors.isEmpty()) {
        System.debug('Skipped records: ' + objectName + ': ' + String.join(errors, ' / '));
    }
}

List<Account> accounts = [
    SELECT Id
    FROM Account
    WHERE Name LIKE :seedLike
    ORDER BY CreatedDate DESC
    LIMIT :countPerObject
];
if (accounts.isEmpty()) {
    System.assert(false, 'Run standard-objects-accounts before contacts and leads.');
}

String contactLeadSource = pick(Contact.LeadSource.getDescribe(), new List<String>{ 'Web', 'Phone Inquiry', 'Purchased List' });
String leadStatus = pick(Lead.Status.getDescribe(), new List<String>{ 'Open - Not Contacted', 'Working - Contacted', 'New' });
String leadSource = pick(Lead.LeadSource.getDescribe(), new List<String>{ 'Web', 'Phone Inquiry', 'Purchased List' });
String leadRating = pick(Lead.Rating.getDescribe(), new List<String>{ 'Warm', 'Hot', 'Cold' });
String leadIndustry = pick(Lead.Industry.getDescribe(), new List<String>{ 'Technology', 'Consulting', 'Manufacturing' });

List<Contact> contacts = new List<Contact>();
List<Lead> leads = new List<Lead>();
for (Integer i = 1; i <= countPerObject; i += 1) {
    Account account = accounts[Math.mod(i - 1, accounts.size())];
    contacts.add(
        new Contact(
            AccountId = account.Id,
            FirstName = 'Seed',
            LastName = seedKey + ' Contact ' + String.valueOf(i).leftPad(2, '0'),
            Title = 'Customer Operations Manager ' + i,
            Department = 'Customer Success',
            Email = 'standard.seed.contact+' + i + '@example.invalid',
            Phone = '03-5555-' + String.valueOf(3000 + i),
            MobilePhone = '090-5555-' + String.valueOf(3000 + i),
            Fax = '03-5555-' + String.valueOf(4000 + i),
            LeadSource = contactLeadSource,
            MailingStreet = '3-' + i + '-1 Yaesu',
            MailingCity = 'Chuo-ku',
            MailingPostalCode = '104-' + String.valueOf(1000 + i),
            OtherStreet = '4-' + i + '-1 Shinjuku',
            OtherCity = 'Shinjuku-ku',
            OtherPostalCode = '160-' + String.valueOf(1000 + i),
            AssistantName = 'Assistant ' + i,
            AssistantPhone = '03-5555-' + String.valueOf(5000 + i),
            Description = 'Synthetic contact for standard object seed ' + i + '.'
        )
    );

    leads.add(
        new Lead(
            FirstName = 'Seed',
            LastName = seedKey + ' Lead ' + String.valueOf(i).leftPad(2, '0'),
            Company = seedKey + ' Prospect Company ' + String.valueOf(i).leftPad(2, '0'),
            Title = 'Digital Transformation Lead ' + i,
            Status = leadStatus,
            Rating = leadRating,
            Industry = leadIndustry,
            LeadSource = leadSource,
            Email = 'standard.seed.lead+' + i + '@example.invalid',
            Phone = '03-5555-' + String.valueOf(6000 + i),
            MobilePhone = '080-5555-' + String.valueOf(6000 + i),
            Fax = '03-5555-' + String.valueOf(7000 + i),
            Website = 'https://example.invalid/seed/lead-' + i,
            Street = '5-' + i + '-1 Shibuya',
            City = 'Shibuya-ku',
            PostalCode = '150-' + String.valueOf(1000 + i),
            NumberOfEmployees = 40 + i,
            AnnualRevenue = 30000000 + (i * 750000),
            Description = 'Synthetic lead for standard object seed ' + i + '.'
        )
    );
}

System.debug('Seed key: ' + seedKey);
logResults('Contact', Database.insert(contacts, false));
logResults('Lead', Database.insert(leads, false));
