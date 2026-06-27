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
List<Case> cases = [SELECT Id FROM Case WHERE Subject LIKE :seedLike ORDER BY CreatedDate ASC LIMIT :parentPoolSize];
List<SObject> entitlements = gd.containsKey('Entitlement') ? Database.query('SELECT Id FROM Entitlement WHERE Name LIKE :seedLike ORDER BY CreatedDate ASC LIMIT :parentPoolSize') : new List<SObject>();
if (accounts.isEmpty() || contacts.isEmpty() || assets.isEmpty() || cases.isEmpty()) {
    System.assert(false, 'Run accounts, contacts, assets, and cases before work orders.');
}

System.debug('Seed run key: ' + seedRunKey);
if (gd.containsKey('WorkOrder') && gd.get('WorkOrder').getDescribe().isCreateable()) {
    Map<String, Schema.SObjectField> fields = gd.get('WorkOrder').getDescribe().fields.getMap();
    String status = fields.containsKey('Status') ? pick(fields.get('Status').getDescribe(), new List<String>{ 'New', 'Open' }) : null;
    String priority = fields.containsKey('Priority') ? pick(fields.get('Priority').getDescribe(), new List<String>{ 'Medium', 'High', 'Low' }) : null;
    List<SObject> records = new List<SObject>();
    for (Integer i = 1; i <= countPerObject; i += 1) {
        SObject record = gd.get('WorkOrder').newSObject();
        putIfCreateable(record, 'Subject', seedPrefix + ' 導入後設定確認');
        putIfCreateable(record, 'AccountId', accounts[Math.mod(i - 1, accounts.size())].Id);
        putIfCreateable(record, 'ContactId', contacts[Math.mod(i - 1, contacts.size())].Id);
        putIfCreateable(record, 'AssetId', assets[Math.mod(i - 1, assets.size())].Id);
        putIfCreateable(record, 'CaseId', cases[Math.mod(i - 1, cases.size())].Id);
        if (!entitlements.isEmpty()) { putIfCreateable(record, 'EntitlementId', entitlements[Math.mod(i - 1, entitlements.size())].Id); }
        putIfCreateable(record, 'Status', status);
        putIfCreateable(record, 'Priority', priority);
        putIfCreateable(record, 'Description', '初期設定確認の作業指示。');
        records.add(record);
    }
    logResults('WorkOrder', Database.insert(records, false));
} else {
    System.debug('Skipped records: WorkOrder: object is not createable or not available');
}

