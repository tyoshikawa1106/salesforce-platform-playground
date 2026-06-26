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
        System.debug(
            'Skipped records: ' + objectName + ': ' + String.join(errors, ' / ')
        );
    }
}

List<Contact> contacts = [
    SELECT Id
    FROM Contact
    WHERE LastName LIKE :seedLike
    ORDER BY CreatedDate DESC
    LIMIT :countPerObject
];
if (contacts.isEmpty()) {
    System.assert(
        false,
        'Run standard-objects-contacts-leads before campaigns and products.'
    );
}

String campaignType = pick(
    Campaign.Type.getDescribe(),
    new List<String>{ 'Webinar', 'Email', 'Conference' }
);
String campaignStatus = pick(
    Campaign.Status.getDescribe(),
    new List<String>{ 'In Progress', 'Planned', 'Completed' }
);
String memberStatus = pick(
    CampaignMember.Status.getDescribe(),
    new List<String>{ 'Sent', 'Responded' }
);
String productFamily = pick(
    Product2.Family.getDescribe(),
    new List<String>{ 'Software', 'Hardware', 'Services' }
);
String quantityUnit = pick(
    Product2.QuantityUnitOfMeasure.getDescribe(),
    new List<String>{ 'Each', 'Hours' }
);

List<String> campaignNames = new List<String>{
    '春の営業改革ウェビナー',
    '製造業向け保守契約セミナー',
    '小売店舗DX相談会',
    '顧客サポート高度化キャンペーン',
    '経営ダッシュボード体験会',
    'フィールドサービス個別相談',
    '夏季ユーザー会',
    '既存顧客アップセル施策',
    '新規リード育成メール',
    'パートナー共催商談創出',
    '公共向け業務改善勉強会',
    'ヘルスケアCRM活用セミナー',
    '金融業界向けオンライン展示会',
    '受注管理標準化ワークショップ',
    'アフターサービス改善相談会',
    '営業マネージャー向け朝会',
    '地域顧客訪問キャンペーン',
    '価格改定フォローアップ',
    '契約更新促進キャンペーン',
    '年末重点商談レビュー'
};
List<String> productNames = new List<String>{
    '営業活動可視化パッケージ',
    '顧客問い合わせ管理テンプレート',
    '保守契約更新支援サービス',
    'フィールド作業管理スターター',
    '商品マスタ整備アドオン',
    '注文プロセス標準化キット',
    'ダッシュボード設計ワークショップ',
    'データ移行支援チケット',
    '営業部門オンボーディング',
    'サポート品質分析レポート',
    'モバイル作業報告ライセンス',
    'ナレッジ整備コンサルティング',
    '見積承認フロー設計',
    '顧客360ビュー設定支援',
    '契約管理運用レビュー',
    'キャンペーン効果測定セット',
    '代理店管理スターター',
    'サービスKPI改善パック',
    '商談レビュー自動化支援',
    '年間活用定着プラン'
};

List<Campaign> campaigns = new List<Campaign>();
List<Product2> products = new List<Product2>();
List<Pricebook2> pricebooks = new List<Pricebook2>();
for (Integer i = 1; i <= countPerObject; i += 1) {
    String campaignName = campaignNames[Math.mod(i - 1, campaignNames.size())];
    String productName = productNames[Math.mod(i - 1, productNames.size())];
    campaigns.add(
        new Campaign(
            Name = seedPrefix + ' ' + campaignName,
            Type = campaignType,
            Status = campaignStatus,
            IsActive = true,
            StartDate = Date.today().addDays(i),
            EndDate = Date.today().addDays(30 + i),
            ExpectedRevenue = 2000000 + (i * 100000),
            BudgetedCost = 500000 + (i * 25000),
            ActualCost = 300000 + (i * 20000),
            ExpectedResponse = 10 + i,
            NumberSent = 100 + i,
            Description = campaignName +
                ' の反応率、商談化率、フォロー状況を確認するための合成キャンペーンです。'
        )
    );

    products.add(
        new Product2(
            Name = seedPrefix + ' ' + productName,
            ProductCode = 'CLI-SEED-' + seedRunKey.right(14) + '-' + i,
            Family = productFamily,
            QuantityUnitOfMeasure = quantityUnit,
            IsActive = true,
            Description = productName +
                '。標準の販売・契約・サポートフロー検証に使うテスト商品です。'
        )
    );

    pricebooks.add(
        new Pricebook2(
            Name = seedPrefix + ' ' + productName + ' 価格表',
            IsActive = true,
            Description = productName +
                ' の標準販売価格を確認するためのテスト価格表です。'
        )
    );
}

System.debug('Seed run key: ' + seedRunKey);
Database.SaveResult[] campaignResults = Database.insert(campaigns, false);
Database.SaveResult[] productResults = Database.insert(products, false);
Database.SaveResult[] pricebookResults = Database.insert(pricebooks, false);
logResults('Campaign', campaignResults);
logResults('Product2', productResults);
logResults('Pricebook2', pricebookResults);

List<Campaign> insertedCampaigns = [
    SELECT Id
    FROM Campaign
    WHERE Name LIKE :seedLike
    ORDER BY CreatedDate DESC
    LIMIT :countPerObject
];
List<Product2> insertedProducts = [
    SELECT Id
    FROM Product2
    WHERE Name LIKE :seedLike
    ORDER BY CreatedDate DESC
    LIMIT :countPerObject
];
List<Pricebook2> insertedPricebooks = [
    SELECT Id
    FROM Pricebook2
    WHERE Name LIKE :seedLike
    ORDER BY CreatedDate DESC
    LIMIT :countPerObject
];

Pricebook2 standardPricebook = [
    SELECT Id, IsActive
    FROM Pricebook2
    WHERE IsStandard = TRUE
    LIMIT 1
];
if (!standardPricebook.IsActive) {
    standardPricebook.IsActive = true;
    update standardPricebook;
}

List<CampaignMember> members = new List<CampaignMember>();
List<PricebookEntry> standardEntries = new List<PricebookEntry>();
List<PricebookEntry> customEntries = new List<PricebookEntry>();
for (Integer i = 1; i <= countPerObject; i += 1) {
    Campaign campaign = insertedCampaigns[
        Math.mod(i - 1, insertedCampaigns.size())
    ];
    Contact contact = contacts[Math.mod(i - 1, contacts.size())];
    Product2 product = insertedProducts[
        Math.mod(i - 1, insertedProducts.size())
    ];
    Pricebook2 pricebook = insertedPricebooks[
        Math.mod(i - 1, insertedPricebooks.size())
    ];

    members.add(
        new CampaignMember(
            CampaignId = campaign.Id,
            ContactId = contact.Id,
            Status = memberStatus
        )
    );
    standardEntries.add(
        new PricebookEntry(
            Pricebook2Id = standardPricebook.Id,
            Product2Id = product.Id,
            UnitPrice = 10000 + (i * 500),
            IsActive = true
        )
    );
    customEntries.add(
        new PricebookEntry(
            Pricebook2Id = pricebook.Id,
            Product2Id = product.Id,
            UnitPrice = 12000 + (i * 500),
            IsActive = true,
            UseStandardPrice = false
        )
    );
}

logResults('CampaignMember', Database.insert(members, false));
logResults('Standard PricebookEntry', Database.insert(standardEntries, false));
logResults('PricebookEntry', Database.insert(customEntries, false));
