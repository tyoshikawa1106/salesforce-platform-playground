/**
 * Queries object metric overview counts.
 */
public virtual with sharing class ObjectMetricsOverviewSelector {
    private static final Integer MAX_DISPLAY_COUNT = 50000;

    /**
     * Retrieves object metric values keyed by display metric key.
     * @return Metric values for the object metrics overview.
     */
    public virtual Map<String, ObjectMetricCount> getObjectMetricValues() {
        return new Map<String, ObjectMetricCount>{
            'accounts' => countVisibleRecords('Account'),
            'contacts' => countVisibleRecords('Contact'),
            'events' => countVisibleRecords('Event'),
            'tasks' => countVisibleRecords('Task'),
            'users' => countVisibleRecords('User'),
            'recycleBinItems' => countRecycleBinItems(),
            'leads' => countVisibleRecords('Lead'),
            'opportunities' => countVisibleRecords('Opportunity'),
            'products' => countVisibleRecords('Product2'),
            'campaigns' => countVisibleRecords('Campaign'),
            'cases' => countVisibleRecords('Case'),
            'emailMessages' => countVisibleRecords('EmailMessage')
        };
    }

    /**
     * Creates a count result with display limit handling.
     * @param value Count value.
     * @return Count result with the capped marker when the display limit is reached.
     */
    @TestVisible
    private static ObjectMetricCount createCount(Integer value) {
        Integer safeValue = value ?? 0;
        return safeValue >= MAX_DISPLAY_COUNT
            ? createCappedCount()
            : new ObjectMetricCount(safeValue, false);
    }

    /**
     * Creates a capped count result.
     * @return Count result with the capped marker.
     */
    private static ObjectMetricCount createCappedCount() {
        return new ObjectMetricCount(MAX_DISPLAY_COUNT, true);
    }

    @TestVisible
    private ObjectMetricCount countVisibleRecords(String objectApiName) {
        if (
            String.isBlank(objectApiName) || !isObjectAccessible(objectApiName)
        ) {
            return toObjectMetricCount(0);
        }

        switch on objectApiName {
            when 'Account' {
                return toObjectMetricCount(
                    [
                        SELECT COUNT()
                        FROM Account
                        WITH USER_MODE
                        LIMIT :MAX_DISPLAY_COUNT
                    ]
                );
            }
            when 'Contact' {
                return toObjectMetricCount(
                    [
                        SELECT COUNT()
                        FROM Contact
                        WITH USER_MODE
                        LIMIT :MAX_DISPLAY_COUNT
                    ]
                );
            }
            when 'Event' {
                return toObjectMetricCount(
                    [
                        SELECT COUNT()
                        FROM Event
                        WITH USER_MODE
                        LIMIT :MAX_DISPLAY_COUNT
                    ]
                );
            }
            when 'Task' {
                return toObjectMetricCount(
                    [
                        SELECT COUNT()
                        FROM Task
                        WITH USER_MODE
                        LIMIT :MAX_DISPLAY_COUNT
                    ]
                );
            }
            when 'User' {
                return toObjectMetricCount(
                    [
                        SELECT COUNT()
                        FROM User
                        WHERE IsActive = TRUE
                        WITH USER_MODE
                        LIMIT :MAX_DISPLAY_COUNT
                    ]
                );
            }
            when 'Lead' {
                return toObjectMetricCount(
                    [
                        SELECT COUNT()
                        FROM Lead
                        WITH USER_MODE
                        LIMIT :MAX_DISPLAY_COUNT
                    ]
                );
            }
            when 'Opportunity' {
                return toObjectMetricCount(
                    [
                        SELECT COUNT()
                        FROM Opportunity
                        WITH USER_MODE
                        LIMIT :MAX_DISPLAY_COUNT
                    ]
                );
            }
            when 'Product2' {
                return toObjectMetricCount(
                    [
                        SELECT COUNT()
                        FROM Product2
                        WITH USER_MODE
                        LIMIT :MAX_DISPLAY_COUNT
                    ]
                );
            }
            when 'Campaign' {
                return toObjectMetricCount(
                    [
                        SELECT COUNT()
                        FROM Campaign
                        WITH USER_MODE
                        LIMIT :MAX_DISPLAY_COUNT
                    ]
                );
            }
            when 'Case' {
                return toObjectMetricCount(
                    [
                        SELECT COUNT()
                        FROM Case
                        WITH USER_MODE
                        LIMIT :MAX_DISPLAY_COUNT
                    ]
                );
            }
            when 'EmailMessage' {
                return toObjectMetricCount(
                    [
                        SELECT COUNT()
                        FROM EmailMessage
                        WITH USER_MODE
                        LIMIT :MAX_DISPLAY_COUNT
                    ]
                );
            }
            when else {
                return toObjectMetricCount(0);
            }
        }
    }

    private ObjectMetricCount countRecycleBinItems() {
        Id deletedByUserId = UserInfo.getUserId();
        Integer totalCount = 0;
        Boolean capped = false;

        if (isObjectAccessible('Account')) {
            ObjectMetricCount accountCount = countDeletedAccounts(
                deletedByUserId
            );
            totalCount += accountCount.value;
            capped = capped || accountCount.capped;
        }
        if (isObjectAccessible('Contact')) {
            ObjectMetricCount contactCount = countDeletedContacts(
                deletedByUserId
            );
            totalCount += contactCount.value;
            capped = capped || contactCount.capped;
        }

        return capped ? createCappedCount() : toObjectMetricCount(totalCount);
    }

    private ObjectMetricCount countDeletedAccounts(Id deletedByUserId) {
        return toObjectMetricCount(
            [
                SELECT COUNT()
                FROM Account
                WHERE IsDeleted = TRUE AND LastModifiedById = :deletedByUserId
                WITH USER_MODE
                LIMIT :MAX_DISPLAY_COUNT
                ALL ROWS
            ]
        );
    }

    private ObjectMetricCount countDeletedContacts(Id deletedByUserId) {
        return toObjectMetricCount(
            [
                SELECT COUNT()
                FROM Contact
                WHERE IsDeleted = TRUE AND LastModifiedById = :deletedByUserId
                WITH USER_MODE
                LIMIT :MAX_DISPLAY_COUNT
                ALL ROWS
            ]
        );
    }

    private Boolean isObjectAccessible(String objectApiName) {
        Schema.SObjectType sObjectType = Schema.getGlobalDescribe()
            .get(objectApiName);
        return sObjectType != null &&
            sObjectType.getDescribe(SObjectDescribeOptions.DEFERRED)
                .isAccessible();
    }

    private ObjectMetricCount toObjectMetricCount(Integer value) {
        return createCount(value);
    }

    /**
     * Count result with display limit metadata.
     */
    public class ObjectMetricCount {
        /**
         * Count value capped at the display limit.
         */
        public Integer value { get; private set; }

        /**
         * Whether the count reached the display limit.
         */
        public Boolean capped { get; private set; }

        /**
         * Creates a bounded count.
         * @param value Count value capped for display.
         * @param capped Whether the count reached the display limit.
         */
        private ObjectMetricCount(Integer value, Boolean capped) {
            this.value = value;
            this.capped = capped;
        }
    }
}
