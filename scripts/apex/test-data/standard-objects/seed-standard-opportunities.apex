Integer countPerObject = 50;
Integer parentPoolSize = 2000;
String seedPrefix = '[TEST]';
String seedRunKey = Datetime.now().formatGmt('yyyyMMddHHmmss');
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

String pickAt(Schema.DescribeFieldResult fieldDescribe, List<String> preferred, Integer index) {
    List<String> candidates = new List<String>();
    for (String value : preferred) {
        for (Schema.PicklistEntry entry : fieldDescribe.getPicklistValues()) {
            if (entry.isActive() && entry.getValue() == value) {
                candidates.add(entry.getValue());
                break;
            }
        }
    }
    for (Schema.PicklistEntry entry : fieldDescribe.getPicklistValues()) {
        if (entry.isActive() && !candidates.contains(entry.getValue())) {
            candidates.add(entry.getValue());
        }
    }
    return candidates.isEmpty() ? null : candidates[Math.mod(index, candidates.size())];
}

String testEmail(Integer sequence) {
    return 'test+' + String.valueOf(sequence).leftPad(4, '0') + '@example.com';
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

void putIfCreateable(SObject record, String fieldName, Object value) {
    Map<String, Schema.SObjectField> fields = record.getSObjectType().getDescribe().fields.getMap();
    if (value != null && fields.containsKey(fieldName) && fields.get(fieldName).getDescribe().isCreateable()) {
        record.put(fieldName, value);
    }
}

List<Account> accounts = [SELECT Id, Name FROM Account WHERE Name LIKE :seedLike ORDER BY CreatedDate ASC LIMIT :parentPoolSize];
List<Contact> contacts = [SELECT Id, FirstName, LastName FROM Contact WHERE LastName LIKE :seedLike ORDER BY CreatedDate ASC LIMIT :parentPoolSize];
List<Opportunity> opportunities = [SELECT Id, AccountId, Pricebook2Id FROM Opportunity WHERE Name LIKE :seedLike ORDER BY CreatedDate ASC LIMIT :parentPoolSize];
List<Campaign> campaigns = [SELECT Id FROM Campaign WHERE Name LIKE '[TEST] 20%' ORDER BY CreatedDate ASC LIMIT :parentPoolSize];
List<PricebookEntry> pricebookEntries = [
    SELECT Id, Pricebook2Id, Product2Id, UnitPrice, Product2.Name, Product2.ProductCode
    FROM PricebookEntry
    WHERE Product2.Name LIKE :seedLike AND Pricebook2.IsStandard = TRUE AND IsActive = TRUE AND Pricebook2.IsActive = TRUE
    ORDER BY CreatedDate ASC
    LIMIT :parentPoolSize
];

if (accounts.isEmpty() || campaigns.isEmpty() || pricebookEntries.isEmpty()) {
    System.assert(false, 'Run accounts, campaigns, and pricebook entries before opportunities.');
}

String stageName = pick(Opportunity.StageName.getDescribe(), new List<String>{ 'Prospecting', 'Qualification', 'Value Proposition' });
String typeValue = pick(Opportunity.Type.getDescribe(), new List<String>{ 'New Customer', 'Existing Customer - Upgrade' });
String leadSource = pick(Opportunity.LeadSource.getDescribe(), new List<String>{ 'Web', 'Phone Inquiry', 'Purchased List' });
List<String> names = new List<String>{ 'CRM 活用拡大', '保守契約更新プロセス標準化', '問い合わせ管理導入', '作業指示デジタル化', 'KPI可視化' };
Integer existingCount = [SELECT COUNT() FROM Opportunity WHERE Name LIKE :seedLike];
List<Opportunity> records = new List<Opportunity>();
for (Integer i = 1; i <= countPerObject; i += 1) {
    Integer sequence = existingCount + i;
    Account account = accounts[Math.mod(sequence - 1, accounts.size())];
    PricebookEntry entry = pricebookEntries[Math.mod(sequence - 1, pricebookEntries.size())];
    records.add(new Opportunity(
        Name = seedPrefix + ' ' + account.Name.replace(seedPrefix, '').trim() + ' ' + names[Math.mod(sequence - 1, names.size())] + ' 第' + String.valueOf(1 + Math.mod(sequence, 20)) + '期',
        AccountId = account.Id,
        CampaignId = campaigns[Math.mod(sequence - 1, campaigns.size())].Id,
        Pricebook2Id = entry.Pricebook2Id,
        StageName = stageName,
        Type = typeValue,
        LeadSource = leadSource,
        CloseDate = Date.today().addDays(30 + Math.mod(sequence, 180)),
        Amount = 250000 + (sequence * 25000),
        Probability = 40 + Math.mod(sequence, 5) * 10,
        NextStep = '来週の定例で利用部門の要件と導入範囲を確認',
        Description = '標準オブジェクト seed 用商談。'
    ));
}
System.debug('Seed run key: ' + seedRunKey);
logResults('Opportunity', Database.insert(records, false));

