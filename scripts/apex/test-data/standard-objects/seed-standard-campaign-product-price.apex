String seedPrefix = '[TEST]';
String seedRunKey = Datetime.now().formatGmt('yyyyMMddHHmmss');
String seedLike = seedPrefix + '%';
Integer monthlyCampaignCount = 36;

String pad2(Integer value) {
    String result = String.valueOf(value);
    while (result.length() < 2) {
        result = '0' + result;
    }
    return result;
}

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
    LIMIT :monthlyCampaignCount
];
if (contacts.isEmpty()) {
    System.assert(
        false,
        'Run standard-objects-contacts-leads before campaigns and products.'
    );
}

String campaignType = pick(
    Campaign.Type.getDescribe(),
    new List<String>{ 'Email', 'Webinar', 'Conference' }
);
String campaignStatusPlanned = pick(
    Campaign.Status.getDescribe(),
    new List<String>{ 'Planned', 'In Progress', 'Completed' }
);
String campaignStatusInProgress = pick(
    Campaign.Status.getDescribe(),
    new List<String>{ 'In Progress', 'Planned', 'Completed' }
);
String campaignStatusCompleted = pick(
    Campaign.Status.getDescribe(),
    new List<String>{ 'Completed', 'In Progress', 'Planned' }
);
String memberStatus = pick(
    CampaignMember.Status.getDescribe(),
    new List<String>{ 'Sent', 'Responded' }
);
String quantityUnit = pick(
    Product2.QuantityUnitOfMeasure.getDescribe(),
    new List<String>{ 'Each', 'Hours' }
);

