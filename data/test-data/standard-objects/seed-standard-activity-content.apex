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

void putIfCreateable(SObject record, String fieldName, Object value) {
    Map<String, Schema.SObjectField> fields = record.getSObjectType()
        .getDescribe()
        .fields.getMap();
    if (
        value != null &&
        fields.containsKey(fieldName) &&
        fields.get(fieldName).getDescribe().isCreateable()
    ) {
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
        System.debug(
            'Skipped records: ' + objectName + ': ' + String.join(errors, ' / ')
        );
    }
}

Map<String, Schema.SObjectType> gd = Schema.getGlobalDescribe();
Integer existingTaskCount = [
    SELECT COUNT()
    FROM Task
    WHERE Subject LIKE :seedLike
];
List<Account> accounts = [
    SELECT Id
    FROM Account
    WHERE Name LIKE :seedLike
    ORDER BY CreatedDate ASC
    LIMIT :parentPoolSize
];
List<Contact> contacts = [
    SELECT Id
    FROM Contact
    WHERE LastName LIKE :seedLike
    ORDER BY CreatedDate ASC
    LIMIT :parentPoolSize
];
List<Opportunity> opportunities = [
    SELECT Id
    FROM Opportunity
    WHERE Name LIKE :seedLike
    ORDER BY CreatedDate ASC
    LIMIT :parentPoolSize
];
List<Case> cases = [
    SELECT Id
    FROM Case
    WHERE Subject LIKE :seedLike
    ORDER BY CreatedDate ASC
    LIMIT :parentPoolSize
];
if (
    accounts.isEmpty() ||
    contacts.isEmpty() ||
    opportunities.isEmpty() ||
    cases.isEmpty()
) {
    System.assert(
        false,
        'Run previous standard object seed phases before activities and files.'
    );
}

String taskStatus = pick(
    Task.Status.getDescribe(),
    new List<String>{ 'Not Started', 'Open' }
);
String taskPriority = pick(
    Task.Priority.getDescribe(),
    new List<String>{ 'Normal', 'Medium', 'High' }
);
String eventShowAs = pick(
    Event.ShowAs.getDescribe(),
    new List<String>{ 'Busy' }
);

List<String> taskSubjects = new List<String>{
    'Call',
    'Email',
    'Send Letter',
    'Send Quote',
    'Other'
};
List<String> eventSubjects = new List<String>{
    'Call',
    'Email',
    'Meeting',
    'Send Letter/Quete',
    'Other'
};

List<Task> tasks = new List<Task>();
List<Event> events = new List<Event>();
List<ContentVersion> files = new List<ContentVersion>();
List<SObject> emailMessages = new List<SObject>();
for (Integer i = 1; i <= countPerObject; i += 1) {
    Integer sequence = existingTaskCount + i;
    Contact contact = contacts[Math.mod(sequence - 1, contacts.size())];
    Opportunity opportunity = opportunities[
        Math.mod(sequence - 1, opportunities.size())
    ];
    Case supportCase = cases[Math.mod(sequence - 1, cases.size())];
    Account account = accounts[Math.mod(sequence - 1, accounts.size())];

    tasks.add(
        new Task(
            Subject = seedPrefix +
                ' ' +
                taskSubjects[Math.mod(sequence - 1, taskSubjects.size())],
            WhoId = contact.Id,
            WhatId = opportunity.Id,
            Status = taskStatus,
            Priority = taskPriority,
            ActivityDate = Date.today().addDays(Math.mod(sequence, 180)),
            Description = '顧客との次回アクションを追跡するための検証用ToDo。関連商談と担当者の表示を確認します。'
        )
    );
    events.add(
        new Event(
            Subject = seedPrefix +
                ' ' +
                eventSubjects[Math.mod(sequence - 1, eventSubjects.size())],
            WhoId = contact.Id,
            WhatId = opportunity.Id,
            StartDateTime = Datetime.now().addDays(Math.mod(sequence, 180)),
            EndDateTime = Datetime.now()
                .addDays(Math.mod(sequence, 180))
                .addHours(1),
            Location = '東京本社 会議室 ' +
                String.valueOf(Math.mod(sequence, 5) + 1),
            ShowAs = eventShowAs,
            Description = '商談、ケース、契約の進捗確認に使う顧客ミーティング予定。'
        )
    );
    files.add(
        new ContentVersion(
            Title = seedPrefix + ' 提案メモ',
            PathOnClient = 'proposal-note-' +
                String.valueOf(sequence).leftPad(4, '0') +
                '.txt',
            VersionData = Blob.valueOf(
                '提案メモ\n\n顧客課題: 営業活動、問い合わせ、契約更新の情報が分散している。\n次回確認事項: 利用部門、対象ユーザー数、初期導入範囲。\n'
            ),
            FirstPublishLocationId = account.Id,
            ContentLocation = 'S',
            Description = '商談や取引先に紐づく提案メモの表示確認に使うテストファイル。'
        )
    );

    if (
        gd.containsKey('EmailMessage') &&
        gd.get('EmailMessage').getDescribe().isCreateable()
    ) {
        SObject email = gd.get('EmailMessage').newSObject();
        putIfCreateable(email, 'ParentId', supportCase.Id);
        putIfCreateable(email, 'RelatedToId', supportCase.Id);
        putIfCreateable(
            email,
            'Subject',
            seedPrefix + ' お問い合わせ内容の確認'
        );
        putIfCreateable(
            email,
            'FromAddress',
            'support+' + sequence + '@example.invalid'
        );
        putIfCreateable(
            email,
            'ToAddress',
            'standard.seed.contact+' + sequence + '@example.invalid'
        );
        putIfCreateable(
            email,
            'MessageDate',
            Datetime.now().addDays(-Math.mod(sequence, 180))
        );
        putIfCreateable(email, 'Incoming', false);
        putIfCreateable(email, 'Status', '3');
        putIfCreateable(
            email,
            'TextBody',
            'お問い合わせありがとうございます。状況を確認し、設定内容と再現手順を整理して本日中にご連絡します。'
        );
        putIfCreateable(
            email,
            'HtmlBody',
            '<p>お問い合わせありがとうございます。</p><p>状況を確認し、設定内容と再現手順を整理して本日中にご連絡します。</p>'
        );
        emailMessages.add(email);
    }
}

System.debug('Seed run key: ' + seedRunKey);
logResults('Task', Database.insert(tasks, false));
logResults('Event', Database.insert(events, false));
if (!emailMessages.isEmpty()) {
    logResults('EmailMessage', Database.insert(emailMessages, false));
} else {
    System.debug(
        'Skipped records: EmailMessage: object is not createable or not available'
    );
}
logResults('ContentVersion', Database.insert(files, false));
System.debug(
    'Skipped records: Knowledge: Knowledge article sObject is not available in this scratch org'
);
System.debug(
    'Skipped records: Report: Report is metadata-backed and not inserted by this DML seed script'
);
System.debug(
    'Skipped records: Dashboard: Dashboard is metadata-backed and not inserted by this DML seed script'
);
System.debug(
    'Skipped records: User: extra users require license/profile decisions and are not inserted by this seed script'
);
System.debug(
    'Skipped records: EmailTemplate: no Email folder is available in this scratch org'
);
