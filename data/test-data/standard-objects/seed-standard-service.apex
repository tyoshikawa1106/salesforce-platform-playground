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

void putIfCreateable(SObject record, String fieldName, Object value) {
    Map<String, Schema.SObjectField> fields = record.getSObjectType()
        .getDescribe()
        .fields.getMap();
    if (
        value != null &&
        fields.containsKey(fieldName) &&
        fields.get(fieldName).getDescribe().isCreateable()
    ) {
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
        System.debug(
            'Skipped records: ' + objectName + ': ' + String.join(errors, ' / ')
        );
    }
}

Map<String, Schema.SObjectType> gd = Schema.getGlobalDescribe();
Integer existingWorkOrderCount = gd.containsKey('WorkOrder')
    ? Database.countQuery(
          'SELECT COUNT() FROM WorkOrder WHERE Subject LIKE :seedLike'
      )
    : 0;
List<Account> accounts = [
    SELECT Id
    FROM Account
    WHERE Name LIKE :seedLike
    ORDER BY CreatedDate ASC
    LIMIT :parentPoolSize
];
List<Contact> contacts = [
    SELECT Id
    FROM Contact
    WHERE LastName LIKE :seedLike
    ORDER BY CreatedDate ASC
    LIMIT :parentPoolSize
];
List<Contract> contracts = [
    SELECT Id
    FROM Contract
    WHERE Account.Name LIKE :seedLike
    ORDER BY CreatedDate ASC
    LIMIT :parentPoolSize
];
List<Asset> assets = [
    SELECT Id
    FROM Asset
    WHERE Name LIKE :seedLike
    ORDER BY CreatedDate ASC
    LIMIT :parentPoolSize
];
List<Case> cases = [
    SELECT Id
    FROM Case
    WHERE Subject LIKE :seedLike
    ORDER BY CreatedDate ASC
    LIMIT :parentPoolSize
];
List<Order> orders = [
    SELECT Id, AccountId
    FROM Order
    WHERE Account.Name LIKE :seedLike
    ORDER BY CreatedDate ASC
    LIMIT :parentPoolSize
];
List<PricebookEntry> pricebookEntries = [
    SELECT Id, UnitPrice, Pricebook2Id, Product2.Name
    FROM PricebookEntry
    WHERE
        Product2.Name LIKE :seedLike
        AND Pricebook2.IsStandard = TRUE
        AND IsActive = TRUE
        AND Pricebook2.IsActive = TRUE
    ORDER BY CreatedDate ASC
    LIMIT :parentPoolSize
];
if (
    accounts.isEmpty() ||
    contacts.isEmpty() ||
    assets.isEmpty() ||
    cases.isEmpty() ||
    orders.isEmpty()
) {
    System.assert(
        false,
        'Run previous standard object seed phases before service.'
    );
}
Map<Id, List<Order>> ordersByAccountId = new Map<Id, List<Order>>();
for (Order orderRecord : orders) {
    if (!ordersByAccountId.containsKey(orderRecord.AccountId)) {
        ordersByAccountId.put(orderRecord.AccountId, new List<Order>());
    }
    ordersByAccountId.get(orderRecord.AccountId).add(orderRecord);
}

