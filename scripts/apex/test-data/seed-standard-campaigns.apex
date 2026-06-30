// Run: npm run setup:data:standard -- --target-org <alias> --only standard-objects-campaigns
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

String pad2(Integer value) { return String.valueOf(value).leftPad(2, '0'); }
Integer currentYear = Date.today().year();
List<Integer> years = new List<Integer>{ currentYear - 1, currentYear, currentYear + 1 };
List<String> themes = new List<String>{ '新年度オフィス環境準備キャンペーン', 'リモートワーク機器見直しキャンペーン', '会議室アップデートキャンペーン', '新入社員PC配備キャンペーン', 'プリンター・スキャナー更新キャンペーン', 'ネットワーク強化キャンペーン', '夏季オフィス家具リフレッシュキャンペーン', 'セキュリティソフト更新キャンペーン', '下期IT備品標準化キャンペーン', '会議機器まとめ買いキャンペーン', '年末オフィス備品棚卸キャンペーン', '年度末予算消化キャンペーン' };
String typeValue = pick(Campaign.Type.getDescribe(), new List<String>{ 'Email', 'Webinar', 'Conference' });
String planned = pick(Campaign.Status.getDescribe(), new List<String>{ 'Planned', 'In Progress', 'Completed' });
String inProgress = pick(Campaign.Status.getDescribe(), new List<String>{ 'In Progress', 'Planned', 'Completed' });
String completed = pick(Campaign.Status.getDescribe(), new List<String>{ 'Completed', 'In Progress', 'Planned' });
List<String> names = new List<String>();
for (Integer year : years) {
    for (Integer month = 1; month <= 12; month += 1) {
        names.add(seedPrefix + ' ' + year + '年' + pad2(month) + '月 ' + themes[month - 1]);
    }
}
Map<String, Campaign> existingByName = new Map<String, Campaign>();
for (Campaign campaign : [SELECT Id, Name FROM Campaign WHERE Name IN :names]) {
    existingByName.put(campaign.Name, campaign);
}
List<Campaign> inserts = new List<Campaign>();
List<Campaign> updates = new List<Campaign>();
for (Integer index = 0; index < names.size(); index += 1) {
    Integer year = years[index / 12];
    Integer month = 1 + Math.mod(index, 12);
    Date startDate = Date.newInstance(year, month, 1);
    String status = year < currentYear ? completed : (year > currentYear ? planned : inProgress);
    Campaign campaign = existingByName.get(names[index]);
    if (campaign == null) {
        campaign = new Campaign(Name = names[index]);
        inserts.add(campaign);
    } else {
        updates.add(campaign);
    }
    campaign.Type = typeValue;
    campaign.Status = status;
    campaign.IsActive = true;
    campaign.StartDate = startDate;
    campaign.EndDate = startDate.addMonths(1).addDays(-1);
    campaign.ExpectedRevenue = 1500000 + ((index + 1) * 120000);
    campaign.BudgetedCost = 250000 + (month * 15000);
    campaign.Description = year + '年' + month + '月の ' + themes[month - 1] + '。';
}
System.debug('Seed run key: ' + seedRunKey);
logResults('Campaign insert', Database.insert(inserts, false));
logResults('Campaign update', Database.update(updates, false));

