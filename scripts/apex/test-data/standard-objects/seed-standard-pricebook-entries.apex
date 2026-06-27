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

Map<String, Decimal> pricesByCode = new Map<String, Decimal>{ 'NB-001' => 168000, 'DT-001' => 108000, 'MN-001' => 32000, 'KB-001' => 7800, 'DK-001' => 24000, 'PR-001' => 48000, 'NW-001' => 28000, 'VC-001' => 22000, 'OF-001' => 42000, 'SW-001' => 12000 };
Set<String> productCodes = pricesByCode.keySet();
List<Product2> products = [SELECT Id, ProductCode FROM Product2 WHERE ProductCode IN :productCodes ORDER BY ProductCode ASC];
if (products.isEmpty()) {
    System.assert(false, 'Run standard-objects-products before pricebook entries.');
}

Pricebook2 standardPricebook = [SELECT Id, IsActive FROM Pricebook2 WHERE IsStandard = TRUE LIMIT 1];
if (!standardPricebook.IsActive) { standardPricebook.IsActive = true; update standardPricebook; }
Map<Id, PricebookEntry> existingByProductId = new Map<Id, PricebookEntry>();
Set<Id> productIds = new Set<Id>();
for (Product2 product : products) {
    productIds.add(product.Id);
}
for (PricebookEntry entry : [SELECT Id, Product2Id, UnitPrice, IsActive FROM PricebookEntry WHERE Pricebook2Id = :standardPricebook.Id AND Product2Id IN :productIds]) {
    existingByProductId.put(entry.Product2Id, entry);
}
List<PricebookEntry> inserts = new List<PricebookEntry>();
List<PricebookEntry> updates = new List<PricebookEntry>();
for (Product2 product : products) {
    PricebookEntry entry = existingByProductId.get(product.Id);
    if (entry == null) {
        inserts.add(new PricebookEntry(Pricebook2Id = standardPricebook.Id, Product2Id = product.Id, UnitPrice = pricesByCode.get(product.ProductCode), IsActive = true));
    } else {
        entry.UnitPrice = pricesByCode.get(product.ProductCode);
        entry.IsActive = true;
        updates.add(entry);
    }
}
System.debug('Seed run key: ' + seedRunKey);
logResults('PricebookEntry insert', Database.insert(inserts, false));
logResults('PricebookEntry update', Database.update(updates, false));
