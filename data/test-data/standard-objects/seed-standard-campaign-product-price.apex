Integer campaignCount = 50;
String seedPrefix = '[TEST]';
String seedRunKey = Datetime.now().formatGmt('yyyyMMddHHmmss');
String seedLike = seedPrefix + '%';

String pad3(Integer value) {
    String result = String.valueOf(value);
    while (result.length() < 3) {
        result = '0' + result;
    }
    return result;
}

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
        System.debug(
            'Skipped records: ' + objectName + ': ' + String.join(errors, ' / ')
        );
    }
}

List<Contact> contacts = [
    SELECT Id
    FROM Contact
    WHERE LastName LIKE :seedLike
    ORDER BY CreatedDate DESC
    LIMIT :campaignCount
];
if (contacts.isEmpty()) {
    System.assert(
        false,
        'Run standard-objects-contacts-leads before campaigns and products.'
    );
}

String campaignType = pick(
    Campaign.Type.getDescribe(),
    new List<String>{ 'Webinar', 'Email', 'Conference' }
);
String campaignStatus = pick(
    Campaign.Status.getDescribe(),
    new List<String>{ 'In Progress', 'Planned', 'Completed' }
);
String memberStatus = pick(
    CampaignMember.Status.getDescribe(),
    new List<String>{ 'Sent', 'Responded' }
);
String quantityUnit = pick(
    Product2.QuantityUnitOfMeasure.getDescribe(),
    new List<String>{ 'Each', 'Hours' }
);