System.debug('Seed run key: ' + seedRunKey);
List<SObject> serviceContracts = new List<SObject>();
if (
    gd.containsKey('ServiceContract') &&
    gd.get('ServiceContract').getDescribe().isCreateable()
) {
    String serviceStatus = pick(
        gd.get('ServiceContract')
            .getDescribe()
            .fields.getMap()
            .get('Status')
            .getDescribe(),
        new List<String>{ 'Draft' }
    );
    for (Integer i = 1; i <= countPerObject; i += 1) {
        Integer sequence = existingWorkOrderCount + i;
        SObject record = gd.get('ServiceContract').newSObject();
        putIfCreateable(record, 'Name', seedPrefix + ' 年間サポート契約');
        putIfCreateable(
            record,
            'AccountId',
            accounts[Math.mod(sequence - 1, accounts.size())].Id
        );
        putIfCreateable(
            record,
            'ContactId',
            contacts[Math.mod(sequence - 1, contacts.size())].Id
        );
        if (!pricebookEntries.isEmpty()) {
            putIfCreateable(
                record,
                'Pricebook2Id',
                pricebookEntries[
                        Math.mod(sequence - 1, pricebookEntries.size())
                    ]
                    .Pricebook2Id
            );
        }
        putIfCreateable(
            record,
            'StartDate',
            Date.today().addDays(Math.mod(sequence, 180))
        );
        putIfCreateable(
            record,
            'EndDate',
            Date.today().addDays(365 + Math.mod(sequence, 180))
        );
        putIfCreateable(record, 'Term', 12);
        putIfCreateable(record, 'Status', serviceStatus);
        putIfCreateable(
            record,
            'BillingStreet',
            '大手町 ' + sequence + '-2-' + Math.mod(sequence + 1, 9)
        );
        putIfCreateable(record, 'BillingCity', '千代田区');
        putIfCreateable(record, 'BillingState', '東京都');
        putIfCreateable(
            record,
            'BillingPostalCode',
            '100-' + String.valueOf(3000 + Math.mod(sequence, 7000))
        );
        putIfCreateable(record, 'BillingCountry', '日本');
        putIfCreateable(
            record,
            'ShippingStreet',
            '晴海 ' + sequence + '-3-' + Math.mod(sequence + 2, 9)
        );
        putIfCreateable(record, 'ShippingCity', '中央区');
        putIfCreateable(record, 'ShippingState', '東京都');
        putIfCreateable(
            record,
            'ShippingPostalCode',
            '104-' + String.valueOf(3000 + Math.mod(sequence, 7000))
        );
        putIfCreateable(record, 'ShippingCountry', '日本');
        putIfCreateable(
            record,
            'ShippingHandling',
            2500 + (Math.mod(sequence, 8) * 500)
        );
        putIfCreateable(record, 'Tax', 12000 + (Math.mod(sequence, 15) * 800));
        putIfCreateable(
            record,
            'Description',
            '問い合わせ対応、障害一次切り分け、月次利用レビューを含む年間サポート契約。'
        );
        serviceContracts.add(record);
    }
    logResults('ServiceContract', Database.insert(serviceContracts, false));
} else {
    System.debug(
        'Skipped records: ServiceContract: object is not createable or not available'
    );
}

List<SObject> insertedServiceContracts = gd.containsKey('ServiceContract')
    ? Database.query(
          'SELECT Id, StartDate, EndDate FROM ServiceContract WHERE Name LIKE :seedLike ORDER BY CreatedDate DESC LIMIT :countPerObject'
      )
    : new List<SObject>();

List<SObject> contractLineItems = new List<SObject>();
if (
    gd.containsKey('ContractLineItem') &&
    gd.get('ContractLineItem').getDescribe().isCreateable() &&
    !insertedServiceContracts.isEmpty() &&
    !pricebookEntries.isEmpty()
) {
    for (Integer i = 0; i < insertedServiceContracts.size(); i += 1) {
        SObject serviceContract = insertedServiceContracts[i];
        Date startDate = (Date) serviceContract.get('StartDate');
        Date endDate = (Date) serviceContract.get('EndDate');
        Integer lineItemCount = 3 + Math.mod(i, 3);
        for (Integer j = 0; j < lineItemCount; j += 1) {
            Integer sequence = existingWorkOrderCount + (i * 5) + j + 1;
            PricebookEntry entry = pricebookEntries[
                Math.mod(sequence - 1, pricebookEntries.size())
            ];
            SObject record = gd.get('ContractLineItem').newSObject();
            putIfCreateable(record, 'ServiceContractId', serviceContract.Id);
            putIfCreateable(record, 'PricebookEntryId', entry.Id);
            putIfCreateable(
                record,
                'AssetId',
                assets[Math.mod(sequence - 1, assets.size())].Id
            );
            putIfCreateable(record, 'Quantity', 1 + Math.mod(sequence, 3));
            putIfCreateable(record, 'UnitPrice', entry.UnitPrice);
            putIfCreateable(record, 'Discount', Math.mod(sequence, 4) * 2);
            putIfCreateable(record, 'StartDate', startDate);
            putIfCreateable(record, 'EndDate', endDate);
            putIfCreateable(
                record,
                'Description',
                entry.Product2.Name.replace(seedPrefix, '').trim() +
                ' の保守、交換対応、問い合わせ受付を含む契約品目。'
            );
            contractLineItems.add(record);
        }
    }
    logResults('ContractLineItem', Database.insert(contractLineItems, false));
} else {
    System.debug(
        'Skipped records: ContractLineItem: object is not createable, unavailable, or no service contracts / pricebook entries were available'
    );
}

