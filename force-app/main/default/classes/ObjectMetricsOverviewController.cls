/**
 * Supplies object metric summaries for the object metrics panel Lightning Web Component.
 */
public with sharing class ObjectMetricsOverviewController {
    private static final List<CountDefinition> COUNT_DEFINITIONS = new List<CountDefinition>{
        new CountDefinition('accounts', 'Account'),
        new CountDefinition('contacts', 'Contact'),
        new CountDefinition('events', 'Event'),
        new CountDefinition('tasks', 'Task'),
        new CountDefinition('users', 'User'),
        new CountDefinition('leads', 'Lead'),
        new CountDefinition('opportunities', 'Opportunity'),
        new CountDefinition('products', 'Product2'),
        new CountDefinition('campaigns', 'Campaign'),
        new CountDefinition('cases', 'Case'),
        new CountDefinition('emailMessages', 'EmailMessage')
    };
    private static final List<String> RECYCLE_BIN_OBJECT_API_NAMES = new List<String>{
        'Account',
        'Contact'
    };

    /**
     * Counts object records visible to the current user.
     * @return Ordered record count summary for the LWC.
     */
    @AuraEnabled(cacheable=true)
    public static ObjectMetricSummary getObjectMetrics() {
        try {
            ObjectMetricsOverviewController controller = new ObjectMetricsOverviewController();
            return controller.createObjectMetricSummary();
        } catch (Exception error) {
            throw new AuraHandledException(
                'オブジェクト指標を読み込めませんでした。'
            );
        }
    }

    private ObjectMetricSummary createObjectMetricSummary() {
        List<ObjectMetricItem> metricItems = new List<ObjectMetricItem>();

        for (CountDefinition definition : COUNT_DEFINITIONS) {
            metricItems.add(
                new ObjectMetricItem(
                    definition.key,
                    countVisibleRecords(definition.objectApiName)
                )
            );
        }

        metricItems.add(
            new ObjectMetricItem('recycleBinItems', countRecycleBinItems())
        );

        return new ObjectMetricSummary(metricItems);
    }

    private Integer countVisibleRecords(String objectApiName) {
        if (!isObjectAccessible(objectApiName)) {
            return 0;
        }

        switch on objectApiName {
            when 'Account' {
                return [SELECT COUNT() FROM Account WITH USER_MODE];
            }
            when 'Contact' {
                return [SELECT COUNT() FROM Contact WITH USER_MODE];
            }
            when 'Event' {
                return [SELECT COUNT() FROM Event WITH USER_MODE];
            }
            when 'Task' {
                return [SELECT COUNT() FROM Task WITH USER_MODE];
            }
            when 'User' {
                return [
                    SELECT COUNT()
                    FROM User
                    WHERE IsActive = TRUE
                    WITH USER_MODE
                ];
            }
            when 'Lead' {
                return [SELECT COUNT() FROM Lead WITH USER_MODE];
            }
            when 'Opportunity' {
                return [SELECT COUNT() FROM Opportunity WITH USER_MODE];
            }
            when 'Product2' {
                return [SELECT COUNT() FROM Product2 WITH USER_MODE];
            }
            when 'Campaign' {
                return [SELECT COUNT() FROM Campaign WITH USER_MODE];
            }
            when 'Case' {
                return [SELECT COUNT() FROM Case WITH USER_MODE];
            }
            when 'EmailMessage' {
                return [SELECT COUNT() FROM EmailMessage WITH USER_MODE];
            }
            when else {
                return 0;
            }
        }
    }

    private Integer countRecycleBinItems() {
        Integer totalCount = 0;
        Id deletedByUserId = UserInfo.getUserId();

        for (String objectApiName : RECYCLE_BIN_OBJECT_API_NAMES) {
            if (!isObjectAccessible(objectApiName)) {
                continue;
            }

            if (objectApiName == 'Account') {
                totalCount += countDeletedAccounts(deletedByUserId);
            } else if (objectApiName == 'Contact') {
                totalCount += countDeletedContacts(deletedByUserId);
            }
        }

        return totalCount;
    }

    private Integer countDeletedAccounts(Id deletedByUserId) {
        return [
            SELECT COUNT()
            FROM Account
            WHERE IsDeleted = TRUE AND LastModifiedById = :deletedByUserId
            WITH USER_MODE
            ALL ROWS
        ];
    }

    private Integer countDeletedContacts(Id deletedByUserId) {
        return [
            SELECT COUNT()
            FROM Contact
            WHERE IsDeleted = TRUE AND LastModifiedById = :deletedByUserId
            WITH USER_MODE
            ALL ROWS
        ];
    }

    private Boolean isObjectAccessible(String objectApiName) {
        Schema.SObjectType sObjectType = Schema.getGlobalDescribe()
            .get(objectApiName);
        return sObjectType != null &&
            sObjectType.getDescribe(SObjectDescribeOptions.DEFERRED)
                .isAccessible();
    }

    private class CountDefinition {
        private final String key;
        private final String objectApiName;

        private CountDefinition(String key, String objectApiName) {
            this.key = key;
            this.objectApiName = objectApiName;
        }
    }

    /**
     * Response DTO for object metric results.
     */
    public class ObjectMetricSummary {
        /**
         * Ordered metric items displayed by the LWC.
         */
        @AuraEnabled
        public List<ObjectMetricItem> metrics { get; private set; }

        private ObjectMetricSummary(List<ObjectMetricItem> metrics) {
            this.metrics = metrics;
        }
    }

    /**
     * Single object metric item.
     */
    public class ObjectMetricItem {
        /**
         * Stable card key used by the LWC display configuration.
         */
        @AuraEnabled
        public String key { get; private set; }

        /**
         * Metric value for the key.
         */
        @AuraEnabled
        public Integer value { get; private set; }

        private ObjectMetricItem(String key, Integer value) {
            this.key = key;
            this.value = value;
        }
    }
}
