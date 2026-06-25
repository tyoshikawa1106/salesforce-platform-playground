String seedPrefix = 'CLI Standard Seed';
String seedKey = seedPrefix + ' ' + Datetime.now().formatGmt('yyyyMMddHHmmss');
List<String> created = new List<String>();
List<String> skipped = new List<String>();

Account accountRecord = new Account(
    Name = seedKey + ' Account',
    Description = 'Synthetic standard object seed account.'
);
insert accountRecord;
created.add('Account: ' + accountRecord.Id);

Contact contactRecord = new Contact(
    AccountId = accountRecord.Id,
    LastName = seedKey + ' Contact',
    Email = 'standard.seed@example.invalid',
    Title = 'Operations Manager'
);
insert contactRecord;
created.add('Contact: ' + contactRecord.Id);

LeadStatus defaultLeadStatus = [
    SELECT MasterLabel
    FROM LeadStatus
    WHERE IsDefault = TRUE
    LIMIT 1
];
Lead leadRecord = new Lead(
    LastName = seedKey + ' Lead',
    Company = seedKey + ' Company',
    Status = defaultLeadStatus.MasterLabel,
    Email = 'standard.lead@example.invalid'
);
insert leadRecord;
created.add('Lead: ' + leadRecord.Id);

Campaign campaignRecord = new Campaign(
    Name = seedKey + ' Campaign',
    IsActive = true
);
insert campaignRecord;
created.add('Campaign: ' + campaignRecord.Id);

try {
    CampaignMember contactCampaignMember = new CampaignMember(
        CampaignId = campaignRecord.Id,
        ContactId = contactRecord.Id
    );
    CampaignMember leadCampaignMember = new CampaignMember(
        CampaignId = campaignRecord.Id,
        LeadId = leadRecord.Id
    );
    insert new List<CampaignMember>{ contactCampaignMember, leadCampaignMember };
    created.add('CampaignMember: ' + contactCampaignMember.Id);
    created.add('CampaignMember: ' + leadCampaignMember.Id);
} catch (Exception error) {
    skipped.add('CampaignMember: ' + error.getMessage());
}

Product2 productRecord = new Product2(
    Name = seedKey + ' Product',
    ProductCode = 'CLI-SEED-' + Datetime.now().getTime(),
    IsActive = true,
    Description = 'Synthetic standard object seed product.'
);
insert productRecord;
created.add('Product2: ' + productRecord.Id);

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

PricebookEntry pricebookEntry = new PricebookEntry(
    Pricebook2Id = standardPricebook.Id,
    Product2Id = productRecord.Id,
    UnitPrice = 12000,
    IsActive = true
);
insert pricebookEntry;
created.add('PricebookEntry: ' + pricebookEntry.Id);

OpportunityStage openStage = [
    SELECT MasterLabel
    FROM OpportunityStage
    WHERE IsActive = TRUE AND IsClosed = FALSE
    ORDER BY SortOrder
    LIMIT 1
];
Opportunity opportunityRecord = new Opportunity(
    AccountId = accountRecord.Id,
    Name = seedKey + ' Opportunity',
    StageName = openStage.MasterLabel,
    CloseDate = Date.today().addDays(30),
    Pricebook2Id = standardPricebook.Id,
    Description = 'Synthetic standard object seed opportunity.'
);
insert opportunityRecord;
created.add('Opportunity: ' + opportunityRecord.Id);

try {
    OpportunityContactRole opportunityContactRole = new OpportunityContactRole(
        OpportunityId = opportunityRecord.Id,
        ContactId = contactRecord.Id,
        IsPrimary = true
    );
    insert opportunityContactRole;
    created.add('OpportunityContactRole: ' + opportunityContactRole.Id);
} catch (Exception error) {
    skipped.add('OpportunityContactRole: ' + error.getMessage());
}

OpportunityLineItem opportunityLineItem = new OpportunityLineItem(
    OpportunityId = opportunityRecord.Id,
    PricebookEntryId = pricebookEntry.Id,
    Quantity = 2,
    UnitPrice = 12000,
    Description = seedKey + ' Opportunity Line Item'
);
insert opportunityLineItem;
created.add('OpportunityLineItem: ' + opportunityLineItem.Id);

