Integer countPerObject = 2000;
String seedPrefix = '[TEST]';
String seedRunKey = Datetime.now().formatGmt('yyyyMMddHHmmss');
String seedLike = seedPrefix + '%';

List<String> companyNames = new List<String>{
    'さくら',
    'みらい',
    'ひかり',
    'つばさ',
    'あおぞら',
    'かけはし',
    'かなめ',
    'むすび',
    'しずく',
    'はるか',
    '奏',
    '凪',
    '結',
    '彩',
    '碧',
    '灯',
    '紡',
    '栞',
    '実り',
    'こもれび'
};
List<String> businessThemes = new List<String>{
    'データ',
    'ロジスティクス',
    'フード',
    'クラウド',
    'メディカル',
    'スマート製造',
    'リテール',
    'ホテル',
    'ライフサイエンス',
    'フィンテック',
    'エネルギー',
    '公共システム',
    'モビリティ',
    'デザイン',
    'アグリテック',
    'サプライチェーン',
    'ヘルスケア',
    '教育',
    '観光',
    'ワークプレイス'
};
List<String> businessTypes = new List<String>{
    '企画',
    '開発',
    '運用',
    '研究',
    '支援',
    '管理',
    '創研',
    '設計',
    '推進',
    'パートナーズ'
};
List<String> cities = new List<String>{
    '港区',
    '千代田区',
    '中央区',
    '渋谷区',
    '横浜市西区',
    '名古屋市中村区',
    '大阪市北区',
    '京都市下京区',
    '神戸市中央区',
    '福岡市博多区'
};
List<String> streets = new List<String>{
    '南青山',
    '丸の内',
    '日本橋',
    '神南',
    'みなとみらい',
    '名駅',
    '梅田',
    '烏丸通',
    '三宮町',
    '博多駅前'
};
List<String> prefectureCodes = new List<String>{
    '13',
    '13',
    '13',
    '13',
    '14',
    '23',
    '27',
    '26',
    '28',
    '40'
};

Database.DMLOptions duplicateRuleOptions = new Database.DMLOptions();
duplicateRuleOptions.DuplicateRuleHeader.allowSave = true;
duplicateRuleOptions.optAllOrNone = false;

Integer existingAccountCount = [
    SELECT COUNT()
    FROM Account
    WHERE Name LIKE :seedLike
];
List<Account> accounts = new List<Account>();
for (Integer i = 1; i <= countPerObject; i += 1) {
    Integer sequence = existingAccountCount + i;
    String paddedSequence = String.valueOf(sequence).leftPad(4, '0');
    String companyName =
        companyNames[Math.mod(sequence - 1, companyNames.size())] +
        businessThemes[
            Math.mod(
                (sequence - 1) / companyNames.size(),
                businessThemes.size()
            )
        ] +
        businessTypes[
            Math.mod(
                (sequence - 1) / (companyNames.size() * businessThemes.size()),
                businessTypes.size()
            )
        ] +
        '株式会社';
    String city = cities[Math.mod(sequence - 1, cities.size())];
    String street = streets[Math.mod(sequence - 1, streets.size())];
    String prefectureCode = prefectureCodes[
        Math.mod(sequence - 1, prefectureCodes.size())
    ];
    accounts.add(
        new Account(
            Name = seedPrefix + ' ' + companyName,
            AccountNumber = 'ACCT-' +
                seedRunKey.right(14) +
                '-' +
                paddedSequence,
            Phone = '03-5555-' +
                String.valueOf(1000 + Math.mod(sequence, 9000)).leftPad(4, '0'),
            Fax = '03-5555-' +
                String.valueOf(2000 + Math.mod(sequence, 8000)).leftPad(4, '0'),
            Website = 'https://example.invalid/customers/' + paddedSequence,
            Site = city + ' 第' + paddedSequence + '拠点',
            TickerSymbol = 'SD' +
                String.valueOf(Math.mod(sequence, 100)).leftPad(2, '0'),
            AnnualRevenue = 420000000 + (i * 18000000),
            NumberOfEmployees = 120 + (i * 8),
            Sic = '737' + Math.mod(i, 10),
            BillingStreet = street +
                ' ' +
                sequence +
                '-12-' +
                Math.mod(sequence + 2, 9),
            BillingCity = city,
            BillingStateCode = prefectureCode,
            BillingCountryCode = 'JP',
            BillingPostalCode = '10' +
                Math.mod(sequence, 9) +
                '-' +
                String.valueOf(1000 + Math.mod(sequence, 9000)),
            ShippingStreet = street +
                ' 配送センター ' +
                (sequence + 2) +
                '-5-' +
                Math.mod(sequence + 4, 9),
            ShippingCity = city,
            ShippingStateCode = prefectureCode,
            ShippingCountryCode = 'JP',
            ShippingPostalCode = '11' +
                Math.mod(sequence, 9) +
                '-' +
                String.valueOf(2000 + Math.mod(sequence, 8000)),
            Description = companyName +
                ' は、営業・サポート・契約管理の検証に使う合成取引先です。'
        )
    );
}

Database.SaveResult[] results = Database.insert(accounts, duplicateRuleOptions);
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
