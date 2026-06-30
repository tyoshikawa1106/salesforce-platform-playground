// Run: npm run setup:data:standard -- --target-org <alias> --only standard-objects-orders
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
List<Contact> contacts = [SELECT Id, AccountId, FirstName, LastName FROM Contact WHERE LastName LIKE :seedLike ORDER BY CreatedDate ASC LIMIT :parentPoolSize];
List<Opportunity> opportunities = [SELECT Id, AccountId, Pricebook2Id FROM Opportunity WHERE Name LIKE :seedLike ORDER BY CreatedDate ASC LIMIT :parentPoolSize];
List<Campaign> campaigns = [SELECT Id FROM Campaign WHERE Name LIKE '[TEST] 20%' ORDER BY CreatedDate ASC LIMIT :parentPoolSize];
List<PricebookEntry> pricebookEntries = [
    SELECT Id, Pricebook2Id, Product2Id, UnitPrice, Product2.Name, Product2.ProductCode
    FROM PricebookEntry
    WHERE Product2.Name LIKE :seedLike AND Pricebook2.IsStandard = TRUE AND IsActive = TRUE AND Pricebook2.IsActive = TRUE
    ORDER BY CreatedDate ASC
    LIMIT :parentPoolSize
];

List<Contract> contracts = [SELECT Id, AccountId, StartDate FROM Contract WHERE Account.Name LIKE :seedLike ORDER BY CreatedDate ASC LIMIT :parentPoolSize];
if (accounts.isEmpty() || contacts.isEmpty() || contracts.isEmpty() || pricebookEntries.isEmpty()) {
    System.assert(false, 'Run contracts before orders.');
}

Map<Id, List<Contact>> contactsByAccountId = new Map<Id, List<Contact>>();
for (Contact contact : contacts) {
    if (contact.AccountId == null) {
        continue;
    }
    if (!contactsByAccountId.containsKey(contact.AccountId)) {
        contactsByAccountId.put(contact.AccountId, new List<Contact>());
    }
    contactsByAccountId.get(contact.AccountId).add(contact);
}

String status = pick(Order.Status.getDescribe(), new List<String>{ 'Draft' });
List<String> types = new List<String>{ 'New', 'Renewal', 'Add-On' };
Integer existingCount = [SELECT COUNT() FROM Order WHERE Account.Name LIKE :seedLike];
List<Order> records = new List<Order>();
for (Integer i = 1; i <= countPerObject; i += 1) {
    Integer sequence = existingCount + i;
    Contract contract = contracts[Math.mod(sequence - 1, contracts.size())];
    List<Contact> accountContacts = contactsByAccountId.get(contract.AccountId);
    Contact contact = accountContacts == null || accountContacts.isEmpty()
        ? contacts[Math.mod(sequence - 1, contacts.size())]
        : accountContacts[Math.mod(sequence - 1, accountContacts.size())];
    Date effectiveDate = contract.StartDate.addDays(Math.mod(sequence, 30));
    records.add(new Order(AccountId = contract.AccountId, ContractId = contract.Id, BillToContactId = contact.Id, ShipToContactId = contact.Id, Pricebook2Id = pricebookEntries[Math.mod(sequence - 1, pricebookEntries.size())].Pricebook2Id, Type = types[Math.mod(sequence - 1, types.size())], EffectiveDate = effectiveDate, Status = status, Description = '初回導入分の注文。'));
}
System.debug('Seed run key: ' + seedRunKey);
logResults('Order', Database.insert(records, false));
