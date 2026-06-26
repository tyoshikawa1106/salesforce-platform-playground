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

void putIfCreateable(SObject record, String fieldName, Object value) {
    Map<String, Schema.SObjectField> fields = record.getSObjectType().getDescribe().fields.getMap();
    if (value != null && fields.containsKey(fieldName) && fields.get(fieldName).getDescribe().isCreateable()) {
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
        System.debug('Skipped records: ' + objectName + ': ' + String.join(errors, ' / '));
    }
}

Map<String, Schema.SObjectType> gd = Schema.getGlobalDescribe();
List<Account> accounts = [SELECT Id FROM Account WHERE Name LIKE :seedLike ORDER BY CreatedDate DESC LIMIT :countPerObject];
List<Contact> contacts = [SELECT Id FROM Contact WHERE LastName LIKE :seedLike ORDER BY CreatedDate DESC LIMIT :countPerObject];
List<Contract> contracts = [SELECT Id FROM Contract WHERE Account.Name LIKE :seedLike ORDER BY CreatedDate DESC LIMIT :countPerObject];
List<Asset> assets = [SELECT Id FROM Asset WHERE Name LIKE :seedLike ORDER BY CreatedDate DESC LIMIT :countPerObject];
List<Case> cases = [SELECT Id FROM Case WHERE Subject LIKE :seedLike ORDER BY CreatedDate DESC LIMIT :countPerObject];
if (accounts.isEmpty() || contacts.isEmpty() || assets.isEmpty() || cases.isEmpty()) {
    System.assert(false, 'Run previous standard object seed phases before service.');
}

System.debug('Seed run key: ' + seedRunKey);
List<SObject> serviceContracts = new List<SObject>();
if (gd.containsKey('ServiceContract') && gd.get('ServiceContract').getDescribe().isCreateable()) {
    String serviceStatus = pick(gd.get('ServiceContract').getDescribe().fields.getMap().get('Status').getDescribe(), new List<String>{ 'Draft' });
    for (Integer i = 1; i <= countPerObject; i += 1) {
        SObject record = gd.get('ServiceContract').newSObject();
        putIfCreateable(record, 'Name', seedPrefix + ' 年間サポート契約 ' + String.valueOf(i).leftPad(2, '0'));
        putIfCreateable(record, 'AccountId', accounts[Math.mod(i - 1, accounts.size())].Id);
        putIfCreateable(record, 'ContactId', contacts[Math.mod(i - 1, contacts.size())].Id);
        putIfCreateable(record, 'StartDate', Date.today().addDays(i));
        putIfCreateable(record, 'EndDate', Date.today().addDays(365 + i));
        putIfCreateable(record, 'Term', 12);
        putIfCreateable(record, 'Status', serviceStatus);
        putIfCreateable(record, 'Description', '問い合わせ対応、障害一次切り分け、月次利用レビューを含む年間サポート契約。');
        serviceContracts.add(record);
    }
    logResults('ServiceContract', Database.insert(serviceContracts, false));
} else {
    System.debug('Skipped records: ServiceContract: object is not createable or not available');
}

List<SObject> insertedServiceContracts = gd.containsKey('ServiceContract')
    ? Database.query('SELECT Id FROM ServiceContract WHERE Name LIKE :seedLike ORDER BY CreatedDate DESC LIMIT :countPerObject')
    : new List<SObject>();

List<SObject> entitlements = new List<SObject>();
if (gd.containsKey('Entitlement') && gd.get('Entitlement').getDescribe().isCreateable()) {
    Map<String, Schema.SObjectField> entitlementFields = gd.get('Entitlement').getDescribe().fields.getMap();
    String entitlementType = entitlementFields.containsKey('Type')
        ? pick(entitlementFields.get('Type').getDescribe(), new List<String>{ 'Web Support', 'Phone Support' })
        : null;
    List<BusinessHours> businessHours = [SELECT Id FROM BusinessHours WHERE IsDefault = TRUE LIMIT 1];
    for (Integer i = 1; i <= countPerObject; i += 1) {
        SObject record = gd.get('Entitlement').newSObject();
        putIfCreateable(record, 'Name', seedPrefix + ' 平日サポート権利 ' + String.valueOf(i).leftPad(2, '0'));
        putIfCreateable(record, 'AccountId', accounts[Math.mod(i - 1, accounts.size())].Id);
        putIfCreateable(record, 'ContactId', contacts[Math.mod(i - 1, contacts.size())].Id);
        putIfCreateable(record, 'AssetId', assets[Math.mod(i - 1, assets.size())].Id);
        if (!insertedServiceContracts.isEmpty()) {
            putIfCreateable(record, 'ServiceContractId', insertedServiceContracts[Math.mod(i - 1, insertedServiceContracts.size())].Id);
        }
        putIfCreateable(record, 'StartDate', Date.today().addDays(i));
        putIfCreateable(record, 'EndDate', Date.today().addDays(365 + i));
        putIfCreateable(record, 'Type', entitlementType);
        if (!businessHours.isEmpty()) {
            putIfCreateable(record, 'BusinessHoursId', businessHours[0].Id);
        }
        putIfCreateable(record, 'Description', '平日営業時間内の標準サポートを受けられる検証用エンタイトルメント。');
        entitlements.add(record);
    }
    logResults('Entitlement', Database.insert(entitlements, false));
} else {
    System.debug('Skipped records: Entitlement: object is not createable or not available');
}

