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

List<Campaign> campaigns = [SELECT Id FROM Campaign WHERE Name LIKE '[TEST] 20%' ORDER BY StartDate ASC LIMIT 2000];
List<Contact> contacts = [SELECT Id FROM Contact WHERE LastName LIKE :seedLike ORDER BY CreatedDate ASC LIMIT 2000];
if (campaigns.isEmpty() || contacts.isEmpty()) {
    System.assert(false, 'Run campaigns and contacts before campaign members.');
}

String memberStatus = pick(CampaignMember.Status.getDescribe(), new List<String>{ 'Sent', 'Responded' });
Set<Id> campaignIds = new Set<Id>();
Set<Id> contactIds = new Set<Id>();
for (Campaign campaign : campaigns) { campaignIds.add(campaign.Id); }
for (Contact contact : contacts) { contactIds.add(contact.Id); }
Set<String> existingKeys = new Set<String>();
for (CampaignMember member : [SELECT CampaignId, ContactId FROM CampaignMember WHERE CampaignId IN :campaignIds AND ContactId IN :contactIds]) {
    existingKeys.add(member.CampaignId + '-' + member.ContactId);
}
List<CampaignMember> records = new List<CampaignMember>();
for (Integer i = 0; i < campaigns.size(); i += 1) {
    Contact contact = contacts[Math.mod(i, contacts.size())];
    String key = campaigns[i].Id + '-' + contact.Id;
    if (!existingKeys.contains(key)) {
        records.add(new CampaignMember(CampaignId = campaigns[i].Id, ContactId = contact.Id, Status = memberStatus));
    }
}
System.debug('Seed run key: ' + seedRunKey);
logResults('CampaignMember', Database.insert(records, false));

