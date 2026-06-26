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

List<Account> accounts = [SELECT Id FROM Account WHERE Name LIKE :seedLike ORDER BY CreatedDate DESC LIMIT :countPerObject];
List<Contact> contacts = [SELECT Id, FirstName, LastName FROM Contact WHERE LastName LIKE :seedLike ORDER BY CreatedDate DESC LIMIT :countPerObject];
List<Campaign> campaigns = [SELECT Id FROM Campaign WHERE Name LIKE :seedLike ORDER BY CreatedDate DESC LIMIT :countPerObject];
List<Product2> products = [SELECT Id, Name FROM Product2 WHERE Name LIKE :seedLike ORDER BY CreatedDate DESC LIMIT :countPerObject];
List<Pricebook2> pricebooks = [SELECT Id FROM Pricebook2 WHERE Name LIKE :seedLike ORDER BY CreatedDate DESC LIMIT :countPerObject];
List<PricebookEntry> pricebookEntries = [
    SELECT Id, Pricebook2Id, Product2Id
    FROM PricebookEntry
    WHERE Product2.Name LIKE :seedLike
    AND Pricebook2.Name LIKE :seedLike
    AND IsActive = TRUE
    AND Pricebook2.IsActive = TRUE
    ORDER BY CreatedDate DESC
    LIMIT :countPerObject
];
if (accounts.isEmpty() || contacts.isEmpty() || campaigns.isEmpty() || products.isEmpty() || pricebooks.isEmpty() || pricebookEntries.isEmpty()) {
    System.assert(false, 'Run account, contact, campaign, product, and pricebook phases before sales.');
}

String opportunityStage = pick(Opportunity.StageName.getDescribe(), new List<String>{ 'Prospecting', 'Qualification', 'Value Proposition' });
String opportunityType = pick(Opportunity.Type.getDescribe(), new List<String>{ 'New Customer', 'Existing Customer - Upgrade' });
String opportunityLeadSource = pick(Opportunity.LeadSource.getDescribe(), new List<String>{ 'Web', 'Phone Inquiry', 'Purchased List' });
String opportunityRole = pick(OpportunityContactRole.Role.getDescribe(), new List<String>{ 'Business User', 'Decision Maker', 'Evaluator' });
String contractStatus = pick(Contract.Status.getDescribe(), new List<String>{ 'Draft' });
String orderStatus = pick(Order.Status.getDescribe(), new List<String>{ 'Draft' });
String assetStatus = pick(Asset.Status.getDescribe(), new List<String>{ 'Purchased', 'Installed' });
String caseOrigin = pick(Case.Origin.getDescribe(), new List<String>{ 'Web', 'Phone', 'Email' });
String caseStatus = pick(Case.Status.getDescribe(), new List<String>{ 'New', 'Working', 'Open' });
String casePriority = pick(Case.Priority.getDescribe(), new List<String>{ 'Medium', 'High', 'Low' });

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
    'ログイン後に商談一覧が表示されない',
    '契約更新通知の送信条件を確認したい',
    '注文商品の数量変更が反映されない',
    '作業指示の担当者割り当てを相談したい',
    'レポートの集計条件について質問',
    'メール履歴の関連付け先を変更したい',
    'キャンペーンメンバーの重複を解消したい',
    '価格表エントリの有効化方法を確認',
    'ケースの優先度ルールを見直したい',
    'ファイル共有範囲の確認依頼',
    'モバイル画面で項目が見切れる',
    '取引先責任者の部署名を一括更新したい',
    '納入商品の保証期間を確認したい',
    '商談商品の単価が想定と異なる',
    'サービス契約の開始日を修正したい',
    '問い合わせ分類の追加可否を相談',
    '活動予定のリマインダー設定を確認',
    'リード変換時の関連付けを確認',
    '注文ステータスの更新タイミングを相談',
    'ダッシュボード表示権限を確認したい'
};

List<Opportunity> opportunities = new List<Opportunity>();
for (Integer i = 1; i <= countPerObject; i += 1) {
    PricebookEntry entry = pricebookEntries[Math.mod(i - 1, pricebookEntries.size())];
    opportunities.add(
        new Opportunity(
            Name = seedPrefix + ' ' + opportunityNames[i - 1],
            AccountId = accounts[Math.mod(i - 1, accounts.size())].Id,
            CampaignId = campaigns[Math.mod(i - 1, campaigns.size())].Id,
            Pricebook2Id = entry.Pricebook2Id,
            StageName = opportunityStage,
            Type = opportunityType,
            LeadSource = opportunityLeadSource,
            CloseDate = Date.today().addDays(30 + i),
            Amount = 250000 + (i * 25000),
            Probability = 40 + Math.mod(i, 5) * 10,
            NextStep = '来週の定例で利用部門の要件と導入範囲を確認',
            Description = opportunityNames[i - 1] + ' の検証用商談。提案、価格表、商談商品、注文連携を確認します。'
        )
    );
}

