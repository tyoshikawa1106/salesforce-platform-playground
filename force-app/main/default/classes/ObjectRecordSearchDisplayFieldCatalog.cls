/**
 * 汎用レコード検索の一覧に追加表示する固定項目を管理します。
 */
public with sharing class ObjectRecordSearchDisplayFieldCatalog {
    private static final Map<String, List<String>> DISPLAY_FIELDS_BY_OBJECT = new Map<String, List<String>>{
        'Account' => new List<String>{
            'AccountNumber',
            'Industry',
            'Type',
            'Rating',
            'Phone',
            'Website',
            'BillingState',
            'BillingCity'
        },
        'Contact' => new List<String>{
            'Title',
            'Department',
            'Email',
            'Phone',
            'MobilePhone',
            'LeadSource',
            'MailingState',
            'MailingCity',
            'Description'
        },
        'Lead' => new List<String>{
            'Company',
            'Title',
            'Status',
            'Rating',
            'Industry',
            'LeadSource',
            'Email',
            'Phone',
            'Website',
            'State',
            'City',
            'Description'
        },
        'Opportunity' => new List<String>{
            'StageName',
            'Type',
            'LeadSource',
            'CloseDate',
            'Amount',
            'Probability',
            'NextStep',
            'Description'
        },
        'OpportunityLineItem' => new List<String>{
            'Quantity',
            'UnitPrice',
            'ServiceDate',
            'Description'
        },
        'Product2' => new List<String>{
            'ProductCode',
            'Family',
            'QuantityUnitOfMeasure',
            'IsActive',
            'Description'
        },
        'Pricebook2' => new List<String>{ 'IsStandard', 'IsActive' },
        'PricebookEntry' => new List<String>{
            'UnitPrice',
            'IsActive',
            'UseStandardPrice'
        },
        'Asset' => new List<String>{
            'Status',
            'Quantity',
            'Price',
            'PurchaseDate',
            'InstallDate',
            'UsageEndDate',
            'SerialNumber',
            'Description'
        },
        'Campaign' => new List<String>{
            'Type',
            'Status',
            'IsActive',
            'StartDate',
            'EndDate',
            'ExpectedRevenue',
            'BudgetedCost',
            'ActualCost',
            'ExpectedResponse',
            'NumberSent',
            'Description'
        },
        'CampaignMember' => new List<String>{ 'Status' },
        'Case' => new List<String>{
            'Type',
            'Origin',
            'Status',
            'Priority',
            'Reason',
            'SuppliedName',
            'SuppliedEmail',
            'SuppliedPhone',
            'SuppliedCompany',
            'Description'
        },
        'Contract' => new List<String>{
            'Status',
            'StartDate',
            'ContractTerm',
            'CustomerSignedTitle',
            'CustomerSignedDate',
            'OwnerExpirationNotice',
            'BillingState',
            'BillingCity',
            'Description'
        },
        'Order' => new List<String>{
            'Type',
            'Status',
            'EffectiveDate',
            'BillingState',
            'BillingCity',
            'ShippingState',
            'ShippingCity',
            'Description'
        },
        'OrderItem' => new List<String>{
            'Quantity',
            'UnitPrice',
            'ServiceDate',
            'Description'
        },
        'Entitlement' => new List<String>{
            'Type',
            'StartDate',
            'EndDate',
            'Description'
        },
        'ServiceContract' => new List<String>{
            'Status',
            'StartDate',
            'EndDate',
            'Term',
            'BillingState',
            'BillingCity',
            'ShippingState',
            'ShippingCity',
            'ShippingHandling',
            'Tax',
            'Description'
        },
        'ContractLineItem' => new List<String>{
            'Quantity',
            'UnitPrice',
            'Discount',
            'StartDate',
            'EndDate',
            'Description'
        },
        'WorkOrder' => new List<String>{
            'Status',
            'Priority',
            'State',
            'City',
            'Description'
        },
        'WorkOrderLineItem' => new List<String>{
            'Status',
            'Description'
        },
        'Task' => new List<String>{
            'Status',
            'Priority',
            'ActivityDate',
            'Description'
        },
        'Event' => new List<String>{
            'StartDateTime',
            'EndDateTime',
            'Location',
            'ShowAs',
            'Description'
        },
        'EmailMessage' => new List<String>{
            'FromAddress',
            'ToAddress',
            'MessageDate',
            'Incoming',
            'Status',
            'TextBody'
        },
        'ContentDocument' => new List<String>{
            'FileType',
            'FileExtension',
            'ContentSize'
        }
    };
    private static final Map<Schema.DisplayType, String> DATATABLE_TYPES_BY_SCHEMA_TYPE = new Map<Schema.DisplayType, String>{
        Schema.DisplayType.Boolean => 'boolean',
        Schema.DisplayType.Currency => 'number',
        Schema.DisplayType.Date => 'date-local',
        Schema.DisplayType.DateTime => 'date',
        Schema.DisplayType.Double => 'number',
        Schema.DisplayType.Email => 'email',
        Schema.DisplayType.Integer => 'number',
        Schema.DisplayType.Percent => 'number',
        Schema.DisplayType.Phone => 'phone',
        Schema.DisplayType.Url => 'url'
    };

    /**
     * 対象オブジェクトで参照できる固定表示項目を返します。
     * @param objectApiName 対象オブジェクト API 参照名
     * @param objectDescribe 対象オブジェクトの describe 結果
     * @return 一覧に追加表示する固定項目
     */
    public static List<ObjectRecordSearchDtos.ObjectRecordDisplayField> getDisplayFields(
        String objectApiName,
        Schema.DescribeSObjectResult objectDescribe
    ) {
        List<ObjectRecordSearchDtos.ObjectRecordDisplayField> displayFields = new List<ObjectRecordSearchDtos.ObjectRecordDisplayField>();
        Map<String, Schema.SObjectField> fieldsByApiName = objectDescribe.fields.getMap();
        for (String fieldApiName : getDisplayFieldApiNames(objectApiName)) {
            if (!fieldsByApiName.containsKey(fieldApiName)) {
                continue;
            }

            Schema.DescribeFieldResult fieldDescribe = fieldsByApiName.get(
                    fieldApiName
                )
                .getDescribe();
            if (!fieldDescribe.isAccessible()) {
                continue;
            }

            displayFields.add(
                new ObjectRecordSearchDtos.ObjectRecordDisplayField(
                    fieldDescribe.getName(),
                    fieldDescribe.getLabel(),
                    getDatatableType(fieldDescribe.getType())
                )
            );
        }
        return displayFields;
    }

    private static List<String> getDisplayFieldApiNames(String objectApiName) {
        if (!DISPLAY_FIELDS_BY_OBJECT.containsKey(objectApiName)) {
            return new List<String>();
        }
        return DISPLAY_FIELDS_BY_OBJECT.get(objectApiName);
    }

    private static String getDatatableType(Schema.DisplayType fieldType) {
        return DATATABLE_TYPES_BY_SCHEMA_TYPE.get(fieldType) ?? 'text';
    }
}