List<String> monthlyCampaignThemes = new List<String>{
    '新年度オフィス環境準備キャンペーン',
    'リモートワーク機器見直しキャンペーン',
    '会議室アップデートキャンペーン',
    '新入社員PC配備キャンペーン',
    'プリンター・スキャナー更新キャンペーン',
    'ネットワーク強化キャンペーン',
    '夏季オフィス家具リフレッシュキャンペーン',
    'セキュリティソフト更新キャンペーン',
    '下期IT備品標準化キャンペーン',
    '会議機器まとめ買いキャンペーン',
    '年末オフィス備品棚卸キャンペーン',
    '年度末予算消化キャンペーン'
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

Integer currentYear = Date.today().year();
List<Integer> campaignYears = new List<Integer>{
    currentYear - 1,
    currentYear,
    currentYear + 1
};
Map<String, Campaign> existingCampaignsByName = new Map<String, Campaign>();
List<String> monthlyCampaignNames = new List<String>();
for (Integer year : campaignYears) {
    for (Integer month = 1; month <= 12; month += 1) {
        String campaignName =
            seedPrefix +
            ' ' +
            year +
            '年' +
            pad2(month) +
            '月 ' +
            monthlyCampaignThemes[month - 1];
        monthlyCampaignNames.add(campaignName);
    }
}
for (Campaign campaign : [
    SELECT
        Id,
        Name,
        Type,
        Status,
        IsActive,
        StartDate,
        EndDate,
        ExpectedRevenue,
        BudgetedCost,
        ActualCost,
        ExpectedResponse,
        NumberSent,
        Description
    FROM Campaign
    WHERE Name IN :monthlyCampaignNames
]) {
    existingCampaignsByName.put(campaign.Name, campaign);
}

List<Campaign> campaignsToInsert = new List<Campaign>();
List<Campaign> campaignsToUpdate = new List<Campaign>();
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

for (Integer index = 0; index < monthlyCampaignNames.size(); index += 1) {
    Integer year = campaignYears[index / 12];
    Integer month = 1 + Math.mod(index, 12);
    Date startDate = Date.newInstance(year, month, 1);
    Date endDate = startDate.addMonths(1).addDays(-1);
    String campaignName = monthlyCampaignNames[index];
    String campaignStatus = startDate.year() < currentYear
        ? campaignStatusCompleted
        : startDate.year() > currentYear
              ? campaignStatusPlanned
              : campaignStatusInProgress;
    Integer monthFactor = month + ((year - (currentYear - 1)) * 12);
    Campaign campaign = existingCampaignsByName.get(campaignName);
    if (campaign == null) {
        campaignsToInsert.add(
            new Campaign(
                Name = campaignName,
                Type = campaignType,
                Status = campaignStatus,
                IsActive = true,
                StartDate = startDate,
                EndDate = endDate,
                ExpectedRevenue = 1500000 + (monthFactor * 120000),
                BudgetedCost = 250000 + (month * 15000),
                ActualCost = startDate.year() <= currentYear
                    ? 180000 + (month * 12000)
                    : 0,
                ExpectedResponse = 8 + Math.mod(monthFactor, 12),
                NumberSent = 300 + (monthFactor * 20),
                Description = year +
                    '年' +
                    month +
                    '月の ' +
                    monthlyCampaignThemes[month - 1] +
                    '。月次のオフィス製品販売施策として、反応率、商談化率、フォロー状況を確認します。'
            )
        );
        continue;
    }
    campaign.Type = campaignType;
    campaign.Status = campaignStatus;
    campaign.IsActive = true;
    campaign.StartDate = startDate;
    campaign.EndDate = endDate;
    campaign.ExpectedRevenue = 1500000 + (monthFactor * 120000);
    campaign.BudgetedCost = 250000 + (month * 15000);
    campaign.ActualCost = startDate.year() <= currentYear
        ? 180000 + (month * 12000)
        : 0;
    campaign.ExpectedResponse = 8 + Math.mod(monthFactor, 12);
    campaign.NumberSent = 300 + (monthFactor * 20);
    campaign.Description =
        year +
        '年' +
        month +
        '月の ' +
        monthlyCampaignThemes[month - 1] +
        '。月次のオフィス製品販売施策として、反応率、商談化率、フォロー状況を確認します。';
    campaignsToUpdate.add(campaign);
}

Database.SaveResult[] productInsertResults = Database.insert(
    productsToInsert,
    false
);
Database.SaveResult[] productUpdateResults = Database.update(
    productsToUpdate,
    false
);
Database.SaveResult[] campaignInsertResults = Database.insert(
    campaignsToInsert,
    false
);
Database.SaveResult[] campaignUpdateResults = Database.update(
    campaignsToUpdate,
    false
);

System.debug('Seed run key: ' + seedRunKey);
logResults('Campaign insert', campaignInsertResults);
logResults('Campaign update', campaignUpdateResults);
logResults('Product2 insert', productInsertResults);
logResults('Product2 update', productUpdateResults);

List<Campaign> insertedCampaigns = [
    SELECT Id, Name
    FROM Campaign
    WHERE Name IN :monthlyCampaignNames
    ORDER BY StartDate ASC
];
Set<Id> insertedCampaignIds = new Set<Id>();
for (Campaign campaign : insertedCampaigns) {
    insertedCampaignIds.add(campaign.Id);
}
Set<Id> contactIds = new Set<Id>();
for (Contact contact : contacts) {
    contactIds.add(contact.Id);
}

Set<String> existingCampaignMemberKeys = new Set<String>();
for (CampaignMember member : [
    SELECT CampaignId, ContactId
    FROM CampaignMember
    WHERE CampaignId IN :insertedCampaignIds AND ContactId IN :contactIds
]) {
    existingCampaignMemberKeys.add(member.CampaignId + '-' + member.ContactId);
}

List<CampaignMember> members = new List<CampaignMember>();
for (Integer i = 0; i < insertedCampaigns.size(); i += 1) {
    Campaign campaign = insertedCampaigns[i];
    Contact contact = contacts[Math.mod(i, contacts.size())];
    String memberKey = campaign.Id + '-' + contact.Id;
    if (existingCampaignMemberKeys.contains(memberKey)) {
        continue;
    }
    members.add(
        new CampaignMember(
            CampaignId = campaign.Id,
            ContactId = contact.Id,
            Status = memberStatus
        )
    );
}

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

logResults('CampaignMember insert', Database.insert(members, false));
logResults(
    'Standard PricebookEntry insert',
    Database.insert(standardEntriesToInsert, false)
);
logResults(
    'Standard PricebookEntry update',
    Database.update(standardEntriesToUpdate, false)
);
