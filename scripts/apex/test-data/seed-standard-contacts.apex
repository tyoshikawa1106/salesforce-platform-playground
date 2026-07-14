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

List<Account> accounts = [SELECT Id FROM Account WHERE Name LIKE :seedLike ORDER BY CreatedDate DESC LIMIT :countPerObject];
if (accounts.isEmpty()) {
    System.assert(false, 'Run standard-objects-accounts before contacts.');
}

String leadSource = pick(Contact.LeadSource.getDescribe(), new List<String>{ 'Web', 'Phone Inquiry', 'Purchased List' });
List<String> familyNames = new List<String>{ '佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤' };
List<String> givenNames = new List<String>{ '葵', '蓮', '陽菜', '悠真', '結衣', '湊', '美咲', '大翔', '莉子', '颯太' };
List<String> departments = new List<String>{ '営業企画部', '情報システム部', 'カスタマーサクセス部', '経営企画部', '購買部' };
List<String> titles = new List<String>{ '部長', '課長', 'マネージャー', '主任', 'プロジェクトリーダー' };
Database.DMLOptions options = new Database.DMLOptions();
options.DuplicateRuleHeader.allowSave = true;
options.optAllOrNone = false;
Integer existingCount = [SELECT COUNT() FROM Contact WHERE LastName LIKE :seedLike];
List<Contact> records = new List<Contact>();
for (Integer i = 1; i <= countPerObject; i += 1) {
    Integer sequence = existingCount + i;
    String familyName = familyNames[Math.mod(sequence - 1, familyNames.size())];
    String givenName = givenNames[Math.mod((sequence - 1) / familyNames.size(), givenNames.size())];
    records.add(new Contact(
        AccountId = accounts[Math.mod(i - 1, accounts.size())].Id,
        FirstName = givenName,
        LastName = seedPrefix + ' ' + familyName,
        Title = departments[Math.mod(i - 1, departments.size())] + ' ' + titles[Math.mod(i - 1, titles.size())],
        Department = departments[Math.mod(i - 1, departments.size())],
        Email = testEmail(sequence),
        Phone = '03-5555-' + String.valueOf(3000 + Math.mod(sequence, 7000)).leftPad(4, '0'),
        MobilePhone = '090-5555-' + String.valueOf(3000 + Math.mod(sequence, 7000)).leftPad(4, '0'),
        LeadSource = leadSource,
        MailingStreet = '八重洲 ' + i + '-3-' + Math.mod(i + 1, 9),
        MailingCity = '中央区',
        MailingPostalCode = '104-' + String.valueOf(1000 + i),
        Description = '四半期レビューと導入拡大の相談窓口。'
    ));
}
System.debug('Seed run key: ' + seedRunKey);
logResults('Contact', Database.insert(records, options));

