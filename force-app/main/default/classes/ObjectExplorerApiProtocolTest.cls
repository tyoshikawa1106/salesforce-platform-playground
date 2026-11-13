/** 分類更新定義の保持と保存結果の区分 */
@IsTest
private with sharing class ObjectExplorerApiProtocolTest {
    private static ObjectExplorerApiProtocol.RecordReader reader = new ObjectExplorerApiProtocol.RecordReader();
    private static User testUser = new User(Id = UserInfo.getUserId());

    /** ネイティブ分類の未設定・所有者・識別子を通信せず保持 */
    @IsTest
    static void mapsNativeClassificationWithoutCallouts() {
        System.runAs(testUser) {
            FieldDefinition definition = (FieldDefinition)JSON.deserialize(
                '{"QualifiedApiName":"Name","DurableId":"Account.Name","ComplianceGroup":"PII;HIPAA","SecurityClassification":"Public","BusinessStatus":null,"BusinessOwnerId":"' + testUser.Id + '"}',
                FieldDefinition.class);
            Test.startTest();
            Map<String, Map<String, Object>> rows = reader.createFieldRows(new List<FieldDefinition>{definition});
            Assert.areEqual(new Set<String>{'Name'}, rows.keySet(), '同じ項目名へ索引化');
            Assert.areEqual('Account.Name', rows.get('Name').get('DurableId'), '識別子を保持');
            Assert.areEqual('PII;HIPAA', rows.get('Name').get('ComplianceGroup'), '取得値を保持');
            Assert.areEqual('Public', rows.get('Name').get('SecurityClassification'), '機密度を保持');
            Assert.areEqual(null, rows.get('Name').get('BusinessStatus'), '未設定を補完しない');
            Assert.areEqual(String.valueOf(testUser.Id), rows.get('Name').get('BusinessOwnerId'), '同じ所有者IDを保持');
            Assert.areEqual(0, Limits.getCallouts(), '変換にAPI通信を使わない');
            Test.stopTest();
        }
    }

    /** 未完了・属性欠落・重複した分類応答を拒否 */
    @IsTest
    static void rejectsIncompleteAndMismatchedRows() {
        System.runAs(testUser) {
            Test.startTest();
            Map<String, Object> row = classifyRow();
            Map<String, Object> response = new Map<String, Object>{
                'done' => false,
                'records' => new List<Object>{ row }
            };
            try {
                reader.readClassifyData(response, new Set<String>{ 'Name' });
                Assert.fail('未完了を拒否');
            } catch (SalesforceApiClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('不足'), '未完了を通知');
            }
            response.put('done', true);
            row.remove('BusinessOwnerId');
            try {
                reader.readClassifyData(response, new Set<String>{ 'Name' });
                Assert.fail('属性欠落を拒否');
            } catch (SalesforceApiClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('属性'), '欠落を通知');
            }
            response.put('records', new List<Object>{ classifyRow(), classifyRow() });
            try {
                reader.readClassifyData(response, new Set<String>{ 'Name', 'Phone' });
                Assert.fail('重複行を拒否');
            } catch (SalesforceApiClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('一致'), '重複を通知');
            }
            for (Map<String, Object> invalid : new List<Map<String, Object>>{
                null, new Map<String, Object>{ 'done' => true, 'records' => null },
                new Map<String, Object>{ 'done' => true, 'records' => new List<Object>{ null } }
            }) {
                try { reader.readClassifyData(invalid, new Set<String>{ 'Name' }); Assert.fail('不正値を拒否'); }
                catch (SalesforceApiClient.IntegrationException e) { Assert.isTrue(e.getMessage().contains('分類'), '欠落・不正値の理由を通知'); }
            }
            for (String missing : new List<String>{ null, '', '   ' }) {
                Map<String, Object> invalidRow = classifyRow();
                invalidRow.put('DurableId', missing);
                try { reader.readClassifyData(new Map<String, Object>{ 'done' => true, 'records' => new List<Object>{ invalidRow } }, new Set<String>{ 'Name' }); Assert.fail('不正値を拒否'); }
                catch (SalesforceApiClient.IntegrationException e) { Assert.isTrue(e.getMessage().contains('属性'), '欠落・不正値の理由を通知'); }
            }

            Map<String, Object> record = classifyRow();
            Map<String, Map<String, Object>> rows = reader.readClassifyData(new Map<String, Object>{ 'done' => true, 'records' => new List<Object>{ record } }, new Set<String>{ 'Name' });

            Assert.areEqual(record, rows.get('Name'), '完全な取得結果を保持');
            Test.stopTest();
        }
    }
    /**
     * 分類応答の必須属性を用意
     * @return 未設定の分類応答
     */
    private static Map<String, Object> classifyRow() {
        return new Map<String, Object>{
            'DurableId' => 'Account.Name',
            'QualifiedApiName' => 'Name',
            'ComplianceGroup' => null,
            'SecurityClassification' => null,
            'BusinessStatus' => null,
            'BusinessOwnerId' => null
        };
    }

    /** 検索条件の真偽値・複合定義と説明を分類更新から保護 */
    @IsTest
    static void preservesLookupDefinition() {
        System.runAs(testUser) {
            String definition = '<fullName>Account.Probe__c</fullName><businessStatus>Hidden</businessStatus><description>説明 &amp; 値</description><inlineHelpText>{!input}</inlineHelpText><label>参照</label><lookupFilter><active>true</active><filterItems><field>User.IsActive</field><operation>equals</operation><value>True</value></filterItems><isOptional>false</isOptional></lookupFilter><referenceTo>User</referenceTo><relationshipName>Probes</relationshipName><type>Lookup</type>';
            Test.startTest();
            Dom.XmlNode source = readDefinition(customResponse(definition), 'Account.Probe__c');
            String xml = createCustomRequest('Account.Probe__c', source, new Map<String, Object>{'businessStatus' => 'Active', 'complianceGroup' => 'PII;GDPR'});
            Dom.XmlNode field = customRequestField(xml);
            Test.stopTest();
            String ns = 'http://soap.sforce.com/2006/04/metadata';
            Assert.areEqual('Active', field.getChildElement('businessStatus', ns).getText(), '分類だけを変更');
            Assert.areEqual('Hidden', source.getChildElement('businessStatus', ns).getText(), '取得定義は変更しない');
            Assert.areEqual('説明 & 値', field.getChildElement('description', ns).getText(), '説明を保持');
            Assert.areEqual('{!input}', field.getChildElement('inlineHelpText', ns).getText(), '差し込み式も文字列として保持');
            Assert.isFalse(xml.contains('{!input}'), '認証差し込みを実行させない');
            Dom.XmlNode filter = field.getChildElement('lookupFilter', ns);
            Assert.areEqual('true', filter.getChildElement('active', ns).getText(), '有効状態を保持');
            Assert.areEqual('false', filter.getChildElement('isOptional', ns).getText(), '必須条件を保持');
            Assert.areEqual('User.IsActive', filter.getChildElement('filterItems', ns).getChildElement('field', ns).getText(), '条件の項目を保持');
            Assert.areEqual('User', field.getChildElement('referenceTo', ns).getText(), '参照先を保持');
            Assert.areEqual('PII;GDPR', field.getChildElement('complianceGroup', ns).getText(), '複数分類を反映');
        }
    }

    /** 繰返し要素・数式・名前空間属性を保持して分類解除 */
    @IsTest
    static void preservesComplexDefinitionWhenClearing() {
        System.runAs(testUser) {
            String definition = '<fullName>Account.Probe__c</fullName><formula>Amount__c * 2</formula><label>値</label><securityClassification>Public</securityClassification><type>Picklist</type><valueSet><restricted>true</restricted><valueSetDefinition><sorted>false</sorted><value><fullName>A</fullName><default>true</default></value><value><fullName>B</fullName><default>false</default></value></valueSetDefinition></valueSet><writeRequiresMasterRead xsi:nil="true"/>';
            Test.startTest();
            Dom.XmlNode source = readDefinition(customResponse(definition), 'Account.Probe__c');
            Dom.XmlNode field = customRequestField(createCustomRequest('Account.Probe__c', source, new Map<String, Object>()));
            Test.stopTest();
            String ns = 'http://soap.sforce.com/2006/04/metadata';
            Assert.areEqual('Amount__c * 2', field.getChildElement('formula', ns).getText(), '数式を保持');
            Assert.isTrue(String.isBlank(field.getChildElement('securityClassification', ns).getText()), '分類を解除');
            List<Dom.XmlNode> values = field.getChildElement('valueSet', ns).getChildElement('valueSetDefinition', ns).getChildElements();
            Assert.areEqual(3, values.size(), '繰返しの選択値を欠落させない');
            Assert.areEqual('B', values[2].getChildElement('fullName', ns).getText(), '選択値の順序を保持');
            Assert.areEqual('true', field.getChildElement('writeRequiresMasterRead', ns).getAttributeValue('nil', 'http://www.w3.org/2001/XMLSchema-instance'), '名前空間属性を保持');
        }
    }

    /** 定義取得のSOAP Faultを更新結果不明と案内しない */
    @IsTest
    static void distinguishesReadSoapFault() {
        System.runAs(testUser) {
            HttpResponse raw = customResponse('');
            raw.setStatusCode(500);
            raw.setBody('<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><env:Fault><faultstring>PRIVATE_VALUE</faultstring></env:Fault></env:Body></env:Envelope>');
            Test.startTest();
            try {
                readDefinition(raw, 'Account.Probe__c');
                Assert.fail('読取Faultを拒否');
            } catch (SalesforceApiClient.IntegrationException error) {
                Assert.areEqual('Metadata APIの項目定義を取得できませんでした。最新状態を再取得してください。', error.getMessage(), '読取失敗だけを案内し更新結果不明やAPI本文を公開しない');
            }
            HttpResponse rejected = customResponse('<fullName>Account.Probe__c</fullName><type>Text</type>');
            rejected.setStatusCode(403);
            try { readDefinition(rejected, 'Account.Probe__c'); Assert.fail('不正値を拒否'); }
            catch (SalesforceApiClient.IntegrationException e) { Assert.isTrue(e.getMessage().contains('取得できません'), '欠落・不正値の理由を通知'); }
            Test.stopTest();
        }
    }

    /** 不正な読取結果を更新へ流さない */
    @IsTest
    static void rejectsInvalidCustomReadResponses() {
        System.runAs(testUser) {
            Test.startTest();
            for (String value : new List<String>{'', '<fullName>Account.Other__c</fullName><type>Text</type>', '<fullName>Account.Probe__c</fullName>'}) {
                try {
                    readDefinition(customResponse(value), 'Account.Probe__c');
                    Assert.fail('欠落・別項目・型不明は拒否');
                } catch (SalesforceApiClient.IntegrationException error) { Assert.isTrue(String.isNotBlank(error.getMessage()), '固定の失敗理由を通知'); }
            }
            try {
                createCustomRequest('Account.Probe__c', null, new Map<String, Object>());
                Assert.fail('読取前の保存は拒否');
            } catch (SalesforceApiClient.IntegrationException error) { Assert.isTrue(error.getMessage().contains('一致'), '同じ項目の定義を必須にする'); }

            ObjectExplorerApiProtocol.CustomFieldCodec codec = new ObjectExplorerApiProtocol.CustomFieldCodec();
            for (Map<String, Map<String, Object>> fields : new List<Map<String, Map<String, Object>>>{ null, new Map<String, Map<String, Object>>{ 'Account.Name' => null } }) {
                try {
                    codec.createUpdateRequest(fields, new Map<String, Dom.XmlNode>());
                    Assert.fail('必須値の欠落を拒否');
                } catch (SalesforceApiClient.IntegrationException e) {
                    Assert.isTrue(e.getMessage().contains('定義'), '欠落を明示したエラーで拒否');
                }
            }
            try {
                codec.appendCustomDefinition(null, null, null);
                Assert.fail('必須値の欠落を拒否');
            } catch (SalesforceApiClient.IntegrationException e) {
                Assert.isTrue(e.getMessage().contains('定義'), '欠落を明示したエラーで拒否');
            }

            Test.stopTest();
        }
    }

    /**
     * 項目定義読取の模擬SOAP応答
     * @param definition 項目定義XML
     * @return 一項目だけの応答
     */
    private static HttpResponse customResponse(String definition) {
        HttpResponse response = new HttpResponse(); response.setStatusCode(200);
        response.setBody('<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><env:Body><readMetadataResponse xmlns="http://soap.sforce.com/2006/04/metadata"><result><records>' + definition + '</records></result></readMetadataResponse></env:Body></env:Envelope>');
        return response;
    }

    /**
     * 生成要求をXMLとして再解析して更新定義を取得
     * @param xml 更新要求
     * @return 要求内の一項目
     */
    private static Dom.XmlNode customRequestField(String xml) {
        Dom.Document doc = new Dom.Document(); doc.load(xml);
        return doc.getRootElement().getChildElement('Body', 'http://schemas.xmlsoap.org/soap/envelope/').getChildElement('updateMetadata', 'http://soap.sforce.com/2006/04/metadata').getChildElements()[0];
    }
    /**
     * 単一の模擬応答を一括読取の契約で取得
     * @param response 検証する応答
     * @param name 同じ項目完全名
     * @return 照合済み定義
     */
    private static Dom.XmlNode readDefinition(HttpResponse response, String name) {
        return new ObjectExplorerApiProtocol.CustomFieldCodec().readCustomDefinitions(response, new Set<String>{name}).get(name);
    }

    /**
     * 単一のカスタム定義を一括更新へ渡す
     * @param name 項目完全名
     * @param definition 取得済み定義
     * @param classification 分類属性
     * @return 一括更新XML
     */
    private static String createCustomRequest(String name, Dom.XmlNode definition, Map<String, Object> classification) {
        return new ObjectExplorerApiProtocol.CustomFieldCodec().createUpdateRequest(new Map<String, Map<String, Object>>{name => classification}, new Map<String, Dom.XmlNode>{name => definition});
    }

    /** 最大10項目を一括取得し逆順の応答も完全名で照合 */
    @IsTest
    static void readsTenDefinitionsByFullName() {
        System.runAs(testUser) {
            Set<String> names = new Set<String>();
            List<String> reversed = new List<String>();
            for (Integer i = 0; i < 10; i++) { String name = 'Account.Field' + i + '__c'; names.add(name); reversed.add('Account.Field' + (9 - i) + '__c'); }
            ObjectExplorerApiProtocol.CustomFieldCodec custom = new ObjectExplorerApiProtocol.CustomFieldCodec();
            Test.startTest();
            String request = custom.createReadRequest(names);
            Map<String, Dom.XmlNode> definitions = custom.readCustomDefinitions(batchResponse(reversed), names);

            Set<String> tooMany = new Set<String>();
            for (Integer i = 0; i < 11; i++) { tooMany.add('Account.Field' + i + '__c'); }
            for (Set<String> invalidNames : new List<Set<String>>{ null, new Set<String>(), tooMany }) {
                try { new ObjectExplorerApiProtocol.CustomFieldCodec().createReadRequest(invalidNames); Assert.fail('不正値を拒否'); }
                catch (SalesforceApiClient.IntegrationException e) { Assert.isTrue(e.getMessage().contains('1～10'), '欠落・不正値の理由を通知'); }
            }
            Test.stopTest();
            Assert.areEqual(10, request.countMatches('<met:fullNames>'), '10項目を一回の読取要求に含む');
            Assert.areEqual(names, definitions.keySet(), '応答順に依存しない');
            for (String name : names) { Assert.areEqual(name, definitions.get(name).getChildElement('label', 'http://soap.sforce.com/2006/04/metadata').getText(), '他項目の定義を取り違えない'); }
        }
    }

    /** 定義の欠落と同じ定義の重複を拒否 */
    @IsTest
    static void rejectsDuplicateDefinitions() {
        System.runAs(testUser) {
            Test.startTest();
            for (List<String> names : new List<List<String>>{ new List<String>{ 'Account.A__c' }, new List<String>{ 'Account.A__c', 'Account.A__c' } }) {
                try { new ObjectExplorerApiProtocol.CustomFieldCodec().readCustomDefinitions(batchResponse(names), new Set<String>{ 'Account.A__c', 'Account.B__c' }); Assert.fail('不完全な定義を拒否'); }
                catch (SalesforceApiClient.IntegrationException e) { Assert.isTrue(new Set<String>{ 'Metadata APIの項目定義に不足があります。', '取得したカスタム項目定義が一致しません。' }.contains(e.getMessage()), '欠落と重複を照合エラーとして通知'); }
            }
            Test.stopTest();
        }
    }

    /**
     * 任意順序の定義応答を作成
     * @param names 応答へ含める完全名の順序
     * @return 一括読取の模擬応答
     */
    private static HttpResponse batchResponse(List<String> names) {
        HttpResponse response = new HttpResponse(); response.setStatusCode(200);
        String records = '';
        for (String name : names) { records += '<records><fullName>' + name + '</fullName><label>' + name + '</label><type>Text</type></records>'; }
        response.setBody('<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><readMetadataResponse xmlns="http://soap.sforce.com/2006/04/metadata"><result>' + records + '</result></readMetadataResponse></env:Body></env:Envelope>');
        return response;
    }

    /** 標準項目の分類を安全なSOAP要求へ変換 */
    @IsTest
    static void encodesStandardFieldClassification() {

        System.runAs(testUser) {
            Map<String, Map<String, Object>> fields = new Map<String, Map<String, Object>>{ 'Account.Name' => new Map<String, Object>{ 'fullName' => 'Account.Name', 'businessStatus' => 'Active' } };
            Test.startTest();
            String xml = new ObjectExplorerApiProtocol.CustomFieldCodec().createUpdateRequest(fields, new Map<String, Dom.XmlNode>());
            String safeMessage = ObjectExplorerApiProtocol.safeSaveMessage(new QueryException('PRIVATE'));
            Test.stopTest();
            Assert.isTrue(xml.contains('Account.Name'), '同じ完全名を保存対象にする');
            Assert.isTrue(xml.contains('Active'), '要求された分類を送信');
            Assert.areEqual('項目の保存に失敗しました。編集内容と権限を確認してください。', safeMessage, '想定外の失敗は固定案内へ変換');
        }
    }

    /** 送信後の未確認と明示拒否を区別 */
    @IsTest
    static void distinguishesSaveStates() {
        System.runAs(testUser) {
            Test.startTest();
            ObjectExplorerApiProtocol.SaveState state = new ObjectExplorerApiProtocol.SaveState();
            state.sent = true;
            Assert.isTrue(ObjectExplorerApiProtocol.saveStage(state).startsWith('[OE-SAVE-UNCONFIRMED]'), '送信後の未確認');
            state.rejected = true;
            Assert.isTrue(ObjectExplorerApiProtocol.saveStage(state).startsWith('[OE-SAVE-REJECTED]'), '明示拒否を優先');
            Test.stopTest();
        }
    }
}