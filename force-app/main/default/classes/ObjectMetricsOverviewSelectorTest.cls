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
            12,
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
            metricsByKey.get('products').value,
            'Product count should include inserted Products.'
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
            metricsByKey.get('users').value,
            'Active user count should be returned.'
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
    static void shouldCountCurrentUsersDeletedAccountAndContact() {
        // Given
        Account deletedAccount = TestDataFactory.insertAccount(
            '削除済み取引先'
        );
        Contact deletedContact = new Contact(
            LastName = '削除済み責任者',
            AccountId = deletedAccount.Id
        );
        insert deletedContact;
        delete new List<SObject>{ deletedContact, deletedAccount };
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
            2,
            metricsByKey.get('recycleBinItems').value,
            'Recycle Bin count should include deleted Account and Contact records.'
        );
        Assert.isFalse(
            metricsByKey.get('recycleBinItems').capped,
            'Small Recycle Bin counts should not be capped.'
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
        insert new Opportunity(
            Name = '件数商談',
            StageName = 'Prospecting',
            CloseDate = Date.today().addDays(30),
            AccountId = accountRecord.Id
        );
        insert new Product2(Name = '件数商品', IsActive = true);
        insert new Campaign(Name = '件数キャンペーン');
        insert new Case(Subject = '件数ケース');
    }

    private static User getCurrentUser() {
        return new User(Id = UserInfo.getUserId());
    }
}