List<SObject> entitlements = new List<SObject>();
if (
    gd.containsKey('Entitlement') &&
    gd.get('Entitlement').getDescribe().isCreateable()
) {
    Map<String, Schema.SObjectField> entitlementFields = gd.get('Entitlement')
        .getDescribe()
        .fields.getMap();
    String entitlementType = entitlementFields.containsKey('Type')
        ? pick(
              entitlementFields.get('Type').getDescribe(),
              new List<String>{ 'Web Support', 'Phone Support' }
          )
        : null;
    List<BusinessHours> businessHours = [
        SELECT Id
        FROM BusinessHours
        WHERE IsDefault = TRUE
        LIMIT 1
    ];
    for (Integer i = 1; i <= countPerObject; i += 1) {
        Integer sequence = existingWorkOrderCount + i;
        SObject record = gd.get('Entitlement').newSObject();
        putIfCreateable(record, 'Name', seedPrefix + ' 平日サポート権利');
        putIfCreateable(
            record,
            'AccountId',
            accounts[Math.mod(sequence - 1, accounts.size())].Id
        );
        putIfCreateable(
            record,
            'ContactId',
            contacts[Math.mod(sequence - 1, contacts.size())].Id
        );
        putIfCreateable(
            record,
            'AssetId',
            assets[Math.mod(sequence - 1, assets.size())].Id
        );
        if (!insertedServiceContracts.isEmpty()) {
            putIfCreateable(
                record,
                'ServiceContractId',
                insertedServiceContracts[
                        Math.mod(i - 1, insertedServiceContracts.size())
                    ]
                    .Id
            );
        }
        putIfCreateable(
            record,
            'StartDate',
            Date.today().addDays(Math.mod(sequence, 180))
        );
        putIfCreateable(
            record,
            'EndDate',
            Date.today().addDays(365 + Math.mod(sequence, 180))
        );
        putIfCreateable(record, 'Type', entitlementType);
        if (!businessHours.isEmpty()) {
            putIfCreateable(record, 'BusinessHoursId', businessHours[0].Id);
        }
        putIfCreateable(
            record,
            'Description',
            '平日営業時間内の標準サポートを受けられる検証用エンタイトルメント。'
        );
        entitlements.add(record);
    }
    logResults('Entitlement', Database.insert(entitlements, false));
} else {
    System.debug(
        'Skipped records: Entitlement: object is not createable or not available'
    );
}

List<SObject> insertedEntitlements = gd.containsKey('Entitlement')
    ? Database.query(
          'SELECT Id FROM Entitlement WHERE Name LIKE :seedLike ORDER BY CreatedDate DESC LIMIT :countPerObject'
      )
    : new List<SObject>();

