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

List<Asset> assets = [SELECT Id FROM Asset WHERE Name LIKE :seedLike ORDER BY CreatedDate ASC LIMIT :parentPoolSize];
List<SObject> serviceContracts = gd.containsKey('ServiceContract') ? Database.query('SELECT Id FROM ServiceContract WHERE Name LIKE :seedLike ORDER BY CreatedDate ASC LIMIT :parentPoolSize') : new List<SObject>();
if (accounts.isEmpty() || contacts.isEmpty() || assets.isEmpty()) {
    System.assert(false, 'Run accounts, contacts, and assets before entitlements.');
}

System.debug('Seed run key: ' + seedRunKey);
if (gd.containsKey('Entitlement') && gd.get('Entitlement').getDescribe().isCreateable()) {
    List<BusinessHours> hours = [SELECT Id FROM BusinessHours WHERE IsDefault = TRUE LIMIT 1];
    List<SObject> records = new List<SObject>();
    for (Integer i = 1; i <= countPerObject; i += 1) {
        SObject record = gd.get('Entitlement').newSObject();
        putIfCreateable(record, 'Name', seedPrefix + ' 平日サポート権利');
        putIfCreateable(record, 'AccountId', accounts[Math.mod(i - 1, accounts.size())].Id);
        putIfCreateable(record, 'ContactId', contacts[Math.mod(i - 1, contacts.size())].Id);
        putIfCreateable(record, 'AssetId', assets[Math.mod(i - 1, assets.size())].Id);
        if (!serviceContracts.isEmpty()) { putIfCreateable(record, 'ServiceContractId', serviceContracts[Math.mod(i - 1, serviceContracts.size())].Id); }
        if (!hours.isEmpty()) { putIfCreateable(record, 'BusinessHoursId', hours[0].Id); }
        putIfCreateable(record, 'StartDate', Date.today().addDays(Math.mod(i, 180)));
        putIfCreateable(record, 'EndDate', Date.today().addDays(365 + Math.mod(i, 180)));
        putIfCreateable(record, 'Description', '平日営業時間内の標準サポート権利。');
        records.add(record);
    }
    logResults('Entitlement', Database.insert(records, false));
} else {
    System.debug('Skipped records: Entitlement: object is not createable or not available');
}