List<SObject> insertedEntitlements = gd.containsKey('Entitlement')
    ? Database.query('SELECT Id FROM Entitlement WHERE Name LIKE :seedLike ORDER BY CreatedDate DESC LIMIT :countPerObject')
    : new List<SObject>();

List<SObject> workOrders = new List<SObject>();
if (gd.containsKey('WorkOrder') && gd.get('WorkOrder').getDescribe().isCreateable()) {
    Map<String, Schema.SObjectField> workOrderFields = gd.get('WorkOrder').getDescribe().fields.getMap();
    String workOrderStatus = workOrderFields.containsKey('Status')
        ? pick(workOrderFields.get('Status').getDescribe(), new List<String>{ 'New', 'Open' })
        : null;
    String workOrderPriority = workOrderFields.containsKey('Priority')
        ? pick(workOrderFields.get('Priority').getDescribe(), new List<String>{ 'Medium', 'High', 'Low' })
        : null;
    for (Integer i = 1; i <= countPerObject; i += 1) {
        SObject record = gd.get('WorkOrder').newSObject();
        putIfCreateable(record, 'Subject', seedPrefix + ' 導入後設定確認 ' + String.valueOf(i).leftPad(2, '0'));
        putIfCreateable(record, 'AccountId', accounts[Math.mod(i - 1, accounts.size())].Id);
        putIfCreateable(record, 'ContactId', contacts[Math.mod(i - 1, contacts.size())].Id);
        putIfCreateable(record, 'AssetId', assets[Math.mod(i - 1, assets.size())].Id);
        putIfCreateable(record, 'CaseId', cases[Math.mod(i - 1, cases.size())].Id);
        if (!insertedEntitlements.isEmpty()) {
            putIfCreateable(record, 'EntitlementId', insertedEntitlements[Math.mod(i - 1, insertedEntitlements.size())].Id);
        }
        if (!insertedServiceContracts.isEmpty()) {
            putIfCreateable(record, 'ServiceContractId', insertedServiceContracts[Math.mod(i - 1, insertedServiceContracts.size())].Id);
        }
        putIfCreateable(record, 'Status', workOrderStatus);
        putIfCreateable(record, 'Priority', workOrderPriority);
        putIfCreateable(record, 'Street', '品川 ' + i + '-2-' + Math.mod(i + 3, 9));
        putIfCreateable(record, 'City', '港区');
        putIfCreateable(record, 'PostalCode', '108-' + String.valueOf(1000 + i));
        putIfCreateable(record, 'Description', '顧客環境の初期設定、権限、通知、レポート表示を確認する作業指示。');
        workOrders.add(record);
    }
    logResults('WorkOrder', Database.insert(workOrders, false));
} else {
    System.debug('Skipped records: WorkOrder: object is not createable or not available');
}

List<SObject> insertedWorkOrders = gd.containsKey('WorkOrder')
    ? Database.query('SELECT Id FROM WorkOrder WHERE Subject LIKE :seedLike ORDER BY CreatedDate DESC LIMIT :countPerObject')
    : new List<SObject>();
List<SObject> workOrderLineItems = new List<SObject>();
if (gd.containsKey('WorkOrderLineItem') && gd.get('WorkOrderLineItem').getDescribe().isCreateable() && !insertedWorkOrders.isEmpty()) {
    Map<String, Schema.SObjectField> lineFields = gd.get('WorkOrderLineItem').getDescribe().fields.getMap();
    String lineStatus = lineFields.containsKey('Status')
        ? pick(lineFields.get('Status').getDescribe(), new List<String>{ 'New', 'Open' })
        : null;
    for (Integer i = 1; i <= countPerObject; i += 1) {
        SObject record = gd.get('WorkOrderLineItem').newSObject();
        putIfCreateable(record, 'Subject', seedPrefix + ' 権限と通知設定の確認 ' + String.valueOf(i).leftPad(2, '0'));
        putIfCreateable(record, 'WorkOrderId', insertedWorkOrders[Math.mod(i - 1, insertedWorkOrders.size())].Id);
        putIfCreateable(record, 'AssetId', assets[Math.mod(i - 1, assets.size())].Id);
        putIfCreateable(record, 'Status', lineStatus);
        putIfCreateable(record, 'Description', '作業担当者がユーザー権限、通知メール、活動記録の動作を確認する明細。');
        workOrderLineItems.add(record);
    }
    logResults('WorkOrderLineItem', Database.insert(workOrderLineItems, false));
} else {
    System.debug('Skipped records: WorkOrderLineItem: object is not createable, unavailable, or no work orders were inserted');
}
