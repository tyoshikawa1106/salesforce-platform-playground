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

String leadStatus = pick(Lead.Status.getDescribe(), new List<String>{ 'Open - Not Contacted', 'Working - Contacted', 'New' });
String leadSource = pick(Lead.LeadSource.getDescribe(), new List<String>{ 'Web', 'Phone Inquiry', 'Purchased List' });
String leadRating = pick(Lead.Rating.getDescribe(), new List<String>{ 'Warm', 'Hot', 'Cold' });
String leadIndustry = pick(Lead.Industry.getDescribe(), new List<String>{ 'Technology', 'Consulting', 'Manufacturing' });
List<String> familyNames = new List<String>{ '佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤' };
List<String> givenNames = new List<String>{ '葵', '蓮', '陽菜', '悠真', '結衣', '湊', '美咲', '大翔', '莉子', '颯太' };
List<String> companies = new List<String>{ '晴海データサービス', '赤坂マーケットリサーチ', '品川サブスクリプションズ', '池袋スマート店舗', '豊洲サプライチェーン' };
Database.DMLOptions options = new Database.DMLOptions();
options.DuplicateRuleHeader.allowSave = true;
options.optAllOrNone = false;
Integer existingCount = [SELECT COUNT() FROM Lead WHERE LastName LIKE :seedLike];
List<Lead> records = new List<Lead>();
for (Integer i = 1; i <= countPerObject; i += 1) {
    Integer sequence = existingCount + i;
    records.add(new Lead(
        FirstName = givenNames[Math.mod(sequence - 1, givenNames.size())],
        LastName = seedPrefix + ' ' + familyNames[Math.mod(sequence - 1, familyNames.size())],
        Company = seedPrefix + ' ' + companies[Math.mod(sequence - 1, companies.size())],
        Title = '業務改善プロジェクト責任者',
        Status = leadStatus,
        Rating = leadRating,
        Industry = leadIndustry,
        LeadSource = leadSource,
        Email = testEmail(sequence),
        Phone = '03-5555-' + String.valueOf(6000 + Math.mod(sequence, 4000)).leftPad(4, '0'),
        Website = 'https://example.com',
        Street = '桜丘町 ' + i + '-6-' + Math.mod(i + 3, 9),
        City = '渋谷区',
        PostalCode = '150-' + String.valueOf(1000 + i),
        NumberOfEmployees = 40 + i,
        AnnualRevenue = 30000000 + (i * 750000),
        Description = '部門横断の商談管理とサポート履歴の一元化について情報収集中。'
    ));
}
System.debug('Seed run key: ' + seedRunKey);
logResults('Lead', Database.insert(records, options));

