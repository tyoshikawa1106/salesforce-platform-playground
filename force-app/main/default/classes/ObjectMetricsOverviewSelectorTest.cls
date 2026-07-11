/**
 * オブジェクト件数一覧 Selector の件数取得テスト
 */
@IsTest
private with sharing class ObjectMetricsOverviewSelectorTest {

    private static User testUser = TestDataFactory.getTestUser();

    /**
     * 存在する各オブジェクトの件数をメトリクス別に返却
     */
    @IsTest
    static void shouldReturnMetricValuesWhenRecordsExist() {
        // 準備
        insertObjectMetricRecords();
        ObjectMetricsOverviewSelector selector = new ObjectMetricsOverviewSelector();

        // 実行
        Map<String, ObjectMetricsOverviewSelector.ObjectMetricCount> metricsByKey;

        System.runAs(testUser) {
            Test.startTest();

            // 作成済みレコードをメトリクスキー別の件数へ集計
            metricsByKey = selector.getObjectMetricValues();

            Test.stopTest();
        }

        // 検証
        Assert.areEqual(
            ObjectMetricCatalog.getDefinitions().size(),
            metricsByKey.size(),
            'Selector はすべてのオブジェクトメトリクスキーを返す必要あり'
        );
        Assert.areEqual(
            1,
            metricsByKey.get('accounts').value,
            'Account 件数は作成済み取引先を含める必要あり'
        );
        Assert.isFalse(
            metricsByKey.get('accounts').capped,
            '少数の Account 件数は上限到達扱いにしない必要あり'
        );
        Assert.areEqual(
            1,
            metricsByKey.get('contacts').value,
            'Contact 件数は作成済み取引先責任者を含める必要あり'
        );
        Assert.areEqual(
            1,
            metricsByKey.get('tasks').value,
            'Task 件数は作成済み ToDo を含める必要あり'
        );
        Assert.areEqual(
            1,
            metricsByKey.get('events').value,
            'Event 件数は作成済み行動を含める必要あり'
        );
        Assert.areEqual(
            1,
            metricsByKey.get('leads').value,
            'Lead 件数は作成済みリードを含める必要あり'
        );
        Assert.areEqual(
            1,
            metricsByKey.get('opportunities').value,
            'Opportunity 件数は作成済み商談を含める必要あり'
        );
        Assert.areEqual(
            1,
            metricsByKey.get('opportunityLineItems').value,
            'OpportunityLineItem 件数は作成済み商談商品を含める必要あり'
        );
        Assert.areEqual(
            1,
            metricsByKey.get('contracts').value,
            'Contract 件数は作成済み契約を含める必要あり'
        );
        Assert.areEqual(
            1,
            metricsByKey.get('products').value,
            'Product 件数は作成済み商品を含める必要あり'
        );
        Assert.isNotNull(
            metricsByKey.get('pricebooks').value,
            'Pricebook 件数を返す必要あり'
        );
        Assert.isNotNull(
            metricsByKey.get('pricebookEntries').value,
            'PricebookEntry 件数を返す必要あり'
        );
        Assert.isNotNull(
            metricsByKey.get('assets').value,
            'Asset 件数を返す必要あり'
        );
        Assert.areEqual(
            1,
            metricsByKey.get('campaigns').value,
            'Campaign 件数は作成済みキャンペーンを含める必要あり'
        );
        Assert.areEqual(
            1,
            metricsByKey.get('cases').value,
            'Case 件数は作成済みケースを含める必要あり'
        );
        Assert.areEqual(
            0,
            metricsByKey.get('emailMessages').value,
            'EmailMessage がない場合は件数を 0 にする必要あり'
        );
        Assert.isNotNull(
            metricsByKey.get('emailTemplates').value,
            'EmailTemplate 件数を返す必要あり'
        );
        Assert.isNotNull(
            metricsByKey.get('reports').value,
            'Report 件数を返す必要あり'
        );
        Assert.isNotNull(
            metricsByKey.get('dashboards').value,
            'Dashboard 件数を返す必要あり'
        );
        Assert.isNotNull(
            metricsByKey.get('files').value,
            'ContentDocument 件数を返す必要あり'
        );
        Assert.isNotNull(
            metricsByKey.get('orders').value,
            'Order 件数を返す必要あり'
        );
        Assert.isNotNull(
            metricsByKey.get('orderItems').value,
            'OrderItem 件数を返す必要あり'
        );
        Assert.isNotNull(
            metricsByKey.get('entitlements').value,
            'Entitlement 件数を返す必要あり'
        );
        Assert.isNotNull(
            metricsByKey.get('serviceContracts').value,
            'ServiceContract 件数を返す必要あり'
        );
        Assert.isNotNull(
            metricsByKey.get('workOrders').value,
            'WorkOrder 件数を返す必要あり'
        );
        Assert.isNotNull(
            metricsByKey.get('workOrderLineItems').value,
            'WorkOrderLineItem 件数を返す必要あり'
        );
        Assert.isNotNull(
            metricsByKey.get('knowledgeArticles').value,
            'KnowledgeArticleVersion 件数を返す必要あり'
        );
        Assert.isFalse(
            metricsByKey.containsKey('processInstances'),
            'ProcessInstance 件数は返さない必要あり'
        );
        Assert.isFalse(
            metricsByKey.containsKey('processInstanceWorkitems'),
            'ProcessInstanceWorkitem 件数は返さない必要あり'
        );
        Assert.isFalse(
            metricsByKey.containsKey('processInstanceSteps'),
            'ProcessInstanceStep 件数は返さない必要あり'
        );
        Assert.isNotNull(
            metricsByKey.get('users').value,
            '有効ユーザー件数を返す必要あり'
        );
    }

    /**
     * 未対応オブジェクトの件数は 0 として返却
     */
    @IsTest
    static void shouldReturnZeroWhenObjectApiNameIsUnknown() {
        // 準備
        ObjectMetricsOverviewSelector selector = new ObjectMetricsOverviewSelector();

        // 実行
        ObjectMetricsOverviewSelector.ObjectMetricCount metricCount;

        System.runAs(testUser) {
            Test.startTest();

            // 未対応オブジェクトは安全なゼロ件カウントへ変換
            metricCount = selector.countVisibleRecords('UnknownObject__c');

            Test.stopTest();
        }

        // 検証
        Assert.areEqual(
            0,
            metricCount.value,
            '未知のオブジェクト API 名は 0 を返す必要あり'
        );
        Assert.isFalse(
            metricCount.capped,
            '未知のオブジェクト API 名は上限到達扱いにしない必要あり'
        );
    }

    /**
     * オブジェクト API 名が集計対象か判定
     */
    @IsTest
    static void shouldExposeWhetherObjectApiNameIsConfigured() {

        System.runAs(testUser) {
            Test.startTest();
            // カタログ対象外のオブジェクト名を件数対象から除外
            Boolean hasAccount = ObjectMetricCatalog.hasObjectApiName(
                'Account'
            );
            Boolean hasUnknownObject = ObjectMetricCatalog.hasObjectApiName(
                'UnknownObject__c'
            );
            Boolean hasBlankObject = ObjectMetricCatalog.hasObjectApiName(' ');

            Test.stopTest();

            Assert.isTrue(
                hasAccount,
                'Account は設定済みメトリクスオブジェクトとして利用可能な必要あり'
            );
            Assert.isFalse(
                hasUnknownObject,
                '未知のオブジェクトは設定済みメトリクスとして扱わない必要あり'
            );
            Assert.isFalse(
                hasBlankObject,
                '空白のオブジェクト API 名は設定済みメトリクスとして扱わない必要あり'
            );
        }

    }

    /**
     * 空のオブジェクト API 名は 0 件として返却
     */
    @IsTest
    static void shouldReturnZeroWhenObjectApiNameIsBlank() {
        // 準備
        ObjectMetricsOverviewSelector selector = new ObjectMetricsOverviewSelector();

        // 実行
        ObjectMetricsOverviewSelector.ObjectMetricCount metricCount;

        System.runAs(testUser) {
            Test.startTest();

            // 空白のオブジェクト名は安全なゼロ件カウントへ変換
            metricCount = selector.countVisibleRecords(' ');

            Test.stopTest();
        }

        // 検証
        Assert.areEqual(
            0,
            metricCount.value,
            '空白のオブジェクト API 名は 0 を返す必要あり'
        );
        Assert.isFalse(
            metricCount.capped,
            '空白のオブジェクト API 名は上限到達扱いにしない必要あり'
        );
    }

    /**
     * 表示上限を超えた件数は上限値で返却
     */
    @IsTest
    static void shouldCapMetricCountWhenDisplayLimitIsReached() {
        // 実行
        ObjectMetricsOverviewSelector.ObjectMetricCount exactCount;
        ObjectMetricsOverviewSelector.ObjectMetricCount cappedCount;

        System.runAs(testUser) {
            Test.startTest();

            // 表示上限の前後で capped 判定を分岐
            exactCount = ObjectMetricsOverviewSelector.createCount(49999);
            cappedCount = ObjectMetricsOverviewSelector.createCount(50000);

            Test.stopTest();
        }

        // 検証
        Assert.areEqual(
            49999,
            exactCount.value,
            '表示上限未満の件数は正確な値を保つ必要あり'
        );
        Assert.isFalse(
            exactCount.capped,
            '表示上限未満の件数は上限到達扱いにしない必要あり'
        );
        Assert.areEqual(
            50000,
            cappedCount.value,
            '表示上限の件数は表示上限値を保つ必要あり'
        );
        Assert.isTrue(
            cappedCount.capped,
            '表示上限の件数は上限到達フラグを持つ必要あり'
        );
    }

    private static void insertObjectMetricRecords() {
        Account accountRecord = TestDataFactory.createAccount('件数取引先', TestDataFactory.SaveMode.INSERT_RECORD);
        TestDataFactory.createContact(accountRecord, '件数責任者', TestDataFactory.SaveMode.INSERT_RECORD);
        insert new Task(Subject = '件数 ToDo', Status = 'Not Started');
        insert new Event(
            Subject = '件数 行動',
            StartDateTime = Datetime.now().addHours(1),
            EndDateTime = Datetime.now().addHours(2)
        );
        TestDataFactory.createLead('件数リード', '件数会社', TestDataFactory.SaveMode.INSERT_RECORD);
        Opportunity opportunityRecord = TestDataFactory.createOpportunity(
            accountRecord,
            '件数商談', TestDataFactory.SaveMode.INSERT_RECORD
        );
        Product2 productRecord = TestDataFactory.createProduct('件数商品', TestDataFactory.SaveMode.INSERT_RECORD);
        PricebookEntry pricebookEntryRecord = TestDataFactory.createPricebookEntry(productRecord, TestDataFactory.SaveMode.INSERT_RECORD);
        TestDataFactory.createOpportunityLineItem(
            opportunityRecord,
            pricebookEntryRecord, TestDataFactory.SaveMode.INSERT_RECORD
        );
        insert new Campaign(Name = '件数キャンペーン');
        TestDataFactory.createCase('件数ケース', TestDataFactory.SaveMode.INSERT_RECORD);
        insert new Contract(
            AccountId = accountRecord.Id,
            Status = 'Draft',
            StartDate = Date.today(),
            ContractTerm = 12
        );
    }
}