List<String> campaignNames = new List<String>{
    '春の営業改革ウェビナー',
    '製造業向け保守契約セミナー',
    '小売店舗DX相談会',
    '顧客サポート高度化キャンペーン',
    '経営ダッシュボード体験会',
    'フィールドサービス個別相談',
    '夏季ユーザー会',
    '既存顧客アップセル施策',
    '新規リード育成メール',
    'パートナー共催商談創出',
    '公共向け業務改善勉強会',
    'ヘルスケアCRM活用セミナー',
    '金融業界向けオンライン展示会',
    '受注管理標準化ワークショップ',
    'アフターサービス改善相談会',
    '営業マネージャー向け朝会',
    '地域顧客訪問キャンペーン',
    '価格改定フォローアップ',
    '契約更新促進キャンペーン',
    '年末重点商談レビュー'
};
List<String> productDefinitions = new List<String>{
    'NB|ノートPC|Business Laptop 14|168000|外出先でも扱いやすい14インチの標準業務ノートPCです。',
    'NB|ノートPC|Business Laptop 16|218000|大きめの画面で資料作成とオンライン会議を両立する業務ノートPCです。',
    'NB|ノートPC|Mobile Laptop 13|145000|軽量で持ち運びやすい営業担当者向けノートPCです。',
    'NB|ノートPC|Executive Laptop 14|248000|役員やマネージャー向けの高性能モバイルノートPCです。',
    'NB|ノートPC|Workstation Laptop 16|328000|設計、分析、動画編集にも使える高性能ノートPCです。',
    'DT|デスクトップPC|Office Desktop S|108000|一般事務向けの省スペースデスクトップPCです。',
    'DT|デスクトップPC|Office Desktop M|138000|複数アプリを同時利用する部門向けデスクトップPCです。',
    'DT|デスクトップPC|Mini Desktop|98000|受付や共有席に置きやすい小型デスクトップPCです。',
    'DT|デスクトップPC|Design Workstation|238000|デザイン、CAD、分析業務向けの高性能デスクトップです。',
    'DT|デスクトップPC|Reception Desktop|118000|来客受付や店舗カウンター向けのデスクトップPCです。',
    'MN|モニター|24インチモニター|32000|事務作業の標準利用に向いた24インチ液晶モニターです。',
    'MN|モニター|27インチモニター|48000|表計算や資料作成を快適にする27インチ液晶モニターです。',
    'MN|モニター|34インチウルトラワイドモニター|98000|複数画面を横並びで扱いやすいウルトラワイドモニターです。',
    'MN|モニター|4K 27インチモニター|72000|高精細な資料確認やデザイン確認に向いた4Kモニターです。',
    'MN|モニター|会議室サブモニター|42000|小会議室や受付表示に使いやすいサブモニターです。',
    'KB|入力機器|ワイヤレスキーボード|7800|配線を減らせる標準的なワイヤレスキーボードです。',
    'KB|入力機器|ワイヤレスマウス|4200|営業席やフリーアドレス席で使いやすいワイヤレスマウスです。',
    'KB|入力機器|静音キーボード|6200|会議室や集中席でも使いやすい静音タイプのキーボードです。',
    'KB|入力機器|トラックボールマウス|9800|省スペースなデスクで操作しやすいトラックボールマウスです。',
    'KB|入力機器|テンキー付きキーボード|8800|経理や受発注業務に向いたテンキー付きキーボードです。',
    'DK|ドッキング・接続機器|USB-Cドッキングステーション|24000|ノートPCとモニター、LAN、周辺機器をまとめて接続するドックです。',
    'DK|ドッキング・接続機器|HDMI変換アダプター|5800|会議室のディスプレイ接続に使えるHDMI変換アダプターです。',
    'DK|ドッキング・接続機器|USB-Cハブ|7800|外出先や共有席で周辺機器を増設するためのUSB-Cハブです。',
    'DK|ドッキング・接続機器|Thunderboltドック|34800|高解像度モニターや高速ストレージに対応する上位ドックです。',
    'DK|ドッキング・接続機器|LAN変換アダプター|5200|有線ネットワーク接続が必要な席向けのLAN変換アダプターです。',
    'PR|プリンター・スキャナー|モノクロレーザープリンター|48000|部門内の帳票印刷に向いたモノクロレーザープリンターです。',
    'PR|プリンター・スキャナー|カラーレーザー複合機|168000|印刷、コピー、スキャンに対応する部門向けカラー複合機です。',
    'PR|プリンター・スキャナー|A3対応複合機|178000|A3資料や販促物の出力に使えるカラー複合機です。',
    'PR|プリンター・スキャナー|ドキュメントスキャナー|64000|契約書や申込書の電子化に向いたドキュメントスキャナーです。',
    'PR|プリンター・スキャナー|ラベルプリンター|36000|備品管理や配送ラベルの印刷に使えるラベルプリンターです。',
    'NW|ネットワーク機器|Wi-Fiアクセスポイント|28000|執務エリアや会議室に無線LANを提供するアクセスポイントです。',
    'NW|ネットワーク機器|VPNルーター|82000|拠点間接続やリモートアクセスに使うVPN対応ルーターです。',
    'NW|ネットワーク機器|PoEスイッチ|56000|アクセスポイントやIP電話に給電できるPoE対応スイッチです。',
    'NW|ネットワーク機器|10GbEスイッチ|198000|高速ファイル共有やサーバー接続に使う10GbEスイッチです。',
    'NW|ネットワーク機器|LTEバックアップルーター|74000|主回線障害時の予備回線として使えるLTE対応ルーターです。',
    'VC|会議機器|会議用Webカメラ|22000|小会議室のオンライン会議に使いやすい広角Webカメラです。',
    'VC|会議機器|スピーカーフォン|28000|複数名の会議で声を拾いやすいUSBスピーカーフォンです。',
    'VC|会議機器|65インチ会議室ディスプレイ|420000|大会議室で資料共有やオンライン会議に使う大型ディスプレイです。',
    'VC|会議機器|ワイヤレスプレゼンター|15000|会議室での発表操作を支援するワイヤレスプレゼンターです。',
    'VC|会議機器|会議室マイク|36000|広めの会議室で発言を拾いやすくする拡張マイクです。',
    'OF|オフィス家具|オフィスチェア|42000|長時間のデスクワークに向いた標準オフィスチェアです。',
    'OF|オフィス家具|昇降デスク|88000|立ち作業と座り作業を切り替えられる電動昇降デスクです。',
    'OF|オフィス家具|キャビネット|36000|書類や備品を整理する鍵付きキャビネットです。',
    'OF|オフィス家具|ミーティングテーブル|96000|4名から6名程度の打ち合わせに使いやすい会議テーブルです。',
    'OF|オフィス家具|モニターアーム|18000|デスク上のスペースを広げる可動式モニターアームです。',
    'SW|ソフトウェア|CRM Standard License|12000|営業活動と顧客情報を管理する標準CRMライセンスです。',
    'SW|ソフトウェア|Office Suite License|18000|文書作成、表計算、プレゼン作成に使うオフィススイートです。',
    'SW|ソフトウェア|Endpoint Security License|9000|PC端末を保護するエンドポイントセキュリティライセンスです。',
    'SW|ソフトウェア|Backup Service License|15000|重要ファイルをクラウドへ保管するバックアップサービスです。',
    'SW|ソフトウェア|Project Management License|16000|チームのタスクと進捗を管理するプロジェクト管理ライセンスです。'
};

