/**
 * Tests object metrics overview selector counts.
 */
@IsTest
private with sharing class ObjectMetricsOverviewSelectorTest {
    @IsTest
    static void shouldReturnMetricValuesWhenRecordsExist() {
        // Given
        insertObjectMetricRecords();
        ObjectMetricsOverviewSelector selector = new ObjectMetricsOverviewSelector();

        // When
        Map<String, ObjectMetricsOverviewSelector.ObjectMetricCount> metricsByKey;
        System.runAs(getCurrentUser()) {
            Test.startTest();
            metricsByKey = selector.getObjectMetricValues();
            Test.stopTest();
        }

        // Then
        Assert.areEqual(
            27,
            metricsByKey.size(),
            'Selector should return all object metric keys.'
        );
        Assert.areEqual(
            1,
            metricsByKey.get('accounts').value,
            'Account count should include inserted Accounts.'
        );
        Assert.isFalse(
            metricsByKey.get('accounts').capped,
            'Small Account counts should not be capped.'
        );
        Assert.areEqual(
            1,
            metricsByKey.get('contacts').value,
            'Contact count should include inserted Contacts.'
        );
        Assert.areEqual(
            1,
            metricsByKey.get('tasks').value,
            'Task count should include inserted Tasks.'
        );
        Assert.areEqual(
            1,
            metricsByKey.get('events').value,
            'Event count should include inserted Events.'
        );
        Assert.areEqual(
            1,
            metricsByKey.get('leads').value,
            'Lead count should include inserted Leads.'
        );
        Assert.areEqual(
            1,
            metricsByKey.get('opportunities').value,
            'Opportunity count should include inserted Opportunities.'
        );
        Assert.areEqual(
            1,
            metricsByKey.get('opportunityLineItems').value,
            'OpportunityLineItem count should include inserted Opportunity Products.'
        );
        Assert.areEqual(
            1,
            metricsByKey.get('contracts').value,
            'Contract count should include inserted Contracts.'
        );
        Assert.areEqual(
            1,
            metricsByKey.get('products').value,
            'Product count should include inserted Products.'
        );
        Assert.isNotNull(
            metricsByKey.get('pricebooks').value,
            'Pricebook count should be returned.'
        );
        Assert.isNotNull(
            metricsByKey.get('pricebookEntries').value,
            'PricebookEntry count should be returned.'
        );
        Assert.isNotNull(
            metricsByKey.get('assets').value,
            'Asset count should be returned.'
        );
        Assert.areEqual(
            1,
            metricsByKey.get('campaigns').value,
            'Campaign count should include inserted Campaigns.'
        );
        Assert.areEqual(
            1,
            metricsByKey.get('cases').value,
            'Case count should include inserted Cases.'
        );
        Assert.areEqual(
            0,
            metricsByKey.get('emailMessages').value,
            'EmailMessage count should be zero when no EmailMessages exist.'
        );
        Assert.isNotNull(
            metricsByKey.get('emailTemplates').value,
            'EmailTemplate count should be returned.'
        );
        Assert.isNotNull(
            metricsByKey.get('orders').value,
            'Order count should be returned.'
        );
        Assert.isNotNull(
            metricsByKey.get('orderItems').value,
            'OrderItem count should be returned.'
        );
        Assert.isNotNull(
            metricsByKey.get('entitlements').value,
            'Entitlement count should be returned.'
        );
        Assert.isNotNull(
            metricsByKey.get('serviceContracts').value,
            'ServiceContract count should be returned.'
        );
        Assert.isNotNull(
            metricsByKey.get('workOrders').value,
            'WorkOrder count should be returned.'
        );
        Assert.isNotNull(
            metricsByKey.get('workOrderLineItems').value,
            'WorkOrderLineItem count should be returned.'
        );
        Assert.isNotNull(
            metricsByKey.get('knowledgeArticles').value,
            'KnowledgeArticleVersion count should be returned.'
        );
        Assert.isNotNull(
            metricsByKey.get('processInstances').value,
            'ProcessInstance count should be returned.'
        );
        Assert.isNotNull(
            metricsByKey.get('processInstanceWorkitems').value,
            'ProcessInstanceWorkitem count should be returned.'
        );
        Assert.isNotNull(
            metricsByKey.get('processInstanceSteps').value,
            'ProcessInstanceStep count should be returned.'
        );
        Assert.isNotNull(
            metricsByKey.get('users').value,
            'Active user count should be returned.'
        );
    }

    @IsTest
    static void shouldReturnZeroWhenObjectApiNameIsUnknown() {
        // Given
        ObjectMetricsOverviewSelector selector = new ObjectMetricsOverviewSelector();

        // When
        ObjectMetricsOverviewSelector.ObjectMetricCount metricCount;
        System.runAs(getCurrentUser()) {
            Test.startTest();
            metricCount = selector.countVisibleRecords('UnknownObject__c');
            Test.stopTest();
        }

        // Then
        Assert.areEqual(
            0,
            metricCount.value,
            'Unknown object API names should return zero.'
        );
        Assert.isFalse(
            metricCount.capped,
            'Unknown object API names should not be capped.'
        );
    }

    @IsTest
    static void shouldReturnZeroWhenObjectApiNameIsBlank() {
        // Given
        ObjectMetricsOverviewSelector selector = new ObjectMetricsOverviewSelector();

        // When
        ObjectMetricsOverviewSelector.ObjectMetricCount metricCount;
        System.runAs(getCurrentUser()) {
            Test.startTest();
            metricCount = selector.countVisibleRecords(' ');
            Test.stopTest();
        }

        // Then
        Assert.areEqual(
            0,
            metricCount.value,
            'Blank object API names should return zero.'
        );
        Assert.isFalse(
            metricCount.capped,
            'Blank object API names should not be capped.'
        );
    }

    @IsTest
    static void shouldCapMetricCountWhenDisplayLimitIsReached() {
        // When
        ObjectMetricsOverviewSelector.ObjectMetricCount exactCount;
        ObjectMetricsOverviewSelector.ObjectMetricCount cappedCount;
        System.runAs(getCurrentUser()) {
            Test.startTest();
            exactCount = ObjectMetricsOverviewSelector.createCount(49999);
            cappedCount = ObjectMetricsOverviewSelector.createCount(50000);
            Test.stopTest();
        }

        // Then
        Assert.areEqual(
            49999,
            exactCount.value,
            'Counts below the display limit should keep the exact value.'
        );
        Assert.isFalse(
            exactCount.capped,
            'Counts below the display limit should not be capped.'
        );
        Assert.areEqual(
            50000,
            cappedCount.value,
            'Counts at the display limit should keep the display limit value.'
        );
        Assert.isTrue(
            cappedCount.capped,
            'Counts at the display limit should carry the capped marker.'
        );
    }

    private static void insertObjectMetricRecords() {
        Account accountRecord = TestDataFactory.insertAccount('件数取引先');
        insert new Contact(
            LastName = '件数責任者',
            AccountId = accountRecord.Id
        );
        insert new Task(Subject = '件数 ToDo', Status = 'Not Started');
        insert new Event(
            Subject = '件数 行動',
            StartDateTime = Datetime.now().addHours(1),
            EndDateTime = Datetime.now().addHours(2)
        );
        insert new Lead(LastName = '件数リード', Company = '件数会社');
        Opportunity opportunityRecord = new Opportunity(
            Name = '件数商談',
            StageName = 'Prospecting',
            CloseDate = Date.today().addDays(30),
            AccountId = accountRecord.Id
        );
        insert opportunityRecord;
        Product2 productRecord = new Product2(
            Name = '件数商品',
            IsActive = true
        );
        insert productRecord;
        PricebookEntry pricebookEntryRecord = new PricebookEntry(
            Pricebook2Id = Test.getStandardPricebookId(),
            Product2Id = productRecord.Id,
            UnitPrice = 100,
            IsActive = true
        );
        insert pricebookEntryRecord;
        insert new OpportunityLineItem(
            OpportunityId = opportunityRecord.Id,
            PricebookEntryId = pricebookEntryRecord.Id,
            Quantity = 1,
            UnitPrice = 100
        );
        insert new Campaign(Name = '件数キャンペーン');
        insert new Case(Subject = '件数ケース');
        insert new Contract(
            AccountId = accountRecord.Id,
            Status = 'Draft',
            StartDate = Date.today(),
            ContractTerm = 12
        );
    }

    private static User getCurrentUser() {
        return new User(Id = UserInfo.getUserId());
    }
}