System.debug('Seed run key: ' + seedRunKey);
Database.SaveResult[] opportunityResults = Database.insert(opportunities, false);
logResults('Opportunity', opportunityResults);
List<Opportunity> insertedOpportunities = new List<Opportunity>();
for (Integer i = 0; i < opportunityResults.size(); i += 1) {
    if (opportunityResults[i].isSuccess()) {
        opportunities[i].Id = opportunityResults[i].getId();
        insertedOpportunities.add(opportunities[i]);
    }
}

List<OpportunityContactRole> roles = new List<OpportunityContactRole>();
List<OpportunityLineItem> opportunityLineItems = new List<OpportunityLineItem>();
List<Contract> contracts = new List<Contract>();
List<Order> orders = new List<Order>();
List<Asset> assets = new List<Asset>();
List<Case> cases = new List<Case>();
for (Integer i = 1; i <= countPerObject; i += 1) {
    Account account = accounts[Math.mod(i - 1, accounts.size())];
    Contact contact = contacts[Math.mod(i - 1, contacts.size())];
    Product2 product = products[Math.mod(i - 1, products.size())];
    PricebookEntry entry = pricebookEntries[Math.mod(i - 1, pricebookEntries.size())];
    Opportunity opportunity = insertedOpportunities[Math.mod(i - 1, insertedOpportunities.size())];

    roles.add(new OpportunityContactRole(OpportunityId = opportunity.Id, ContactId = contact.Id, Role = opportunityRole, IsPrimary = true));
    opportunityLineItems.add(new OpportunityLineItem(OpportunityId = opportunity.Id, PricebookEntryId = entry.Id, Quantity = 1 + Math.mod(i, 4), UnitPrice = 12000 + (i * 500), ServiceDate = Date.today().addDays(10 + i), Description = '初期導入範囲に含める商品。PoC後に本番利用数を確定予定。'));
    contracts.add(new Contract(AccountId = account.Id, StartDate = Date.today().addDays(i), ContractTerm = 12, Status = contractStatus, CustomerSignedTitle = '部門責任者', CustomerSignedDate = Date.today().addDays(i), Description = '年間利用契約のドラフト。更新条件、サポート範囲、請求開始日を確認中。'));
    orders.add(new Order(AccountId = account.Id, BillToContactId = contact.Id, ShipToContactId = contact.Id, Pricebook2Id = entry.Pricebook2Id, EffectiveDate = Date.today().addDays(i), Status = orderStatus, BillingStreet = '大手町 ' + i + '-1-' + Math.mod(i + 1, 9), BillingCity = '千代田区', BillingPostalCode = '100-' + String.valueOf(2000 + i), ShippingStreet = '銀座 ' + i + '-4-' + Math.mod(i + 2, 9), ShippingCity = '中央区', ShippingPostalCode = '104-' + String.valueOf(2000 + i), Description = '営業部門向け初回導入分の注文。請求先と納品先を分けた検証用データ。'));
    assets.add(new Asset(Name = seedPrefix + ' ' + product.Name.replace(seedPrefix, '').trim() + ' 利用環境', AccountId = account.Id, ContactId = contact.Id, Product2Id = product.Id, Status = assetStatus, Quantity = 1, Price = 12000 + (i * 500), PurchaseDate = Date.today().addDays(-30 - i), UsageEndDate = Date.today().addDays(335 + i), SerialNumber = 'SN-' + seedRunKey.right(14) + '-' + i, Description = '顧客環境に導入済みの商品。契約更新と作業指示の関連確認に使用。'));
    cases.add(new Case(Subject = seedPrefix + ' ' + caseSubjects[i - 1], AccountId = account.Id, ContactId = contact.Id, Origin = caseOrigin, Status = caseStatus, Priority = casePriority, SuppliedName = contact.LastName.replace(seedPrefix, '').trim() + ' ' + contact.FirstName, SuppliedEmail = 'standard.seed.case+' + i + '@example.invalid', SuppliedPhone = '03-5555-' + String.valueOf(8000 + i), SuppliedCompany = '既存顧客サポート窓口', Description = '顧客からの問い合わせ内容を想定したケース。一次回答、関連活動、メール履歴の確認に使用。'));
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
List<OrderItem> orderItems = new List<OrderItem>();
for (Integer i = 1; i <= countPerObject; i += 1) {
    PricebookEntry entry = pricebookEntries[Math.mod(i - 1, pricebookEntries.size())];
    orderItems.add(new OrderItem(OrderId = insertedOrders[Math.mod(i - 1, insertedOrders.size())].Id, PricebookEntryId = entry.Id, Quantity = 1 + Math.mod(i, 4), UnitPrice = 12000 + (i * 500), ServiceDate = Date.today().addDays(15 + i), Description = '初回注文に含まれる明細。納品予定日と数量確認のための検証データ。'));
}

logResults('OrderItem', Database.insert(orderItems, false));
logResults('Asset', Database.insert(assets, false));
logResults('Case', Database.insert(cases, false));