Map<String, Integer> familyCounts = new Map<String, Integer>();
Map<String, String> productNamesByCode = new Map<String, String>();
Map<String, String> productFamiliesByCode = new Map<String, String>();
Map<String, Decimal> productPricesByCode = new Map<String, Decimal>();
Map<String, String> productDescriptionsByCode = new Map<String, String>();
List<String> productCodes = new List<String>();
for (String definition : productDefinitions) {
    List<String> parts = definition.split('\\|');
    String familyPrefix = parts[0];
    Integer familySequence = familyCounts.containsKey(familyPrefix)
        ? familyCounts.get(familyPrefix) + 1
        : 1;
    familyCounts.put(familyPrefix, familySequence);
    String productCode = familyPrefix + '-' + pad3(familySequence);
    productCodes.add(productCode);
    productNamesByCode.put(productCode, seedPrefix + ' ' + parts[2]);
    productFamiliesByCode.put(productCode, parts[1]);
    productPricesByCode.put(productCode, Decimal.valueOf(parts[3]));
    productDescriptionsByCode.put(productCode, parts[4]);
}

Map<String, Product2> existingProductsByCode = new Map<String, Product2>();
for (Product2 product : [
    SELECT
        Id,
        Name,
        ProductCode,
        Family,
        QuantityUnitOfMeasure,
        IsActive,
        Description
    FROM Product2
    WHERE ProductCode IN :productCodes
]) {
    existingProductsByCode.put(product.ProductCode, product);
}

List<Campaign> campaigns = new List<Campaign>();
List<Product2> productsToInsert = new List<Product2>();
List<Product2> productsToUpdate = new List<Product2>();
for (String productCode : productCodes) {
    Product2 existingProduct = existingProductsByCode.get(productCode);
    if (existingProduct == null) {
        productsToInsert.add(
            new Product2(
                Name = productNamesByCode.get(productCode),
                ProductCode = productCode,
                Family = productFamiliesByCode.get(productCode),
                QuantityUnitOfMeasure = quantityUnit,
                IsActive = true,
                Description = productDescriptionsByCode.get(productCode)
            )
        );
        continue;
    }
    existingProduct.Name = productNamesByCode.get(productCode);
    existingProduct.Family = productFamiliesByCode.get(productCode);
    existingProduct.QuantityUnitOfMeasure = quantityUnit;
    existingProduct.IsActive = true;
    existingProduct.Description = productDescriptionsByCode.get(productCode);
    productsToUpdate.add(existingProduct);
}

Database.SaveResult[] productInsertResults = Database.insert(
    productsToInsert,
    false
);
Database.SaveResult[] productUpdateResults = Database.update(
    productsToUpdate,
    false
);

