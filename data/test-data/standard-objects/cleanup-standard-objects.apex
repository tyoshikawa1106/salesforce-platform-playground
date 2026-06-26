String seedPrefix = 'CLI Standard Seed%';
List<String> deleted = new List<String>();
Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();

if (globalDescribe.containsKey('EmailMessage')) {
    List<SObject> emailMessages = Database.query(
        'SELECT Id FROM EmailMessage WHERE Subject LIKE :seedPrefix'
    );
    if (!emailMessages.isEmpty()) {
        delete emailMessages;
        deleted.add('EmailMessage: ' + emailMessages.size());
    }
}

if (globalDescribe.containsKey('WorkOrderLineItem')) {
    List<SObject> workOrderLineItems = Database.query(
        'SELECT Id FROM WorkOrderLineItem WHERE Subject LIKE :seedPrefix'
    );
    if (!workOrderLineItems.isEmpty()) {
        delete workOrderLineItems;
        deleted.add('WorkOrderLineItem: ' + workOrderLineItems.size());
    }
}

if (globalDescribe.containsKey('WorkOrder')) {
    List<SObject> workOrders = Database.query(
        'SELECT Id FROM WorkOrder WHERE Subject LIKE :seedPrefix'
    );
    if (!workOrders.isEmpty()) {
        delete workOrders;
        deleted.add('WorkOrder: ' + workOrders.size());
    }
}

List<Event> events = [
    SELECT Id
    FROM Event
    WHERE Subject LIKE :seedPrefix
];
if (!events.isEmpty()) {
    delete events;
    deleted.add('Event: ' + events.size());
}

List<Task> tasks = [
    SELECT Id
    FROM Task
    WHERE Subject LIKE :seedPrefix
];
if (!tasks.isEmpty()) {
    delete tasks;
    deleted.add('Task: ' + tasks.size());
}

List<Case> cases = [
    SELECT Id
    FROM Case
    WHERE Subject LIKE :seedPrefix
];
if (!cases.isEmpty()) {
    delete cases;
    deleted.add('Case: ' + cases.size());
}

List<Asset> assets = [
    SELECT Id
    FROM Asset
    WHERE Name LIKE :seedPrefix
];
if (!assets.isEmpty()) {
    delete assets;
    deleted.add('Asset: ' + assets.size());
}

if (globalDescribe.containsKey('Entitlement')) {
    List<SObject> entitlements = Database.query(
        'SELECT Id FROM Entitlement WHERE Name LIKE :seedPrefix'
    );
    if (!entitlements.isEmpty()) {
        delete entitlements;
        deleted.add('Entitlement: ' + entitlements.size());
    }
}

if (globalDescribe.containsKey('ServiceContract')) {
    List<SObject> serviceContracts = Database.query(
        'SELECT Id FROM ServiceContract WHERE Name LIKE :seedPrefix'
    );
    if (!serviceContracts.isEmpty()) {
        delete serviceContracts;
        deleted.add('ServiceContract: ' + serviceContracts.size());
    }
}

List<OrderItem> orderItems = [
    SELECT Id
    FROM OrderItem
    WHERE Order.Account.Name LIKE :seedPrefix
];
if (!orderItems.isEmpty()) {
    delete orderItems;
    deleted.add('OrderItem: ' + orderItems.size());
}

List<Order> orders = [
    SELECT Id
    FROM Order
    WHERE Account.Name LIKE :seedPrefix
];
if (!orders.isEmpty()) {
    delete orders;
    deleted.add('Order: ' + orders.size());
}

List<Contract> contracts = [
    SELECT Id
    FROM Contract
    WHERE Account.Name LIKE :seedPrefix
];
if (!contracts.isEmpty()) {
    delete contracts;
    deleted.add('Contract: ' + contracts.size());
}

List<OpportunityLineItem> opportunityLineItems = [
    SELECT Id
    FROM OpportunityLineItem
    WHERE Opportunity.Name LIKE :seedPrefix
];
if (!opportunityLineItems.isEmpty()) {
    delete opportunityLineItems;
    deleted.add('OpportunityLineItem: ' + opportunityLineItems.size());
}