List<SObject> workOrders = new List<SObject>();
if (
    gd.containsKey('WorkOrder') &&
    gd.get('WorkOrder').getDescribe().isCreateable()
) {
    Map<String, Schema.SObjectField> workOrderFields = gd.get('WorkOrder')
        .getDescribe()
        .fields.getMap();
    String workOrderStatus = workOrderFields.containsKey('Status')
        ? pick(
              workOrderFields.get('Status').getDescribe(),
              new List<String>{ 'New', 'Open' }
          )
        : null;
    String workOrderPriority = workOrderFields.containsKey('Priority')
        ? pick(
              workOrderFields.get('Priority').getDescribe(),
              new List<String>{ 'Medium', 'High', 'Low' }
          )
        : null;
    for (Integer i = 1; i <= countPerObject; i += 1) {
        Integer sequence = existingWorkOrderCount + i;
        SObject record = gd.get('WorkOrder').newSObject();
        putIfCreateable(record, 'Subject', seedPrefix + ' 導入後設定確認');
        putIfCreateable(
            record,
            'AccountId',
            accounts[Math.mod(sequence - 1, accounts.size())].Id
        );
        putIfCreateable(
            record,
            'ContactId',
            contacts[Math.mod(sequence - 1, contacts.size())].Id
        );
        putIfCreateable(
            record,
            'AssetId',
            assets[Math.mod(sequence - 1, assets.size())].Id
        );
        putIfCreateable(
            record,
            'CaseId',
            cases[Math.mod(sequence - 1, cases.size())].Id
        );
        if (!insertedEntitlements.isEmpty()) {
            putIfCreateable(
                record,
                'EntitlementId',
                insertedEntitlements[
                        Math.mod(i - 1, insertedEntitlements.size())
                    ]
                    .Id
            );
        }
        if (!insertedServiceContracts.isEmpty()) {
            putIfCreateable(
                record,
                'ServiceContractId',
                insertedServiceContracts[
                        Math.mod(i - 1, insertedServiceContracts.size())
                    ]
                    .Id
            );
        }
        putIfCreateable(record, 'Status', workOrderStatus);
        putIfCreateable(record, 'Priority', workOrderPriority);
        putIfCreateable(
            record,
            'Street',
            '品川 ' + sequence + '-2-' + Math.mod(sequence + 3, 9)
        );
        putIfCreateable(record, 'City', '港区');
        putIfCreateable(
            record,
            'PostalCode',
            '108-' + String.valueOf(1000 + Math.mod(sequence, 9000))
        );
        putIfCreateable(
            record,
            'Description',
            '顧客環境の初期設定、権限、通知、レポート表示を確認する作業指示。'
        );
        workOrders.add(record);
    }
    logResults('WorkOrder', Database.insert(workOrders, false));
} else {
    System.debug(
        'Skipped records: WorkOrder: object is not createable or not available'
    );
}

List<SObject> insertedWorkOrders = gd.containsKey('WorkOrder')
    ? Database.query(
          'SELECT Id, AccountId FROM WorkOrder WHERE Subject LIKE :seedLike ORDER BY CreatedDate DESC LIMIT :countPerObject'
      )
    : new List<SObject>();
List<SObject> workOrderLineItems = new List<SObject>();
if (
    gd.containsKey('WorkOrderLineItem') &&
    gd.get('WorkOrderLineItem').getDescribe().isCreateable() &&
    !insertedWorkOrders.isEmpty()
) {
    Map<String, Schema.SObjectField> lineFields = gd.get('WorkOrderLineItem')
        .getDescribe()
        .fields.getMap();
    String lineStatus = lineFields.containsKey('Status')
        ? pick(
              lineFields.get('Status').getDescribe(),
              new List<String>{ 'New', 'Open' }
          )
        : null;
    for (Integer i = 1; i <= countPerObject; i += 1) {
        Integer sequence = existingWorkOrderCount + i;
        SObject record = gd.get('WorkOrderLineItem').newSObject();
        putIfCreateable(
            record,
            'Subject',
            seedPrefix + ' 権限と通知設定の確認'
        );
        putIfCreateable(
            record,
            'WorkOrderId',
            insertedWorkOrders[Math.mod(i - 1, insertedWorkOrders.size())].Id
        );
        Id workOrderAccountId = (Id) insertedWorkOrders[
                Math.mod(i - 1, insertedWorkOrders.size())
            ]
            .get('AccountId');
        List<Order> accountOrders = ordersByAccountId.get(workOrderAccountId);
        if (accountOrders != null && !accountOrders.isEmpty()) {
            putIfCreateable(
                record,
                'OrderId',
                accountOrders[Math.mod(sequence - 1, accountOrders.size())].Id
            );
        }
        putIfCreateable(
            record,
            'AssetId',
            assets[Math.mod(sequence - 1, assets.size())].Id
        );
        putIfCreateable(record, 'Status', lineStatus);
        putIfCreateable(
            record,
            'Description',
            '作業担当者がユーザー権限、通知メール、活動記録の動作を確認する明細。'
        );
        workOrderLineItems.add(record);
    }
    logResults('WorkOrderLineItem', Database.insert(workOrderLineItems, false));
} else {
    System.debug(
        'Skipped records: WorkOrderLineItem: object is not createable, unavailable, or no work orders were inserted'
    );
}