for (Integer i = 1; i <= campaignCount; i += 1) {
    String campaignName = campaignNames[Math.mod(i - 1, campaignNames.size())];
    campaigns.add(
        new Campaign(
            Name = seedPrefix + ' ' + campaignName,
            Type = campaignType,
            Status = campaignStatus,
            IsActive = true,
            StartDate = Date.today().addDays(i),
            EndDate = Date.today().addDays(30 + i),
            ExpectedRevenue = 2000000 + (i * 100000),
            BudgetedCost = 500000 + (i * 25000),
            ActualCost = 300000 + (i * 20000),
            ExpectedResponse = 10 + i,
            NumberSent = 100 + i,
            Description = campaignName +
                ' の反応率、商談化率、フォロー状況を確認するための合成キャンペーンです。'
        )
    );
}

System.debug('Seed run key: ' + seedRunKey);
Database.SaveResult[] campaignResults = Database.insert(campaigns, false);
logResults('Campaign', campaignResults);
logResults('Product2 insert', productInsertResults);
logResults('Product2 update', productUpdateResults);

List<Campaign> insertedCampaigns = [
    SELECT Id
    FROM Campaign
    WHERE Name LIKE :seedLike
    ORDER BY CreatedDate DESC
    LIMIT :campaignCount
];
List<Product2> insertedProducts = [
    SELECT Id, ProductCode
    FROM Product2
    WHERE ProductCode IN :productCodes
    ORDER BY ProductCode ASC
];
Set<Id> insertedProductIds = new Set<Id>();
for (Product2 product : insertedProducts) {
    insertedProductIds.add(product.Id);
}

Pricebook2 standardPricebook = [
    SELECT Id, IsActive
    FROM Pricebook2
    WHERE IsStandard = TRUE
    LIMIT 1
];
if (!standardPricebook.IsActive) {
    standardPricebook.IsActive = true;
    update standardPricebook;
}

List<CampaignMember> members = new List<CampaignMember>();
for (Integer i = 1; i <= campaignCount; i += 1) {
    Campaign campaign = insertedCampaigns[
        Math.mod(i - 1, insertedCampaigns.size())
    ];
    Contact contact = contacts[Math.mod(i - 1, contacts.size())];
    Product2 product = insertedProducts[
        Math.mod(i - 1, insertedProducts.size())
    ];

    members.add(
        new CampaignMember(
            CampaignId = campaign.Id,
            ContactId = contact.Id,
            Status = memberStatus
        )
    );
}

Map<Id, PricebookEntry> entriesByProductId = new Map<Id, PricebookEntry>();
for (PricebookEntry entry : [
    SELECT Id, Product2Id, UnitPrice, IsActive
    FROM PricebookEntry
    WHERE
        Pricebook2Id = :standardPricebook.Id
        AND Product2Id IN :insertedProductIds
]) {
    entriesByProductId.put(entry.Product2Id, entry);
}

List<PricebookEntry> standardEntriesToInsert = new List<PricebookEntry>();
List<PricebookEntry> standardEntriesToUpdate = new List<PricebookEntry>();
for (Product2 product : insertedProducts) {
    Decimal unitPrice = productPricesByCode.get(product.ProductCode);
    PricebookEntry existingEntry = entriesByProductId.get(product.Id);
    if (existingEntry == null) {
        standardEntriesToInsert.add(
            new PricebookEntry(
                Pricebook2Id = standardPricebook.Id,
                Product2Id = product.Id,
                UnitPrice = unitPrice,
                IsActive = true
            )
        );
        continue;
    }
    existingEntry.UnitPrice = unitPrice;
    existingEntry.IsActive = true;
    standardEntriesToUpdate.add(existingEntry);
}

logResults('CampaignMember', Database.insert(members, false));
logResults(
    'Standard PricebookEntry insert',
    Database.insert(standardEntriesToInsert, false)
);
logResults(
    'Standard PricebookEntry update',
    Database.update(standardEntriesToUpdate, false)
);
