/**
 * Queries object metric overview counts.
 */
public with sharing class ObjectMetricsOverviewSelector {
    /**
     * Retrieves object metric values keyed by display metric key.
     * @return Metric values for the object metrics overview.
     */
    public Map<String, Integer> getObjectMetricValues() {
        return new Map<String, Integer>{
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
        Id deletedByUserId = UserInfo.getUserId();
        Integer totalCount = 0;

        if (isObjectAccessible('Account')) {
            totalCount += countDeletedAccounts(deletedByUserId);
        }
        if (isObjectAccessible('Contact')) {
            totalCount += countDeletedContacts(deletedByUserId);
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
}
