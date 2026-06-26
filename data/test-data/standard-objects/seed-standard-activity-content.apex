Integer countPerObject = 20;
String seedPrefix = 'CLI Standard Seed';
String seedKey = seedPrefix + ' ' + Datetime.now().formatGmt('yyyyMMddHHmmss');
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

void putIfCreateable(SObject record, String fieldName, Object value) {
    Map<String, Schema.SObjectField> fields = record.getSObjectType().getDescribe().fields.getMap();
    if (value != null && fields.containsKey(fieldName) && fields.get(fieldName).getDescribe().isCreateable()) {
        record.put(fieldName, value);
    }
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

Map<String, Schema.SObjectType> gd = Schema.getGlobalDescribe();
List<Account> accounts = [SELECT Id FROM Account WHERE Name LIKE :seedLike ORDER BY CreatedDate DESC LIMIT :countPerObject];
List<Contact> contacts = [SELECT Id FROM Contact WHERE LastName LIKE :seedLike ORDER BY CreatedDate DESC LIMIT :countPerObject];
List<Opportunity> opportunities = [SELECT Id FROM Opportunity WHERE Name LIKE :seedLike ORDER BY CreatedDate DESC LIMIT :countPerObject];
List<Case> cases = [SELECT Id FROM Case WHERE Subject LIKE :seedLike ORDER BY CreatedDate DESC LIMIT :countPerObject];
if (accounts.isEmpty() || contacts.isEmpty() || opportunities.isEmpty() || cases.isEmpty()) {
    System.assert(false, 'Run previous standard object seed phases before activities and files.');
}

String taskStatus = pick(Task.Status.getDescribe(), new List<String>{ 'Not Started', 'Open' });
String taskPriority = pick(Task.Priority.getDescribe(), new List<String>{ 'Normal', 'Medium', 'High' });
String eventShowAs = pick(Event.ShowAs.getDescribe(), new List<String>{ 'Busy' });

List<Task> tasks = new List<Task>();
List<Event> events = new List<Event>();
List<ContentVersion> files = new List<ContentVersion>();
List<SObject> emailMessages = new List<SObject>();
for (Integer i = 1; i <= countPerObject; i += 1) {
    Contact contact = contacts[Math.mod(i - 1, contacts.size())];
    Opportunity opportunity = opportunities[Math.mod(i - 1, opportunities.size())];
    Case supportCase = cases[Math.mod(i - 1, cases.size())];
    Account account = accounts[Math.mod(i - 1, accounts.size())];

    tasks.add(
        new Task(
            Subject = seedKey + ' ToDo ' + String.valueOf(i).leftPad(2, '0'),
            WhoId = contact.Id,
            WhatId = opportunity.Id,
            Status = taskStatus,
            Priority = taskPriority,
            ActivityDate = Date.today().addDays(i),
            Description = 'Synthetic task for standard object seed ' + i + '.'
        )
    );
    events.add(
        new Event(
            Subject = seedKey + ' Event ' + String.valueOf(i).leftPad(2, '0'),
            WhoId = contact.Id,
            WhatId = opportunity.Id,
            StartDateTime = Datetime.now().addDays(i),
            EndDateTime = Datetime.now().addDays(i).addHours(1),
            Location = 'Tokyo Meeting Room ' + i,
            ShowAs = eventShowAs,
            Description = 'Synthetic event for standard object seed ' + i + '.'
        )
    );
    files.add(
        new ContentVersion(
            Title = seedKey + ' File ' + String.valueOf(i).leftPad(2, '0'),
            PathOnClient = 'standard-seed-file-' + i + '.txt',
            VersionData = Blob.valueOf('Synthetic file content for standard seed ' + i + '.'),
            FirstPublishLocationId = account.Id,
            ContentLocation = 'S',
            Description = 'Synthetic file for standard object seed ' + i + '.'
        )
    );

    if (gd.containsKey('EmailMessage') && gd.get('EmailMessage').getDescribe().isCreateable()) {
        SObject email = gd.get('EmailMessage').newSObject();
        putIfCreateable(email, 'ParentId', supportCase.Id);
        putIfCreateable(email, 'RelatedToId', supportCase.Id);
        putIfCreateable(email, 'Subject', seedKey + ' Email Message ' + String.valueOf(i).leftPad(2, '0'));
        putIfCreateable(email, 'FromAddress', 'support+' + i + '@example.invalid');
        putIfCreateable(email, 'ToAddress', 'standard.seed.contact+' + i + '@example.invalid');
        putIfCreateable(email, 'MessageDate', Datetime.now().addDays(-i));
        putIfCreateable(email, 'Incoming', false);
        putIfCreateable(email, 'Status', '3');
        putIfCreateable(email, 'TextBody', 'Synthetic email message for standard object seed ' + i + '.');
        putIfCreateable(email, 'HtmlBody', '<p>Synthetic email message for standard object seed ' + i + '.</p>');
        emailMessages.add(email);
    }
}

System.debug('Seed key: ' + seedKey);
logResults('Task', Database.insert(tasks, false));
logResults('Event', Database.insert(events, false));
if (!emailMessages.isEmpty()) {
    logResults('EmailMessage', Database.insert(emailMessages, false));
} else {
    System.debug('Skipped records: EmailMessage: object is not createable or not available');
}
logResults('ContentVersion', Database.insert(files, false));
System.debug('Skipped records: Knowledge: Knowledge article sObject is not available in this scratch org');
System.debug('Skipped records: Report: Report is metadata-backed and not inserted by this DML seed script');
System.debug('Skipped records: Dashboard: Dashboard is metadata-backed and not inserted by this DML seed script');
System.debug('Skipped records: User: extra users require license/profile decisions and are not inserted by this seed script');
System.debug('Skipped records: EmailTemplate: no Email folder is available in this scratch org');