try {
    Contract contractRecord = new Contract(
        AccountId = accountRecord.Id,
        StartDate = Date.today(),
        ContractTerm = 12,
        Status = 'Draft',
        Description = seedKey + ' Contract'
    );
    insert contractRecord;
    created.add('Contract: ' + contractRecord.Id);
} catch (Exception error) {
    skipped.add('Contract: ' + error.getMessage());
}

Order orderRecord;
try {
    orderRecord = new Order(
        AccountId = accountRecord.Id,
        EffectiveDate = Date.today(),
        Status = 'Draft',
        Pricebook2Id = standardPricebook.Id,
        Description = seedKey + ' Order'
    );
    insert orderRecord;
    created.add('Order: ' + orderRecord.Id);

    OrderItem orderItem = new OrderItem(
        OrderId = orderRecord.Id,
        PricebookEntryId = pricebookEntry.Id,
        Quantity = 1,
        UnitPrice = 12000,
        Description = seedKey + ' Order Item'
    );
    insert orderItem;
    created.add('OrderItem: ' + orderItem.Id);
} catch (Exception error) {
    skipped.add('Order / OrderItem: ' + error.getMessage());
}

Asset assetRecord = new Asset(
    AccountId = accountRecord.Id,
    ContactId = contactRecord.Id,
    Product2Id = productRecord.Id,
    Name = seedKey + ' Asset',
    Quantity = 1
);
insert assetRecord;
created.add('Asset: ' + assetRecord.Id);

CaseStatus defaultCaseStatus = [
    SELECT MasterLabel
    FROM CaseStatus
    WHERE IsDefault = TRUE
    LIMIT 1
];
Case caseRecord = new Case(
    AccountId = accountRecord.Id,
    ContactId = contactRecord.Id,
    Subject = seedKey + ' Case',
    Status = defaultCaseStatus.MasterLabel,
    Description = 'Synthetic standard object seed case.'
);
insert caseRecord;
created.add('Case: ' + caseRecord.Id);

Task taskRecord = new Task(
    Subject = seedKey + ' Follow-up Task',
    WhoId = contactRecord.Id,
    WhatId = opportunityRecord.Id,
    ActivityDate = Date.today().addDays(1)
);
insert taskRecord;
created.add('Task: ' + taskRecord.Id);

Event eventRecord = new Event(
    Subject = seedKey + ' Discovery Meeting',
    WhoId = contactRecord.Id,
    WhatId = opportunityRecord.Id,
    StartDateTime = System.now().addDays(2),
    EndDateTime = System.now().addDays(2).addHours(1)
);
insert eventRecord;
created.add('Event: ' + eventRecord.Id);

Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
try {
    if (
        !globalDescribe.containsKey('WorkOrder') ||
        !globalDescribe.containsKey('WorkOrderLineItem')
    ) {
        skipped.add('WorkOrder / WorkOrderLineItem: object is not available');
    } else {
        SObject workOrder = globalDescribe.get('WorkOrder').newSObject();
        workOrder.put('AccountId', accountRecord.Id);
        workOrder.put('ContactId', contactRecord.Id);
        workOrder.put('CaseId', caseRecord.Id);
        workOrder.put('Subject', seedKey + ' Work Order');
        workOrder.put('Status', 'New');
        workOrder.put('Description', 'Synthetic standard object seed work order.');
        insert workOrder;
        created.add('WorkOrder: ' + workOrder.get('Id'));

        SObject workOrderLineItem = globalDescribe
            .get('WorkOrderLineItem')
            .newSObject();
        workOrderLineItem.put('WorkOrderId', workOrder.get('Id'));
        workOrderLineItem.put('Subject', seedKey + ' Work Order Line Item');
        workOrderLineItem.put('Status', 'New');
        workOrderLineItem.put(
            'Description',
            'Synthetic standard object seed work order line item.'
        );
        insert workOrderLineItem;
        created.add('WorkOrderLineItem: ' + workOrderLineItem.get('Id'));
    }
} catch (Exception error) {
    skipped.add('WorkOrder / WorkOrderLineItem: ' + error.getMessage());
}

System.debug('Seed key: ' + seedKey);
System.debug('Created records: ' + String.join(created, ' | '));
if (!skipped.isEmpty()) {
    System.debug('Skipped optional records: ' + String.join(skipped, ' | '));
}
