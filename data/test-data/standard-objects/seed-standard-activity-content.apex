Integer countPerObject = 20;
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

List<String> taskSubjects = new List<String>{
    '次回提案資料の送付',
    '契約更新条件の確認',
    '導入スケジュールの再調整',
    '問い合わせ一次回答のフォロー',
    '価格表の適用範囲確認',
    '部門責任者へのレビュー依頼',
    '作業指示の担当者確認',
    '商品利用数のヒアリング',
    'サポート契約範囲の説明',
    '商談レビューコメントの反映',
    '注文内容の最終確認',
    '請求先住所の確認',
    'キャンペーン反応顧客への連絡',
    'データ移行対象の棚卸し',
    '利用定着ミーティングの調整',
    'ケース回答内容のレビュー',
    '導入後アンケートの送付',
    'レポート項目の追加相談',
    '契約書ドラフトの確認依頼',
    '月次利用状況の共有'
};
List<String> eventSubjects = new List<String>{
    '導入キックオフ',
    '業務要件ヒアリング',
    '価格と契約条件レビュー',
    'サポート運用設計会議',
    '営業マネージャー向けデモ',
    '作業指示フロー確認',
    '月次活用レビュー',
    '問い合わせ分類見直し',
    'データ移行方針確認',
    'キャンペーン効果振り返り',
    '注文管理運用テスト',
    '納品前最終確認',
    '権限設計レビュー',
    'レポート要件確認',
    'ユーザー受入テスト',
    '契約更新前ミーティング',
    'サービス品質改善会議',
    'リード育成施策相談',
    '商談パイプライン確認',
    '本番稼働判定会'
};

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
            Subject = seedPrefix + ' ' + taskSubjects[i - 1],
            WhoId = contact.Id,
            WhatId = opportunity.Id,
            Status = taskStatus,
            Priority = taskPriority,
            ActivityDate = Date.today().addDays(i),
            Description = '顧客との次回アクションを追跡するための検証用ToDo。関連商談と担当者の表示を確認します。'
        )
    );
    events.add(
        new Event(
            Subject = seedPrefix + ' ' + eventSubjects[i - 1],
            WhoId = contact.Id,
            WhatId = opportunity.Id,
            StartDateTime = Datetime.now().addDays(i),
            EndDateTime = Datetime.now().addDays(i).addHours(1),
            Location = '東京本社 会議室 ' + String.valueOf(Math.mod(i, 5) + 1),
            ShowAs = eventShowAs,
            Description = '商談、ケース、契約の進捗確認に使う顧客ミーティング予定。'
        )
    );
    files.add(
        new ContentVersion(
            Title = seedPrefix + ' 提案メモ ' + String.valueOf(i).leftPad(2, '0'),
            PathOnClient = 'proposal-note-' + String.valueOf(i).leftPad(2, '0') + '.txt',
            VersionData = Blob.valueOf('提案メモ\n\n顧客課題: 営業活動、問い合わせ、契約更新の情報が分散している。\n次回確認事項: 利用部門、対象ユーザー数、初期導入範囲。\n'),
            FirstPublishLocationId = account.Id,
            ContentLocation = 'S',
            Description = '商談や取引先に紐づく提案メモの表示確認に使うテストファイル。'
        )
    );

    if (gd.containsKey('EmailMessage') && gd.get('EmailMessage').getDescribe().isCreateable()) {
        SObject email = gd.get('EmailMessage').newSObject();
        putIfCreateable(email, 'ParentId', supportCase.Id);
        putIfCreateable(email, 'RelatedToId', supportCase.Id);
        putIfCreateable(email, 'Subject', seedPrefix + ' お問い合わせ内容の確認 ' + String.valueOf(i).leftPad(2, '0'));
        putIfCreateable(email, 'FromAddress', 'support+' + i + '@example.invalid');
        putIfCreateable(email, 'ToAddress', 'standard.seed.contact+' + i + '@example.invalid');
        putIfCreateable(email, 'MessageDate', Datetime.now().addDays(-i));
        putIfCreateable(email, 'Incoming', false);
        putIfCreateable(email, 'Status', '3');
        putIfCreateable(email, 'TextBody', 'お問い合わせありがとうございます。状況を確認し、設定内容と再現手順を整理して本日中にご連絡します。');
        putIfCreateable(email, 'HtmlBody', '<p>お問い合わせありがとうございます。</p><p>状況を確認し、設定内容と再現手順を整理して本日中にご連絡します。</p>');
        emailMessages.add(email);
    }
}

System.debug('Seed run key: ' + seedRunKey);
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
