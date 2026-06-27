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
List<Case> cases = [SELECT Id FROM Case WHERE Subject LIKE :seedLike ORDER BY CreatedDate ASC LIMIT :parentPoolSize];
if (cases.isEmpty()) {
    System.assert(false, 'Run cases before email messages.');
}

System.debug('Seed run key: ' + seedRunKey);
if (gd.containsKey('EmailMessage') && gd.get('EmailMessage').getDescribe().isCreateable()) {
    List<SObject> records = new List<SObject>();
    for (Integer i = 1; i <= countPerObject; i += 1) {
        SObject email = gd.get('EmailMessage').newSObject();
        putIfCreateable(email, 'ParentId', cases[Math.mod(i - 1, cases.size())].Id);
        putIfCreateable(email, 'RelatedToId', cases[Math.mod(i - 1, cases.size())].Id);
        putIfCreateable(email, 'Subject', seedPrefix + ' お問い合わせ内容の確認');
        putIfCreateable(email, 'FromAddress', testEmail(i));
        putIfCreateable(email, 'ToAddress', testEmail(i));
        putIfCreateable(email, 'MessageDate', Datetime.now().addDays(-Math.mod(i, 180)));
        putIfCreateable(email, 'Incoming', false);
        putIfCreateable(email, 'Status', '3');
        putIfCreateable(email, 'TextBody', 'お問い合わせありがとうございます。状況を確認します。');
        records.add(email);
    }
    logResults('EmailMessage', Database.insert(records, false));
} else {
    System.debug('Skipped records: EmailMessage: object is not createable or not available');
}

