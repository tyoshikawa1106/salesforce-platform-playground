// Run: sf apex run --file scripts/apex/standard-objects/repair-standard-emails.apex --target-org <alias>
String seedPrefix = '[TEST]';
String seedLike = seedPrefix + '%';

String testEmail(Integer sequence) {
    return 'test+' + String.valueOf(sequence).leftPad(4, '0') + '@example.com';
}

void putIfUpdateable(SObject record, String fieldName, Object value) {
    Map<String, Schema.SObjectField> fields = record.getSObjectType()
        .getDescribe()
        .fields.getMap();
    if (
        value != null &&
        fields.containsKey(fieldName) &&
        fields.get(fieldName).getDescribe().isUpdateable()
    ) {
        record.put(fieldName, value);
    }
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

List<Contact> contacts = [
    SELECT Id
    FROM Contact
    WHERE LastName LIKE :seedLike
    ORDER BY CreatedDate ASC, Id ASC
    LIMIT 10000
];
List<Contact> contactUpdates = new List<Contact>();
for (Integer i = 0; i < contacts.size(); i += 1) {
    contactUpdates.add(
        new Contact(Id = contacts[i].Id, Email = testEmail(i + 1))
    );
}
if (!contactUpdates.isEmpty()) {
    update contactUpdates;
}

List<Lead> leads = [
    SELECT Id
    FROM Lead
    WHERE LastName LIKE :seedLike
    ORDER BY CreatedDate ASC, Id ASC
    LIMIT 10000
];
List<Lead> leadUpdates = new List<Lead>();
for (Integer i = 0; i < leads.size(); i += 1) {
    leadUpdates.add(new Lead(Id = leads[i].Id, Email = testEmail(i + 1)));
}
if (!leadUpdates.isEmpty()) {
    update leadUpdates;
}

List<Case> cases = [
    SELECT Id
    FROM Case
    WHERE Subject LIKE :seedLike
    ORDER BY CreatedDate ASC, Id ASC
    LIMIT 10000
];
List<Case> caseUpdates = new List<Case>();
for (Integer i = 0; i < cases.size(); i += 1) {
    caseUpdates.add(
        new Case(Id = cases[i].Id, SuppliedEmail = testEmail(i + 1))
    );
}
if (!caseUpdates.isEmpty()) {
    update caseUpdates;
}

Integer deletedEmailMessageCount = 0;
Integer createdEmailMessageCount = 0;
Map<String, Schema.SObjectType> gd = Schema.getGlobalDescribe();
if (gd.containsKey('EmailMessage')) {
    List<SObject> emailMessages = Database.query(
        'SELECT Id FROM EmailMessage WHERE Subject LIKE :seedLike ORDER BY CreatedDate ASC, Id ASC LIMIT 10000'
    );
    if (!emailMessages.isEmpty()) {
        Database.DeleteResult[] deleteResults = Database.delete(
            emailMessages,
            false
        );
        for (Database.DeleteResult result : deleteResults) {
            if (result.isSuccess()) {
                deletedEmailMessageCount += 1;
            }
        }
    }

    if (gd.get('EmailMessage').getDescribe().isCreateable()) {
        List<Case> emailCases = [
            SELECT Id
            FROM Case
            WHERE Subject LIKE :seedLike
            ORDER BY CreatedDate ASC, Id ASC
            LIMIT 10000
        ];
        List<SObject> newEmailMessages = new List<SObject>();
        for (Integer i = 0; i < emailCases.size(); i += 1) {
            Integer sequence = i + 1;
            SObject email = gd.get('EmailMessage').newSObject();
            putIfCreateable(email, 'ParentId', emailCases[i].Id);
            putIfCreateable(email, 'RelatedToId', emailCases[i].Id);
            putIfCreateable(
                email,
                'Subject',
                seedPrefix + ' お問い合わせ内容の確認'
            );
            putIfCreateable(email, 'FromAddress', testEmail(sequence));
            putIfCreateable(email, 'ToAddress', testEmail(sequence));
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
            newEmailMessages.add(email);
        }

        Database.SaveResult[] results = Database.insert(
            newEmailMessages,
            false
        );
        for (Database.SaveResult result : results) {
            if (result.isSuccess()) {
                createdEmailMessageCount += 1;
            }
        }
    }
}

System.debug('Updated records: Contact Email: ' + contactUpdates.size());
System.debug('Updated records: Lead Email: ' + leadUpdates.size());
System.debug('Updated records: Case SuppliedEmail: ' + caseUpdates.size());
System.debug('Deleted records: EmailMessage: ' + deletedEmailMessageCount);
System.debug('Created records: EmailMessage: ' + createdEmailMessageCount);
