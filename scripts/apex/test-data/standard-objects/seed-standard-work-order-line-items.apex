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
List<SObject> workOrders = gd.containsKey('WorkOrder') ? Database.query('SELECT Id, AccountId FROM WorkOrder WHERE Subject LIKE :seedLike ORDER BY CreatedDate ASC LIMIT :parentPoolSize') : new List<SObject>();
List<Asset> assets = [SELECT Id FROM Asset WHERE Name LIKE :seedLike ORDER BY CreatedDate ASC LIMIT :parentPoolSize];
if (workOrders.isEmpty() || assets.isEmpty()) {
    System.assert(false, 'Run work orders and assets before work order line items.');
}

System.debug('Seed run key: ' + seedRunKey);
if (gd.containsKey('WorkOrderLineItem') && gd.get('WorkOrderLineItem').getDescribe().isCreateable()) {
    Map<String, Schema.SObjectField> fields = gd.get('WorkOrderLineItem').getDescribe().fields.getMap();
    String status = fields.containsKey('Status') ? pick(fields.get('Status').getDescribe(), new List<String>{ 'New', 'Open' }) : null;
    List<SObject> records = new List<SObject>();
    for (Integer i = 1; i <= countPerObject; i += 1) {
        SObject record = gd.get('WorkOrderLineItem').newSObject();
        putIfCreateable(record, 'Subject', seedPrefix + ' 権限と通知設定の確認');
        putIfCreateable(record, 'WorkOrderId', workOrders[Math.mod(i - 1, workOrders.size())].Id);
        putIfCreateable(record, 'AssetId', assets[Math.mod(i - 1, assets.size())].Id);
        putIfCreateable(record, 'Status', status);
        putIfCreateable(record, 'Description', '作業指示明細。');
        records.add(record);
    }
    logResults('WorkOrderLineItem', Database.insert(records, false));
} else {
    System.debug('Skipped records: WorkOrderLineItem: object is not createable or not available');
}

