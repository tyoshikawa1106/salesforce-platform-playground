// Run: npm run setup:data:standard -- --target-org <alias> --only standard-objects-contract-line-items
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

List<SObject> serviceContracts = gd.containsKey('ServiceContract') ? Database.query('SELECT Id, StartDate, EndDate FROM ServiceContract WHERE Name LIKE :seedLike ORDER BY CreatedDate ASC LIMIT :parentPoolSize') : new List<SObject>();
List<Asset> assets = [SELECT Id FROM Asset WHERE Name LIKE :seedLike ORDER BY CreatedDate ASC LIMIT :parentPoolSize];
if (pricebookEntries.isEmpty() || assets.isEmpty()) {
    System.assert(false, 'Run pricebook entries and assets before contract line items.');
}

System.debug('Seed run key: ' + seedRunKey);
if (gd.containsKey('ContractLineItem') && gd.get('ContractLineItem').getDescribe().isCreateable() && !serviceContracts.isEmpty()) {
    List<SObject> records = new List<SObject>();
    for (Integer i = 1; i <= countPerObject; i += 1) {
        SObject serviceContract = serviceContracts[Math.mod(i - 1, serviceContracts.size())];
        PricebookEntry entry = pricebookEntries[Math.mod(i - 1, pricebookEntries.size())];
        SObject record = gd.get('ContractLineItem').newSObject();
        putIfCreateable(record, 'ServiceContractId', serviceContract.Id);
        putIfCreateable(record, 'PricebookEntryId', entry.Id);
        putIfCreateable(record, 'AssetId', assets[Math.mod(i - 1, assets.size())].Id);
        putIfCreateable(record, 'Quantity', 1 + Math.mod(i, 3));
        putIfCreateable(record, 'UnitPrice', entry.UnitPrice);
        putIfCreateable(record, 'StartDate', (Date) serviceContract.get('StartDate'));
        putIfCreateable(record, 'EndDate', (Date) serviceContract.get('EndDate'));
        putIfCreateable(record, 'Description', '保守契約品目。');
        records.add(record);
    }
    logResults('ContractLineItem', Database.insert(records, false));
} else {
    System.debug('Skipped records: ContractLineItem: object is not createable, unavailable, or no service contracts were available');
}

