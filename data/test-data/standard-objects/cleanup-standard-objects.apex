String seedPrefix = 'CLI Standard Seed%';
List<String> deleted = new List<String>();
Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();

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
    delete pricebookEntries;
    deleted.add('PricebookEntry: ' + pricebookEntries.size());
}

List<Product2> products = [
    SELECT Id
    FROM Product2
    WHERE Name LIKE :seedPrefix
];
if (!products.isEmpty()) {
    delete products;
    deleted.add('Product2: ' + products.size());
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
