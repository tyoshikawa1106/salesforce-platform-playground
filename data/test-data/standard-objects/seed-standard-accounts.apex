Integer countPerObject = 20;
String seedPrefix = '[TEST]';
String seedRunKey = Datetime.now().formatGmt('yyyyMMddHHmmss');

List<String> companyNames = new List<String>{
    '株式会社青山デジタルワークス',
    '丸の内ロジスティクス株式会社',
    '日本橋フードサービス',
    '渋谷クラウドソリューションズ',
    '横浜メディカルパートナーズ',
    '名古屋スマート製造',
    '大阪リテールイノベーション',
    '京都ホテルマネジメント',
    '神戸ライフサイエンス',
    '福岡フィンテックラボ',
    '札幌エネルギーサービス',
    '仙台公共システムズ',
    '広島モビリティ企画',
    '金沢デザインスタジオ',
    '長野アグリテック',
    '新潟フードチェーン',
    '静岡ヘルスケアセンター',
    '岡山教育ソリューション',
    '熊本観光開発',
    '沖縄リゾートオペレーションズ'
};
List<String> cities = new List<String>{ '港区', '千代田区', '中央区', '渋谷区', '横浜市西区', '名古屋市中村区', '大阪市北区', '京都市下京区', '神戸市中央区', '福岡市博多区' };
List<String> streets = new List<String>{ '南青山', '丸の内', '日本橋', '神南', 'みなとみらい', '名駅', '梅田', '烏丸通', '三宮町', '博多駅前' };

List<Account> accounts = new List<Account>();
for (Integer i = 1; i <= countPerObject; i += 1) {
    String companyName = companyNames[i - 1];
    String city = cities[Math.mod(i - 1, cities.size())];
    String street = streets[Math.mod(i - 1, streets.size())];
    accounts.add(
        new Account(
            Name = seedPrefix + ' ' + companyName,
            AccountNumber = 'ACCT-' + seedRunKey.right(14) + '-' + String.valueOf(i).leftPad(2, '0'),
            Phone = '03-5555-' + String.valueOf(1000 + i),
            Fax = '03-5555-' + String.valueOf(2000 + i),
            Website = 'https://example.invalid/customers/' + String.valueOf(i).leftPad(2, '0'),
            Site = city + ' 本社',
            TickerSymbol = 'SD' + String.valueOf(i).leftPad(2, '0'),
            AnnualRevenue = 420000000 + (i * 18000000),
            NumberOfEmployees = 120 + (i * 8),
            Sic = '737' + Math.mod(i, 10),
            BillingStreet = street + ' ' + i + '-12-' + Math.mod(i + 2, 9),
            BillingCity = city,
            BillingPostalCode = '10' + Math.mod(i, 9) + '-' + String.valueOf(1000 + i),
            ShippingStreet = street + ' 配送センター ' + (i + 2) + '-5-' + Math.mod(i + 4, 9),
            ShippingCity = city,
            ShippingPostalCode = '11' + Math.mod(i, 9) + '-' + String.valueOf(2000 + i),
            Description = companyName + ' は、営業・サポート・契約管理の検証に使う合成取引先です。'
        )
    );
}

Database.SaveResult[] results = Database.insert(accounts, false);
Integer successCount = 0;
List<String> errors = new List<String>();
for (Database.SaveResult result : results) {
    if (result.isSuccess()) {
        successCount += 1;
    } else {
        for (Database.Error error : result.getErrors()) {
            errors.add(error.getStatusCode() + ' ' + error.getMessage());
        }
    }
}

System.debug('Seed run key: ' + seedRunKey);
System.debug('Created records: Account: ' + successCount);
if (!errors.isEmpty()) {
    System.debug('Skipped records: Account: ' + String.join(errors, ' / '));
}
