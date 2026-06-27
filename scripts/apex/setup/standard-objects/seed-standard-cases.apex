// Run: npm run setup:data:standard -- --target-org <alias> --only standard-objects-cases
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

if (accounts.isEmpty() || contacts.isEmpty()) {
    System.assert(false, 'Run accounts and contacts before cases.');
}

String origin = pick(Case.Origin.getDescribe(), new List<String>{ 'Web', 'Phone', 'Email' });
String status = pick(Case.Status.getDescribe(), new List<String>{ 'New', 'Working', 'Open' });
List<String> subjects = new List<String>{ 'ノートPCの初期設定方法を確認したい', 'モニターの画面ちらつきについて確認したい', 'ワイヤレスキーボードの接続が不安定', 'CRMライセンスの追加購入を相談したい' };
Integer existingCount = [SELECT COUNT() FROM Case WHERE Subject LIKE :seedLike];
List<Case> records = new List<Case>();
for (Integer i = 1; i <= countPerObject; i += 1) {
    Integer sequence = existingCount + i;
    Contact contact = contacts[Math.mod(sequence - 1, contacts.size())];
    Account account = accounts[Math.mod(sequence - 1, accounts.size())];
    records.add(new Case(Subject = seedPrefix + ' ' + subjects[Math.mod(sequence - 1, subjects.size())], AccountId = account.Id, ContactId = contact.Id, Type = pickAt(Case.Type.getDescribe(), new List<String>{ 'Question', 'Problem', 'Feature Request', 'Other' }, sequence), Origin = origin, Status = status, Priority = pickAt(Case.Priority.getDescribe(), new List<String>{ 'Medium', 'High', 'Low' }, sequence), Reason = pickAt(Case.Reason.getDescribe(), new List<String>{ 'Installation', 'Performance', 'Other' }, sequence), SuppliedName = contact.LastName.replace(seedPrefix, '').trim() + ' ' + contact.FirstName, SuppliedEmail = testEmail(sequence), SuppliedCompany = account.Name.replace(seedPrefix, '').trim(), Description = '製品に関する問い合わせの検証用ケース。'));
}
System.debug('Seed run key: ' + seedRunKey);
logResults('Case', Database.insert(records, false));

