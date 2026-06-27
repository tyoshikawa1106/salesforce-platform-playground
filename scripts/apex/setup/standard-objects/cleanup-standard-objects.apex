// Run: sf apex run --file scripts/apex/setup/standard-objects/cleanup-standard-objects.apex --target-org <alias>
String seedPrefix = '[TEST]%';
Integer deleteBatchSize = 100;
String seedLikeLiteral = '\'' + String.escapeSingleQuotes(seedPrefix) + '\'';
List<String> deleted = new List<String>();
Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();

void deleteBatch(
    String objectName,
    String query,
    Integer batchSize,
    List<String> deletedMessages
) {
    List<SObject> records = Database.query(query + ' LIMIT ' + batchSize);
    if (records.isEmpty()) {
        return;
    }

    Database.DeleteResult[] results = Database.delete(records, false);
    Integer successCount = 0;
    List<String> errors = new List<String>();
    for (Database.DeleteResult result : results) {
        if (result.isSuccess()) {
            successCount += 1;
            continue;
        }
        for (Database.Error error : result.getErrors()) {
            errors.add(
                String.valueOf(error.getStatusCode()) + ' ' + error.getMessage()
            );
        }
    }

    deletedMessages.add(
        objectName + ': ' + successCount + '/' + records.size()
    );
    if (!errors.isEmpty()) {
        deletedMessages.add(objectName + ' skipped: ' + errors.size());
    }
}

if (globalDescribe.containsKey('EmailMessage')) {
    deleteBatch(
        'EmailMessage',
        'SELECT Id FROM EmailMessage WHERE Subject LIKE ' +
            seedLikeLiteral +
            ' ORDER BY CreatedDate ASC',
        deleteBatchSize,
        deleted
    );
}

if (globalDescribe.containsKey('WorkOrderLineItem')) {
    deleteBatch(
        'WorkOrderLineItem',
        'SELECT Id FROM WorkOrderLineItem WHERE Subject LIKE ' +
            seedLikeLiteral +
            ' ORDER BY CreatedDate ASC',
        deleteBatchSize,
        deleted
    );
}

if (globalDescribe.containsKey('WorkOrder')) {
    deleteBatch(
        'WorkOrder',
        'SELECT Id FROM WorkOrder WHERE Subject LIKE ' +
            seedLikeLiteral +
            ' ORDER BY CreatedDate ASC',
        deleteBatchSize,
        deleted
    );
}

deleteBatch(
    'Event',
    'SELECT Id FROM Event WHERE Subject LIKE ' +
        seedLikeLiteral +
        ' ORDER BY CreatedDate ASC',
    deleteBatchSize,
    deleted
);
deleteBatch(
    'Task',
    'SELECT Id FROM Task WHERE Subject LIKE ' +
        seedLikeLiteral +
        ' ORDER BY CreatedDate ASC',
    deleteBatchSize,
    deleted
);
deleteBatch(
    'Case',
    'SELECT Id FROM Case WHERE Subject LIKE ' +
        seedLikeLiteral +
        ' ORDER BY CreatedDate ASC',
    deleteBatchSize,
    deleted
);
deleteBatch(
    'Asset',
    'SELECT Id FROM Asset WHERE Name LIKE ' +
        seedLikeLiteral +
        ' ORDER BY CreatedDate ASC',
    deleteBatchSize,
    deleted
);

if (globalDescribe.containsKey('Entitlement')) {
    deleteBatch(
        'Entitlement',
        'SELECT Id FROM Entitlement WHERE Name LIKE ' +
            seedLikeLiteral +
            ' ORDER BY CreatedDate ASC',
        deleteBatchSize,
        deleted
    );
}

if (globalDescribe.containsKey('ContractLineItem')) {
    deleteBatch(
        'ContractLineItem',
        'SELECT Id FROM ContractLineItem WHERE ServiceContract.Name LIKE ' +
            seedLikeLiteral +
            ' ORDER BY CreatedDate ASC',
        deleteBatchSize,
        deleted
    );
}

if (globalDescribe.containsKey('ServiceContract')) {
    deleteBatch(
        'ServiceContract',
        'SELECT Id FROM ServiceContract WHERE Name LIKE ' +
            seedLikeLiteral +
            ' ORDER BY CreatedDate ASC',
        deleteBatchSize,
        deleted
    );
}