List<OpportunityContactRole> opportunityContactRoles = [
    SELECT Id
    FROM OpportunityContactRole
    WHERE Opportunity.Name LIKE :seedPrefix
];
if (!opportunityContactRoles.isEmpty()) {
    delete opportunityContactRoles;
    deleted.add('OpportunityContactRole: ' + opportunityContactRoles.size());
}

List<Opportunity> opportunities = [
    SELECT Id
    FROM Opportunity
    WHERE Name LIKE :seedPrefix
];
if (!opportunities.isEmpty()) {
    delete opportunities;
    deleted.add('Opportunity: ' + opportunities.size());
}

List<PricebookEntry> pricebookEntries = [
    SELECT Id
    FROM PricebookEntry
    WHERE Product2.Name LIKE :seedPrefix
];
if (!pricebookEntries.isEmpty()) {
    Database.DeleteResult[] pricebookEntryResults = Database.delete(pricebookEntries, false);
    Integer pricebookEntryDeleteCount = 0;
    for (Database.DeleteResult result : pricebookEntryResults) {
        if (result.isSuccess()) {
            pricebookEntryDeleteCount += 1;
        }
    }
    deleted.add('PricebookEntry: ' + pricebookEntryDeleteCount + '/' + pricebookEntries.size());
}

List<Pricebook2> pricebooks = [
    SELECT Id
    FROM Pricebook2
    WHERE Name LIKE :seedPrefix
];
if (!pricebooks.isEmpty()) {
    Database.DeleteResult[] pricebookResults = Database.delete(pricebooks, false);
    Integer pricebookDeleteCount = 0;
    for (Database.DeleteResult result : pricebookResults) {
        if (result.isSuccess()) {
            pricebookDeleteCount += 1;
        }
    }
    deleted.add('Pricebook2: ' + pricebookDeleteCount + '/' + pricebooks.size());
}

List<Product2> products = [
    SELECT Id
    FROM Product2
    WHERE Name LIKE :seedPrefix
];
if (!products.isEmpty()) {
    Database.DeleteResult[] productResults = Database.delete(products, false);
    Integer productDeleteCount = 0;
    for (Database.DeleteResult result : productResults) {
        if (result.isSuccess()) {
            productDeleteCount += 1;
        }
    }
    deleted.add('Product2: ' + productDeleteCount + '/' + products.size());
}

List<CampaignMember> campaignMembers = [
    SELECT Id
    FROM CampaignMember
    WHERE Campaign.Name LIKE :seedPrefix
];
if (!campaignMembers.isEmpty()) {
    delete campaignMembers;
    deleted.add('CampaignMember: ' + campaignMembers.size());
}

List<Campaign> campaigns = [
    SELECT Id
    FROM Campaign
    WHERE Name LIKE :seedPrefix
];
if (!campaigns.isEmpty()) {
    delete campaigns;
    deleted.add('Campaign: ' + campaigns.size());
}

if (globalDescribe.containsKey('ContentDocument')) {
    List<ContentDocument> contentDocuments = [
        SELECT Id
        FROM ContentDocument
        WHERE Title LIKE :seedPrefix
    ];
    if (!contentDocuments.isEmpty()) {
        delete contentDocuments;
        deleted.add('ContentDocument: ' + contentDocuments.size());
    }
}

if (globalDescribe.containsKey('EmailTemplate')) {
    List<SObject> emailTemplates = Database.query(
        'SELECT Id FROM EmailTemplate WHERE Name LIKE :seedPrefix'
    );
    if (!emailTemplates.isEmpty()) {
        delete emailTemplates;
        deleted.add('EmailTemplate: ' + emailTemplates.size());
    }
}

List<Lead> leads = [
    SELECT Id
    FROM Lead
    WHERE LastName LIKE :seedPrefix
];
if (!leads.isEmpty()) {
    delete leads;
    deleted.add('Lead: ' + leads.size());
}

List<Contact> contacts = [
    SELECT Id
    FROM Contact
    WHERE LastName LIKE :seedPrefix
];
if (!contacts.isEmpty()) {
    delete contacts;
    deleted.add('Contact: ' + contacts.size());
}

List<Account> accounts = [
    SELECT Id
    FROM Account
    WHERE Name LIKE :seedPrefix
];
if (!accounts.isEmpty()) {
    delete accounts;
    deleted.add('Account: ' + accounts.size());
}

System.debug('Deleted records: ' + String.join(deleted, ' | '));
