/**
 * Tests object metrics panel summaries.
 */
@IsTest
private with sharing class ObjectMetricsOverviewControllerTest {
    @IsTest
    static void shouldReturnObjectMetricsWhenRecordsExist() {
        // Given
        insertObjectMetricRecords();

        // When
        ObjectMetricsOverviewController.ObjectMetricSummary summary;
        System.runAs(getCurrentUser()) {
            Test.startTest();
            summary = ObjectMetricsOverviewController.getObjectMetrics();
            Test.stopTest();
        }

        // Then
        Map<String, Integer> metricsByKey = toMetricsByKey(summary);
        Assert.areEqual(
            1,
            metricsByKey.get('accounts'),
            'Account count should include inserted Accounts.'
        );
        Assert.areEqual(
            1,
            metricsByKey.get('contacts'),
            'Contact count should include inserted Contacts.'
        );
        Assert.areEqual(
            1,
            metricsByKey.get('tasks'),
            'Task count should include inserted Tasks.'
        );
        Assert.areEqual(
            1,
            metricsByKey.get('events'),
            'Event count should include inserted Events.'
        );
        Assert.areEqual(
            1,
            metricsByKey.get('leads'),
            'Lead count should include inserted Leads.'
        );
        Assert.areEqual(
            1,
            metricsByKey.get('opportunities'),
            'Opportunity count should include inserted Opportunities.'
        );
        Assert.areEqual(
            1,
            metricsByKey.get('products'),
            'Product count should include inserted Products.'
        );
        Assert.areEqual(
            1,
            metricsByKey.get('campaigns'),
            'Campaign count should include inserted Campaigns.'
        );
        Assert.areEqual(
            1,
            metricsByKey.get('cases'),
            'Case count should include inserted Cases.'
        );
        Assert.areEqual(
            0,
            metricsByKey.get('emailMessages'),
            'EmailMessage count should be zero when no EmailMessages exist.'
        );
        Assert.isNotNull(
            metricsByKey.get('users'),
            'Active user count should be returned.'
        );
        Assert.areEqual(
            12,
            summary.metrics.size(),
            'All object metric cards should have a matching metric item.'
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

        // When
        ObjectMetricsOverviewController.ObjectMetricSummary summary;
        System.runAs(getCurrentUser()) {
            Test.startTest();
            summary = ObjectMetricsOverviewController.getObjectMetrics();
            Test.stopTest();
        }

        // Then
        Map<String, Integer> metricsByKey = toMetricsByKey(summary);
        Assert.areEqual(
            2,
            metricsByKey.get('recycleBinItems'),
            'Recycle Bin count should include deleted Account and Contact records.'
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

    private static Map<String, Integer> toMetricsByKey(
        ObjectMetricsOverviewController.ObjectMetricSummary summary
    ) {
        Map<String, Integer> metricsByKey = new Map<String, Integer>();
        for (
            ObjectMetricsOverviewController.ObjectMetricItem metricItem : summary.metrics
        ) {
            metricsByKey.put(metricItem.key, metricItem.value);
        }
        return metricsByKey;
    }

    private static User getCurrentUser() {
        return new User(Id = UserInfo.getUserId());
    }
}
