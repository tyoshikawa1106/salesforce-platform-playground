// Run: npm run setup:data:standard -- --target-org <alias> --only standard-objects-products
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

String pickAt(Schema.DescribeFieldResult fieldDescribe, List<String> preferred, Integer index) {
    List<String> candidates = new List<String>();
    for (String value : preferred) {
        for (Schema.PicklistEntry entry : fieldDescribe.getPicklistValues()) {
            if (entry.isActive() && entry.getValue() == value) {
                candidates.add(entry.getValue());
                break;
            }
        }
    }
    for (Schema.PicklistEntry entry : fieldDescribe.getPicklistValues()) {
        if (entry.isActive() && !candidates.contains(entry.getValue())) {
            candidates.add(entry.getValue());
        }
    }
    return candidates.isEmpty() ? null : candidates[Math.mod(index, candidates.size())];
}

String testEmail(Integer sequence) {
    return 'test+' + String.valueOf(sequence).leftPad(4, '0') + '@example.com';
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

void putIfCreateable(SObject record, String fieldName, Object value) {
    Map<String, Schema.SObjectField> fields = record.getSObjectType().getDescribe().fields.getMap();
    if (value != null && fields.containsKey(fieldName) && fields.get(fieldName).getDescribe().isCreateable()) {
        record.put(fieldName, value);
    }
}

String pad3(Integer value) { return String.valueOf(value).leftPad(3, '0'); }
String quantityUnit = pick(Product2.QuantityUnitOfMeasure.getDescribe(), new List<String>{ 'Each', 'Hours' });
List<String> definitions = new List<String>{
    'NB|ノートPC|Business Laptop 14|168000|業務ノートPCです。',
    'DT|デスクトップPC|Office Desktop S|108000|省スペースデスクトップPCです。',
    'MN|モニター|24インチモニター|32000|標準液晶モニターです。',
    'KB|入力機器|ワイヤレスキーボード|7800|標準キーボードです。',
    'DK|ドッキング・接続機器|USB-Cドッキングステーション|24000|周辺機器接続ドックです。',
    'PR|プリンター・スキャナー|モノクロレーザープリンター|48000|帳票印刷用プリンターです。',
    'NW|ネットワーク機器|Wi-Fiアクセスポイント|28000|無線LANアクセスポイントです。',
    'VC|会議機器|会議用Webカメラ|22000|オンライン会議用カメラです。',
    'OF|オフィス家具|オフィスチェア|42000|標準オフィスチェアです。',
    'SW|ソフトウェア|CRM Standard License|12000|CRMライセンスです。'
};
List<String> codes = new List<String>();
Map<String, List<String>> partsByCode = new Map<String, List<String>>();
Map<String, Integer> familyCounts = new Map<String, Integer>();
for (String definition : definitions) {
    List<String> parts = definition.split('\|');
    Integer nextNumber = familyCounts.containsKey(parts[0]) ? familyCounts.get(parts[0]) + 1 : 1;
    familyCounts.put(parts[0], nextNumber);
    String code = parts[0] + '-' + pad3(nextNumber);
    codes.add(code);
    partsByCode.put(code, parts);
}
Map<String, Product2> existingByCode = new Map<String, Product2>();
for (Product2 product : [SELECT Id, ProductCode FROM Product2 WHERE ProductCode IN :codes]) {
    existingByCode.put(product.ProductCode, product);
}
List<Product2> inserts = new List<Product2>();
List<Product2> updates = new List<Product2>();
for (String code : codes) {
    List<String> parts = partsByCode.get(code);
    Product2 product = existingByCode.get(code);
    if (product == null) {
        product = new Product2(ProductCode = code);
        inserts.add(product);
    } else {
        updates.add(product);
    }
    product.Name = seedPrefix + ' ' + parts[2];
    product.Family = parts[1];
    product.QuantityUnitOfMeasure = quantityUnit;
    product.IsActive = true;
    product.Description = parts[4];
}
System.debug('Seed run key: ' + seedRunKey);
logResults('Product2 insert', Database.insert(inserts, false));
logResults('Product2 update', Database.update(updates, false));