deleteBatch(
    'OrderItem',
    'SELECT Id FROM OrderItem WHERE Order.Account.Name LIKE ' +
        seedLikeLiteral +
        ' ORDER BY CreatedDate ASC',
    deleteBatchSize,
    deleted
);
deleteBatch(
    'Order',
    'SELECT Id FROM Order WHERE Account.Name LIKE ' +
        seedLikeLiteral +
        ' ORDER BY CreatedDate ASC',
    deleteBatchSize,
    deleted
);
deleteBatch(
    'Contract',
    'SELECT Id FROM Contract WHERE Account.Name LIKE ' +
        seedLikeLiteral +
        ' ORDER BY CreatedDate ASC',
    deleteBatchSize,
    deleted
);
deleteBatch(
    'OpportunityLineItem',
    'SELECT Id FROM OpportunityLineItem WHERE Opportunity.Name LIKE ' +
        seedLikeLiteral +
        ' ORDER BY CreatedDate ASC',
    deleteBatchSize,
    deleted
);
deleteBatch(
    'OpportunityContactRole',
    'SELECT Id FROM OpportunityContactRole WHERE Opportunity.Name LIKE ' +
        seedLikeLiteral +
        ' ORDER BY CreatedDate ASC',
    deleteBatchSize,
    deleted
);
deleteBatch(
    'Opportunity',
    'SELECT Id FROM Opportunity WHERE Name LIKE ' +
        seedLikeLiteral +
        ' ORDER BY CreatedDate ASC',
    deleteBatchSize,
    deleted
);
deleteBatch(
    'PricebookEntry',
    'SELECT Id FROM PricebookEntry WHERE Product2.Name LIKE ' +
        seedLikeLiteral +
        ' ORDER BY CreatedDate ASC',
    deleteBatchSize,
    deleted
);
deleteBatch(
    'Pricebook2',
    'SELECT Id FROM Pricebook2 WHERE Name LIKE ' +
        seedLikeLiteral +
        ' ORDER BY CreatedDate ASC',
    deleteBatchSize,
    deleted
);
deleteBatch(
    'Product2',
    'SELECT Id FROM Product2 WHERE Name LIKE ' +
        seedLikeLiteral +
        ' ORDER BY CreatedDate ASC',
    deleteBatchSize,
    deleted
);
deleteBatch(
    'CampaignMember',
    'SELECT Id FROM CampaignMember WHERE Campaign.Name LIKE ' +
        seedLikeLiteral +
        ' ORDER BY CreatedDate ASC',
    deleteBatchSize,
    deleted
);
deleteBatch(
    'Campaign',
    'SELECT Id FROM Campaign WHERE Name LIKE ' +
        seedLikeLiteral +
        ' ORDER BY CreatedDate ASC',
    deleteBatchSize,
    deleted
);

if (globalDescribe.containsKey('ContentDocument')) {
    deleteBatch(
        'ContentDocument',
        'SELECT Id FROM ContentDocument WHERE Title LIKE ' +
            seedLikeLiteral +
            ' ORDER BY CreatedDate ASC',
        deleteBatchSize,
        deleted
    );
}

if (globalDescribe.containsKey('EmailTemplate')) {
    deleteBatch(
        'EmailTemplate',
        'SELECT Id FROM EmailTemplate WHERE Name LIKE ' +
            seedLikeLiteral +
            ' ORDER BY CreatedDate ASC',
        deleteBatchSize,
        deleted
    );
}

deleteBatch(
    'Lead',
    'SELECT Id FROM Lead WHERE LastName LIKE ' +
        seedLikeLiteral +
        ' ORDER BY CreatedDate ASC',
    deleteBatchSize,
    deleted
);
deleteBatch(
    'Contact',
    'SELECT Id FROM Contact WHERE LastName LIKE ' +
        seedLikeLiteral +
        ' ORDER BY CreatedDate ASC',
    deleteBatchSize,
    deleted
);
deleteBatch(
    'Account',
    'SELECT Id FROM Account WHERE Name LIKE ' +
        seedLikeLiteral +
        ' ORDER BY CreatedDate ASC',
    deleteBatchSize,
    deleted
);

if (deleted.isEmpty()) {
    System.debug('Deleted records: none');
} else {
    System.debug('Deleted records: ' + String.join(deleted, ' | '));
}
