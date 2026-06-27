// Run: npm run setup:data:standard -- --target-org <alias> --only standard-objects-service-contracts
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

Map<String, Schema.SObjectType> gd = Schema.getGlobalDescribe();
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

if (accounts.isEmpty() || contacts.isEmpty() || pricebookEntries.isEmpty()) {
    System.assert(false, 'Run accounts, contacts, and pricebook entries before service contracts.');
}

System.debug('Seed run key: ' + seedRunKey);
List<SObject> records = new List<SObject>();
if (gd.containsKey('ServiceContract') && gd.get('ServiceContract').getDescribe().isCreateable()) {
    String status = pick(gd.get('ServiceContract').getDescribe().fields.getMap().get('Status').getDescribe(), new List<String>{ 'Draft' });
    for (Integer i = 1; i <= countPerObject; i += 1) {
        SObject record = gd.get('ServiceContract').newSObject();
        putIfCreateable(record, 'Name', seedPrefix + ' 年間サポート契約');
        putIfCreateable(record, 'AccountId', accounts[Math.mod(i - 1, accounts.size())].Id);
        putIfCreateable(record, 'ContactId', contacts[Math.mod(i - 1, contacts.size())].Id);
        putIfCreateable(record, 'Pricebook2Id', pricebookEntries[Math.mod(i - 1, pricebookEntries.size())].Pricebook2Id);
        putIfCreateable(record, 'StartDate', Date.today().addDays(Math.mod(i, 180)));
        putIfCreateable(record, 'EndDate', Date.today().addDays(365 + Math.mod(i, 180)));
        putIfCreateable(record, 'Term', 12);
        putIfCreateable(record, 'Status', status);
        putIfCreateable(record, 'Description', '年間サポート契約。');
        records.add(record);
    }
    logResults('ServiceContract', Database.insert(records, false));
} else {
    System.debug('Skipped records: ServiceContract: object is not createable or not available');
}

