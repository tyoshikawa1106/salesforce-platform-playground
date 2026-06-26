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
List<Contact> contacts = [SELECT Id FROM Contact WHERE LastName LIKE :seedLike ORDER BY CreatedDate DESC LIMIT :countPerObject];
List<Campaign> campaigns = [SELECT Id FROM Campaign WHERE Name LIKE :seedLike ORDER BY CreatedDate DESC LIMIT :countPerObject];
List<Product2> products = [SELECT Id FROM Product2 WHERE Name LIKE :seedLike ORDER BY CreatedDate DESC LIMIT :countPerObject];
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

List<Opportunity> opportunities = new List<Opportunity>();
for (Integer i = 1; i <= countPerObject; i += 1) {
    PricebookEntry entry = pricebookEntries[Math.mod(i - 1, pricebookEntries.size())];
    opportunities.add(
        new Opportunity(
            Name = seedKey + ' Opportunity ' + String.valueOf(i).leftPad(2, '0'),
            AccountId = accounts[Math.mod(i - 1, accounts.size())].Id,
            CampaignId = campaigns[Math.mod(i - 1, campaigns.size())].Id,
            Pricebook2Id = entry.Pricebook2Id,
            StageName = opportunityStage,
            Type = opportunityType,
            LeadSource = opportunityLeadSource,
            CloseDate = Date.today().addDays(30 + i),
            Amount = 250000 + (i * 25000),
            Probability = 40 + Math.mod(i, 5) * 10,
            NextStep = 'Confirm business requirements ' + i,
            Description = 'Synthetic opportunity for standard object seed ' + i + '.'
        )
    );
}

System.debug('Seed key: ' + seedKey);
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
    opportunityLineItems.add(new OpportunityLineItem(OpportunityId = opportunity.Id, PricebookEntryId = entry.Id, Quantity = 1 + Math.mod(i, 4), UnitPrice = 12000 + (i * 500), ServiceDate = Date.today().addDays(10 + i), Description = 'Synthetic opportunity product for standard object seed ' + i + '.'));
    contracts.add(new Contract(AccountId = account.Id, StartDate = Date.today().addDays(i), ContractTerm = 12, Status = contractStatus, CustomerSignedTitle = 'Director', CustomerSignedDate = Date.today().addDays(i), Description = 'Synthetic contract for standard object seed ' + i + '.'));
    orders.add(new Order(AccountId = account.Id, BillToContactId = contact.Id, ShipToContactId = contact.Id, Pricebook2Id = entry.Pricebook2Id, EffectiveDate = Date.today().addDays(i), Status = orderStatus, BillingStreet = '6-' + i + '-1 Otemachi', BillingCity = 'Chiyoda-ku', BillingPostalCode = '100-' + String.valueOf(2000 + i), ShippingStreet = '7-' + i + '-1 Ginza', ShippingCity = 'Chuo-ku', ShippingPostalCode = '104-' + String.valueOf(2000 + i), Description = 'Synthetic order for standard object seed ' + i + '.'));
    assets.add(new Asset(Name = seedKey + ' Asset ' + String.valueOf(i).leftPad(2, '0'), AccountId = account.Id, ContactId = contact.Id, Product2Id = product.Id, Status = assetStatus, Quantity = 1, Price = 12000 + (i * 500), PurchaseDate = Date.today().addDays(-30 - i), UsageEndDate = Date.today().addDays(335 + i), SerialNumber = 'SN-' + seedKey.right(14) + '-' + i, Description = 'Synthetic asset for standard object seed ' + i + '.'));
    cases.add(new Case(Subject = seedKey + ' Case ' + String.valueOf(i).leftPad(2, '0'), AccountId = account.Id, ContactId = contact.Id, Origin = caseOrigin, Status = caseStatus, Priority = casePriority, SuppliedName = 'Seed Requester ' + i, SuppliedEmail = 'standard.seed.case+' + i + '@example.invalid', SuppliedPhone = '03-5555-' + String.valueOf(8000 + i), SuppliedCompany = 'Seed Support Customer ' + i, Description = 'Synthetic case for standard object seed ' + i + '.'));
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
    orderItems.add(new OrderItem(OrderId = insertedOrders[Math.mod(i - 1, insertedOrders.size())].Id, PricebookEntryId = entry.Id, Quantity = 1 + Math.mod(i, 4), UnitPrice = 12000 + (i * 500), ServiceDate = Date.today().addDays(15 + i), Description = 'Synthetic order product for standard object seed ' + i + '.'));
}

logResults('OrderItem', Database.insert(orderItems, false));
logResults('Asset', Database.insert(assets, false));
logResults('Case', Database.insert(cases, false));
