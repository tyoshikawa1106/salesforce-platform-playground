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

String pickAt(
    Schema.DescribeFieldResult fieldDescribe,
    List<String> preferred,
    Integer index
) {
    List<String> candidates = new List<String>();
    List<Schema.PicklistEntry> entries = fieldDescribe.getPicklistValues();
    for (String value : preferred) {
        for (Schema.PicklistEntry entry : entries) {
            if (entry.isActive() && entry.getValue() == value) {
                candidates.add(entry.getValue());
                break;
            }
        }
    }
    for (Schema.PicklistEntry entry : entries) {
        if (entry.isActive() && !candidates.contains(entry.getValue())) {
            candidates.add(entry.getValue());
        }
    }
    if (candidates.isEmpty()) {
        return null;
    }
    return candidates[Math.mod(index, candidates.size())];
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

Integer existingOpportunityCount = [
    SELECT COUNT()
    FROM Opportunity
    WHERE Name LIKE :seedLike
];
List<Account> accounts = [
    SELECT Id, Name
    FROM Account
    WHERE Name LIKE :seedLike
    ORDER BY CreatedDate ASC
    LIMIT :parentPoolSize
];
List<Contact> contacts = [
    SELECT Id, FirstName, LastName
    FROM Contact
    WHERE LastName LIKE :seedLike
    ORDER BY CreatedDate ASC
    LIMIT :parentPoolSize
];
List<Campaign> campaigns = [
    SELECT Id
    FROM Campaign
    WHERE Name LIKE '[TEST] 20%'
    ORDER BY CreatedDate ASC
    LIMIT :parentPoolSize
];
List<Product2> products = [
    SELECT Id, Name
    FROM Product2
    WHERE
        Name LIKE :seedLike
        AND (ProductCode LIKE 'NB-%'
        OR ProductCode LIKE 'DT-%'
        OR ProductCode LIKE 'MN-%'
        OR ProductCode LIKE 'KB-%'
        OR ProductCode LIKE 'DK-%'
        OR ProductCode LIKE 'PR-%'
        OR ProductCode LIKE 'NW-%'
        OR ProductCode LIKE 'VC-%'
        OR ProductCode LIKE 'OF-%'
        OR ProductCode LIKE 'SW-%')
    ORDER BY CreatedDate ASC
    LIMIT :parentPoolSize
];
List<PricebookEntry> pricebookEntries = [
    SELECT
        Id,
        Pricebook2Id,
        Product2Id,
        UnitPrice,
        Product2.Name,
        Product2.ProductCode,
        Product2.Family
    FROM PricebookEntry
    WHERE
        Product2.Name LIKE :seedLike
        AND (Product2.ProductCode LIKE 'NB-%'
        OR Product2.ProductCode LIKE 'DT-%'
        OR Product2.ProductCode LIKE 'MN-%'
        OR Product2.ProductCode LIKE 'KB-%'
        OR Product2.ProductCode LIKE 'DK-%'
        OR Product2.ProductCode LIKE 'PR-%'
        OR Product2.ProductCode LIKE 'NW-%'
        OR Product2.ProductCode LIKE 'VC-%'
        OR Product2.ProductCode LIKE 'OF-%'
        OR Product2.ProductCode LIKE 'SW-%')
        AND Pricebook2.IsStandard = TRUE
        AND IsActive = TRUE
        AND Pricebook2.IsActive = TRUE
    ORDER BY CreatedDate ASC
    LIMIT :parentPoolSize
];
if (
    accounts.isEmpty() ||
    contacts.isEmpty() ||
    campaigns.isEmpty() ||
    products.isEmpty() ||
    pricebookEntries.isEmpty()
) {
    System.assert(
        false,
        'Run account, contact, campaign, and product phases before sales.'
    );
}

String opportunityStage = pick(
    Opportunity.StageName.getDescribe(),
    new List<String>{ 'Prospecting', 'Qualification', 'Value Proposition' }
);
String opportunityType = pick(
    Opportunity.Type.getDescribe(),
    new List<String>{ 'New Customer', 'Existing Customer - Upgrade' }
);
String opportunityLeadSource = pick(
    Opportunity.LeadSource.getDescribe(),
    new List<String>{ 'Web', 'Phone Inquiry', 'Purchased List' }
);
String opportunityRole = pick(
    OpportunityContactRole.Role.getDescribe(),
    new List<String>{ 'Business User', 'Decision Maker', 'Evaluator' }
);
String contractStatus = pick(
    Contract.Status.getDescribe(),
    new List<String>{ 'Draft' }
);
String contractOwnerExpirationNotice = pick(
    Contract.OwnerExpirationNotice.getDescribe(),
    new List<String>{ '30', '60', '90' }
);
String orderStatus = pick(
    Order.Status.getDescribe(),
    new List<String>{ 'Draft' }
);
String assetStatus = pick(
    Asset.Status.getDescribe(),
    new List<String>{ 'Purchased', 'Installed' }
);
String caseOrigin = pick(
    Case.Origin.getDescribe(),
    new List<String>{ 'Web', 'Phone', 'Email' }
);
String caseStatus = pick(
    Case.Status.getDescribe(),
    new List<String>{ 'New', 'Working', 'Open' }
);
List<String> casePriorityValues = new List<String>{ 'Medium', 'High', 'Low' };
List<String> caseTypeValues = new List<String>{
    'Question',
    'Problem',
    'Feature Request',
    'Other'
};
List<String> caseReasonValues = new List<String>{
    'Installation',
    'Equipment Complexity',
    'Performance',
    'Breakdown',
    'Equipment Design',
    'Feedback',
    'Other'
};

List<String> opportunityNames = new List<String>{
    '東日本営業部 CRM 活用拡大',
    '保守契約更新プロセス標準化',
    '小売店舗問い合わせ管理導入',
    '製造ライン作業指示デジタル化',
    '経営会議向けKPI可視化',
    '顧客サポート履歴統合',
    '代理店商談管理トライアル',
    '受注から納品までの業務改善',
    'フィールドサービス初期展開',
    '契約更新アラート導入',
    '地域営業所レポート整備',
    'ヘルスケア相談履歴管理',
    '金融窓口案件管理刷新',
    '公共案件進捗共有基盤',
    'データ移行と利用定着支援',
    '営業マネージャーダッシュボード',
    'サービス品質分析パッケージ',
    'キャンペーン効果測定改善',
    '商品マスタ整備プロジェクト',
    '年間活用支援契約'
};
List<String> caseSubjects = new List<String>{
    'ノートPCの初期設定方法を確認したい',
    'デスクトップPCの追加メモリ構成を相談したい',
    'モニターの画面ちらつきについて確認したい',
    'ワイヤレスキーボードの接続が不安定',
    'ワイヤレスマウスの交換可否を確認したい',
    'USB-Cドッキングステーションの対応機種を知りたい',
    'レーザープリンターの印字かすれを解消したい',
    '複合機のスキャン保存先を変更したい',
    'Wi-Fiアクセスポイントの増設を相談したい',
    'VPNルーターの設定内容を確認したい',
    '会議用Webカメラの映像が暗い',
    'スピーカーフォンの音声が途切れる',
    '会議室ディスプレイの入力切替を確認したい',
    'オフィスチェアの保証期間を確認したい',
    '昇降デスクの動作音について相談したい',
    'キャビネットの追加鍵を手配したい',
    'CRMライセンスの追加購入を相談したい',
    'Office Suite License の更新時期を確認したい',
    'Endpoint Security License の端末追加を相談したい',
    '納入済みオフィス製品の保守窓口を確認したい'
};
List<String> assetUsageNames = new List<String>{
    '営業部',
    '総務部',
    '経理部',
    '開発部',
    '情報システム部',
    'カスタマーサポート',
    '人事部',
    '役員室',
    '受付',
    '会議室A',
    '大会議室',
    '東京本社',
    '大阪支社',
    '名古屋営業所',
    '福岡サポートセンター',
    '札幌コンタクトセンター'
};
List<String> assetLocations = new List<String>{
    '東京本社',
    '大阪支社',
    '名古屋営業所',
    '福岡サポートセンター',
    '札幌コンタクトセンター',
    '仙台サービス拠点',
    '横浜ショールーム',
    '京都バックオフィス',
    '広島物流センター',
    '那覇リモート拠点'
};
List<String> assetPlans = new List<String>{
    '新入社員配備',
    '部門標準化',
    '会議室更新',
    '拠点増床',
    'リモートワーク対応',
    '保守交換'
};

List<Opportunity> opportunities = new List<Opportunity>();
for (Integer i = 1; i <= countPerObject; i += 1) {
    Integer sequence = existingOpportunityCount + i;
    Account account = accounts[Math.mod(sequence - 1, accounts.size())];
    String cleanAccountName = account.Name.replace(seedPrefix, '').trim();
    String opportunityName = opportunityNames[
        Math.mod(sequence - 1, opportunityNames.size())
    ];
    Integer opportunityPhase =
        1 + Math.mod((sequence - 1) / accounts.size(), 20);
    PricebookEntry entry = pricebookEntries[
        Math.mod(sequence - 1, pricebookEntries.size())
    ];
    opportunities.add(
        new Opportunity(
            Name = seedPrefix +
                ' ' +
                cleanAccountName +
                ' ' +
                opportunityName +
                ' 第' +
                opportunityPhase +
                '期',
            AccountId = account.Id,
            CampaignId = campaigns[Math.mod(sequence - 1, campaigns.size())].Id,
            Pricebook2Id = entry.Pricebook2Id,
            StageName = opportunityStage,
            Type = opportunityType,
            LeadSource = opportunityLeadSource,
            CloseDate = Date.today().addDays(30 + Math.mod(sequence, 180)),
            Amount = 250000 + (sequence * 25000),
            Probability = 40 + Math.mod(sequence, 5) * 10,
            NextStep = '来週の定例で利用部門の要件と導入範囲を確認',
            Description = cleanAccountName +
                ' 向け ' +
                opportunityName +
                ' の検証用商談。提案、価格表、商談商品、注文連携を確認します。'
        )
    );
}

System.debug('Seed run key: ' + seedRunKey);
Database.SaveResult[] opportunityResults = Database.insert(
    opportunities,
    false
);
logResults('Opportunity', opportunityResults);
List<Opportunity> insertedOpportunities = new List<Opportunity>();
for (Integer i = 0; i < opportunityResults.size(); i += 1) {
    if (opportunityResults[i].isSuccess()) {
        opportunities[i].Id = opportunityResults[i].getId();
        insertedOpportunities.add(opportunities[i]);
    }
}
if (insertedOpportunities.isEmpty()) {
    System.assert(false, 'No Opportunity records were inserted.');
}

List<OpportunityContactRole> roles = new List<OpportunityContactRole>();
List<OpportunityLineItem> opportunityLineItems = new List<OpportunityLineItem>();
List<Contract> contracts = new List<Contract>();
List<Order> orders = new List<Order>();
List<Asset> assets = new List<Asset>();
List<Case> cases = new List<Case>();
for (Integer i = 1; i <= countPerObject; i += 1) {
    Integer sequence = existingOpportunityCount + i;
    Account account = accounts[Math.mod(sequence - 1, accounts.size())];
    Contact contact = contacts[Math.mod(sequence - 1, contacts.size())];
    PricebookEntry entry = pricebookEntries[
        Math.mod(sequence - 1, pricebookEntries.size())
    ];
    Product2 product = entry.Product2;
    String cleanProductName = product.Name.replace(seedPrefix, '').trim();
    String productCode = String.isBlank(product.ProductCode)
        ? 'PRD'
        : product.ProductCode;
    Opportunity opportunity = insertedOpportunities[
        Math.mod(i - 1, insertedOpportunities.size())
    ];

    roles.add(
        new OpportunityContactRole(
            OpportunityId = opportunity.Id,
            ContactId = contact.Id,
            Role = opportunityRole,
            IsPrimary = true
        )
    );
    opportunityLineItems.add(
        new OpportunityLineItem(
            OpportunityId = opportunity.Id,
            PricebookEntryId = entry.Id,
            Quantity = 1 + Math.mod(sequence, 4),
            UnitPrice = entry.UnitPrice,
            ServiceDate = Date.today().addDays(10 + Math.mod(sequence, 180)),
            Description = cleanProductName +
                ' を初期導入範囲に含める。商品コード ' +
                productCode +
                ' の価格と数量を確認する検証用明細。'
        )
    );
    contracts.add(
        new Contract(
            AccountId = account.Id,
            Pricebook2Id = entry.Pricebook2Id,
            StartDate = Date.today().addDays(Math.mod(sequence, 180)),
            ContractTerm = 12,
            Status = contractStatus,
            CustomerSignedId = contact.Id,
            CustomerSignedTitle = '部門責任者',
            CustomerSignedDate = Date.today().addDays(Math.mod(sequence, 180)),
            OwnerExpirationNotice = contractOwnerExpirationNotice,
            CompanySignedId = UserInfo.getUserId(),
            CompanySignedDate = Date.today()
                .addDays(Math.mod(sequence, 180))
                .addDays(-3),
            BillingStreet = '大手町 ' +
                sequence +
                '-1-' +
                Math.mod(sequence + 1, 9),
            BillingCity = '千代田区',
            BillingState = '東京都',
            BillingPostalCode = '100-' +
                String.valueOf(2000 + Math.mod(sequence, 8000)),
            BillingCountry = '日本',
            SpecialTerms = 'オフィス製品の標準保守、初期交換対応、ライセンス更新案内を含む。価格表は標準価格表を利用し、請求先住所は契約取引先の本社住所に準拠する。',
            Description = '年間利用契約のドラフト。更新条件、サポート範囲、請求開始日を確認中。'
        )
    );
    orders.add(
        new Order(
            AccountId = account.Id,
            BillToContactId = contact.Id,
            ShipToContactId = contact.Id,
            Pricebook2Id = entry.Pricebook2Id,
            EffectiveDate = Date.today().addDays(Math.mod(sequence, 180)),
            Status = orderStatus,
            BillingStreet = '大手町 ' +
                sequence +
                '-1-' +
                Math.mod(sequence + 1, 9),
            BillingCity = '千代田区',
            BillingPostalCode = '100-' +
                String.valueOf(2000 + Math.mod(sequence, 8000)),
            ShippingStreet = '銀座 ' +
                sequence +
                '-4-' +
                Math.mod(sequence + 2, 9),
            ShippingCity = '中央区',
            ShippingPostalCode = '104-' +
                String.valueOf(2000 + Math.mod(sequence, 8000)),
            Description = '営業部門向け初回導入分の注文。請求先と納品先を分けた検証用データ。'
        )
    );
    String assetUsage = assetUsageNames[
        Math.mod(sequence - 1, assetUsageNames.size())
    ];
    String assetLocation = assetLocations[
        Math.mod(sequence + 2, assetLocations.size())
    ];
    String assetPlan = assetPlans[Math.mod(sequence + 4, assetPlans.size())];
    Date assetPurchaseDate = Date.today()
        .addDays(-60 - Math.mod(sequence, 210));
    Date assetInstallDate = assetPurchaseDate.addDays(
        7 + Math.mod(sequence, 21)
    );
    Date assetUsageEndDate = assetInstallDate.addDays(
        365 + Math.mod(sequence, 180)
    );
    assets.add(
        new Asset(
            Name = seedPrefix +
                ' ' +
                cleanProductName +
                '（' +
                assetUsage +
                '）',
            AccountId = account.Id,
            ContactId = contact.Id,
            Product2Id = product.Id,
            Status = assetStatus,
            Quantity = 1 + Math.mod(sequence + 1, 5),
            Price = entry.UnitPrice,
            PurchaseDate = assetPurchaseDate,
            InstallDate = assetInstallDate,
            UsageEndDate = assetUsageEndDate,
            SerialNumber = productCode +
                '-' +
                seedRunKey.right(8) +
                '-' +
                String.valueOf(100000 + sequence),
            Description = assetLocation +
                ' の ' +
                assetUsage +
                ' に導入済みの ' +
                cleanProductName +
                '。' +
                assetPlan +
                ' として、契約更新、保守対応、作業指示連携の確認に使用。'
        )
    );
    cases.add(
        new Case(
            Subject = seedPrefix +
                ' ' +
                caseSubjects[Math.mod(sequence - 1, caseSubjects.size())],
            AccountId = account.Id,
            ContactId = contact.Id,
            Type = pickAt(Case.Type.getDescribe(), caseTypeValues, sequence),
            Origin = caseOrigin,
            Status = caseStatus,
            Priority = pickAt(
                Case.Priority.getDescribe(),
                casePriorityValues,
                sequence
            ),
            Reason = pickAt(
                Case.Reason.getDescribe(),
                caseReasonValues,
                sequence
            ),
            SuppliedName = contact.LastName.replace(seedPrefix, '').trim() +
                ' ' +
                contact.FirstName,
            SuppliedEmail = 'standard.seed.case+' +
                sequence +
                '@example.invalid',
            SuppliedPhone = '03-5555-' +
                String.valueOf(8000 + Math.mod(sequence, 1000)),
            SuppliedCompany = account.Name.replace(seedPrefix, '').trim(),
            Description = account.Name.replace(seedPrefix, '').trim() +
                ' の ' +
                contact.LastName.replace(seedPrefix, '').trim() +
                ' ' +
                contact.FirstName +
                ' 様から、' +
                cleanProductName +
                ' に関する問い合わせ。利用部門での設置状況、発生している症状、希望対応日を確認し、一次回答と必要な保守手配を記録する。'
        )
    );
}

logResults('OpportunityContactRole', Database.insert(roles, false));
logResults('OpportunityLineItem', Database.insert(opportunityLineItems, false));
logResults('Contract', Database.insert(contracts, false));
Database.SaveResult[] orderResults = Database.insert(orders, false);
logResults('Order', orderResults);

List<Order> insertedOrders = new List<Order>();
for (Integer i = 0; i < orderResults.size(); i += 1) {
    if (orderResults[i].isSuccess()) {
        orders[i].Id = orderResults[i].getId();
        insertedOrders.add(orders[i]);
    }
}
if (insertedOrders.isEmpty()) {
    System.assert(false, 'No Order records were inserted.');
}
List<OrderItem> orderItems = new List<OrderItem>();
for (Integer i = 1; i <= countPerObject; i += 1) {
    Integer sequence = existingOpportunityCount + i;
    PricebookEntry entry = pricebookEntries[
        Math.mod(sequence - 1, pricebookEntries.size())
    ];
    orderItems.add(
        new OrderItem(
            OrderId = insertedOrders[Math.mod(i - 1, insertedOrders.size())].Id,
            PricebookEntryId = entry.Id,
            Quantity = 1 + Math.mod(sequence, 4),
            UnitPrice = entry.UnitPrice,
            ServiceDate = Date.today().addDays(15 + Math.mod(sequence, 180)),
            Description = '初回注文に含まれる ' +
                entry.Product2.Name.replace(seedPrefix, '').trim() +
                '。納品予定日と数量確認のための検証データ。'
        )
    );
}

logResults('OrderItem', Database.insert(orderItems, false));
logResults('Asset', Database.insert(assets, false));
logResults('Case', Database.insert(cases, false));
