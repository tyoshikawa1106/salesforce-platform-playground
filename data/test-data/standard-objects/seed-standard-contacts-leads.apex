Integer countPerObject = 50;
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

List<Account> accounts = [
    SELECT Id
    FROM Account
    WHERE Name LIKE :seedLike
    ORDER BY CreatedDate DESC
    LIMIT :countPerObject
];
if (accounts.isEmpty()) {
    System.assert(false, 'Run standard-objects-accounts before contacts and leads.');
}

String contactLeadSource = pick(Contact.LeadSource.getDescribe(), new List<String>{ 'Web', 'Phone Inquiry', 'Purchased List' });
String leadStatus = pick(Lead.Status.getDescribe(), new List<String>{ 'Open - Not Contacted', 'Working - Contacted', 'New' });
String leadSource = pick(Lead.LeadSource.getDescribe(), new List<String>{ 'Web', 'Phone Inquiry', 'Purchased List' });
String leadRating = pick(Lead.Rating.getDescribe(), new List<String>{ 'Warm', 'Hot', 'Cold' });
String leadIndustry = pick(Lead.Industry.getDescribe(), new List<String>{ 'Technology', 'Consulting', 'Manufacturing' });

List<String> familyNames = new List<String>{ '佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田', '佐々木', '山口', '松本', '井上', '木村', '林', '清水', '山崎' };
List<String> givenNames = new List<String>{ '葵', '蓮', '陽菜', '悠真', '結衣', '湊', '美咲', '大翔', '莉子', '颯太', '彩乃', '陽太', '真央', '拓海', '琴音', '直樹', '遥', '健太', '紗季', '亮' };
List<String> departments = new List<String>{ '営業企画部', '情報システム部', 'カスタマーサクセス部', '経営企画部', '購買部' };
List<String> contactTitles = new List<String>{ '部長', '課長', 'マネージャー', '主任', 'プロジェクトリーダー' };
List<String> prospectCompanies = new List<String>{ '晴海データサービス', '赤坂マーケットリサーチ', '品川サブスクリプションズ', '池袋スマート店舗', '豊洲サプライチェーン', '恵比寿ワークプレイス', '中野ヘルステック', '立川教育プラットフォーム', '川崎インダストリアル', '浦和ファイナンス' };

Database.DMLOptions duplicateRuleOptions = new Database.DMLOptions();
duplicateRuleOptions.DuplicateRuleHeader.allowSave = true;
duplicateRuleOptions.optAllOrNone = false;

List<Contact> contacts = new List<Contact>();
List<Lead> leads = new List<Lead>();
Integer existingContactCount = [SELECT COUNT() FROM Contact WHERE LastName LIKE :seedLike];
Integer existingLeadCount = [SELECT COUNT() FROM Lead WHERE LastName LIKE :seedLike];
for (Integer i = 1; i <= countPerObject; i += 1) {
    Account account = accounts[Math.mod(i - 1, accounts.size())];
    Integer contactSequence = existingContactCount + i;
    Integer leadSequence = existingLeadCount + i;
    String paddedContactSequence = String.valueOf(contactSequence).leftPad(4, '0');
    String paddedLeadSequence = String.valueOf(leadSequence).leftPad(4, '0');
    String familyName = familyNames[Math.mod(contactSequence - 1, familyNames.size())] + paddedContactSequence;
    String givenName = givenNames[Math.mod(contactSequence - 1, givenNames.size())];
    String department = departments[Math.mod(i - 1, departments.size())];
    String contactTitle = contactTitles[Math.mod(i - 1, contactTitles.size())];
    String prospectCompany = prospectCompanies[Math.mod(leadSequence - 1, prospectCompanies.size())] + ' ' + paddedLeadSequence;
    contacts.add(
        new Contact(
            AccountId = account.Id,
            FirstName = givenName,
            LastName = seedPrefix + ' ' + familyName,
            Title = department + ' ' + contactTitle,
            Department = department,
            Email = 'standard.seed.contact+' + paddedContactSequence + '@example.invalid',
            Phone = '03-5555-' + String.valueOf(3000 + Math.mod(contactSequence, 7000)).leftPad(4, '0'),
            MobilePhone = '090-5555-' + String.valueOf(3000 + Math.mod(contactSequence, 7000)).leftPad(4, '0'),
            Fax = '03-5555-' + String.valueOf(4000 + Math.mod(contactSequence, 6000)).leftPad(4, '0'),
            LeadSource = contactLeadSource,
            MailingStreet = '八重洲 ' + i + '-3-' + Math.mod(i + 1, 9),
            MailingCity = '中央区',
            MailingPostalCode = '104-' + String.valueOf(1000 + i),
            OtherStreet = '西新宿 ' + i + '-8-' + Math.mod(i + 2, 9),
            OtherCity = '新宿区',
            OtherPostalCode = '160-' + String.valueOf(1000 + i),
            AssistantName = '秘書 ' + givenNames[Math.mod(i + 2, givenNames.size())],
            AssistantPhone = '03-5555-' + String.valueOf(5000 + i),
            Description = '四半期レビューと導入拡大の相談窓口。関心領域は営業プロセスの可視化と問い合わせ対応の効率化。'
        )
    );

    leads.add(
        new Lead(
            FirstName = givenNames[Math.mod(leadSequence + 4, givenNames.size())],
            LastName = seedPrefix + ' ' + familyNames[Math.mod(leadSequence + 5, familyNames.size())] + paddedLeadSequence,
            Company = seedPrefix + ' ' + prospectCompany,
            Title = '業務改善プロジェクト責任者',
            Status = leadStatus,
            Rating = leadRating,
            Industry = leadIndustry,
            LeadSource = leadSource,
            Email = 'standard.seed.lead+' + paddedLeadSequence + '@example.invalid',
            Phone = '03-5555-' + String.valueOf(6000 + Math.mod(leadSequence, 4000)).leftPad(4, '0'),
            MobilePhone = '080-5555-' + String.valueOf(6000 + Math.mod(leadSequence, 4000)).leftPad(4, '0'),
            Fax = '03-5555-' + String.valueOf(7000 + Math.mod(leadSequence, 3000)).leftPad(4, '0'),
            Website = 'https://example.invalid/seed/lead-' + paddedLeadSequence,
            Street = '桜丘町 ' + i + '-6-' + Math.mod(i + 3, 9),
            City = '渋谷区',
            PostalCode = '150-' + String.valueOf(1000 + i),
            NumberOfEmployees = 40 + i,
            AnnualRevenue = 30000000 + (i * 750000),
            Description = 'Webinar 参加後、部門横断の商談管理とサポート履歴の一元化について情報収集中。'
        )
    );
}

System.debug('Seed run key: ' + seedRunKey);
logResults('Contact', Database.insert(contacts, duplicateRuleOptions));
logResults('Lead', Database.insert(leads, duplicateRuleOptions));
