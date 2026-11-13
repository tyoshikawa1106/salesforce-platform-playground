/** SOAPの要求生成と結果検証 */
@IsTest
private with sharing class MetadataApiSoapCodecTest {
    private static MetadataApiSoapCodec codec = new MetadataApiSoapCodec();

    private static User testUser = new User(Id = UserInfo.getUserId());

    /** 分類属性と認証欄のXMLを生成 */
    @IsTest
    static void encodesOnlyAllowedMetadata() {
        System.runAs(testUser) {
            Test.startTest();
            String xml = createStandardRequest(
                new Map<String, Map<String, Object>>{
                    'Account.Name' => new Map<String, Object>{
                        'fullName' => 'Account.Name',
                        'businessStatus' => '{!value}&<',
                        'label' => '変更禁止'
                    }
                }
            );
            Assert.isTrue(xml.contains('<met:fullName>Account.Name</met:fullName>'), '完全名を保持');
            Assert.isTrue(xml.contains('&#123;!value}&amp;&lt;'), '入力を式とXMLから保護');
            Assert.isTrue(
                xml.contains('<met:sessionId>{!$Credential.OAuthToken}</met:sessionId>'),
                '認証欄だけ差し込みを許可'
            );
            Assert.isFalse(xml.contains('変更禁止'), '分類以外を送信しない');
            Test.stopTest();
        }
    }
    /** 応答順ではなく完全名で照合 */
    @IsTest
    static void matchesResultsByFullName() {
        System.runAs(testUser) {
            Test.startTest();
            Map<String, String> results = codec.readUpdateResults(
                response(
                    '<result><fullName>Account.Name</fullName><success>false</success><errors><statusCode>INVALID_FIELD</statusCode></errors></result><result><fullName>Account.Phone</fullName><success>true</success></result>'
                ),
                new Set<String>{ 'Account.Phone', 'Account.Name' }
            );
            Assert.areEqual('', results.get('Account.Phone'), '成功を同じ完全名へ照合');
            Assert.isTrue(results.get('Account.Name').contains('INVALID_FIELD'), '拒否は同じ項目だけ');
            Test.stopTest();
        }
    }
    /** 対象項目の拒否を入力分類値の不正と誤案内しない */
    @IsTest
    static void distinguishesRejectedTargetField() {
        System.runAs(testUser) {
            Test.startTest();
            Map<String, String> results = codec.readUpdateResults(
                response('<result><fullName>Account.Id</fullName><success>false</success><errors><fields>FieldOrColumn</fields><message>PRIVATE_VALUE</message><statusCode>INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST</statusCode></errors></result>'),
                new Set<String>{'Account.Id'}
            );
            Test.stopTest();
            Assert.isTrue(results.get('Account.Id').contains('分類更新対象として拒否'), '構造化属性で対象項目の拒否を識別');
            Assert.isTrue(results.get('Account.Id').contains('FieldOrColumn'), '拒否された属性を固定名で案内');
            Assert.isFalse(results.get('Account.Id').contains('PRIVATE_VALUE'), '応答の自由文は公開しない');
        }
    }

    /** 分類値の拒否を対象項目非対応と決めつけない */
    @IsTest
    static void keepsClassificationValueRejectionDistinct() {
        System.runAs(testUser) {
            Test.startTest();
            Map<String, String> results = codec.readUpdateResults(
                response('<result><fullName>Account.Name</fullName><success>false</success><errors><fields>SecurityClassification</fields><statusCode>INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST</statusCode></errors></result>'),
                new Set<String>{'Account.Name'}
            );
            Test.stopTest();
            Assert.isFalse(results.get('Account.Name').contains('分類更新対象として拒否'), '分類値の拒否を対象項目の拒否と混同しない');
            Assert.isTrue(results.get('Account.Name').contains('INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST'), '公式コードを保持');
        }
    }

    /** 不正なSOAP入力・応答を拒否 */
    @IsTest
    static void rejectsEmptyRequest() {
        System.runAs(testUser) {
            Test.startTest();
            try {
                createStandardRequest(new Map<String, Map<String, Object>>());
                Assert.fail('不正なSOAP契約を拒否');
            } catch (SalesforceApiClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('1～10'), '失敗理由を通知');
            }
            Test.stopTest();
        }
    }
    /** 不正なSOAP入力・応答を拒否 */
    @IsTest
    static void rejectsMismatchedMetadata() {
        System.runAs(testUser) {
            Test.startTest();
            try {
                createStandardRequest(
                    new Map<String, Map<String, Object>>{
                        'Account.Name' => new Map<String, Object>{ 'fullName' => 'Account.Phone' }
                    }
                );
                Assert.fail('不正なSOAP契約を拒否');
            } catch (SalesforceApiClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('一致'), '失敗理由を通知');
            }
            Test.stopTest();
        }
    }
    /** 不正なSOAP入力・応答を拒否 */
    @IsTest
    static void rejectsUnsafeFullName() {
        System.runAs(testUser) {
            Test.startTest();
            try {
                createStandardRequest(
                    new Map<String, Map<String, Object>>{ 'Account.Name/' => new Map<String, Object>() }
                );
                Assert.fail('不正なSOAP契約を拒否');
            } catch (SalesforceApiClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('不正'), '失敗理由を通知');
            }
            Test.stopTest();
        }
    }
    /** 不正なSOAP入力・応答を拒否 */
    @IsTest
    static void rejectsMissingResult() {
        System.runAs(testUser) {
            Test.startTest();
            try {
                codec.readUpdateResults(response(''), new Set<String>{ 'Account.Name' });
                Assert.fail('不正なSOAP契約を拒否');
            } catch (SalesforceApiClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('不足'), '失敗理由を通知');
            }
            Test.stopTest();
        }
    }
    /** 不正なSOAP入力・応答を拒否 */
    @IsTest
    static void rejectsUnexpectedResult() {
        System.runAs(testUser) {
            Test.startTest();
            try {
                codec.readUpdateResults(
                    response('<result><fullName>Account.Phone</fullName><success>true</success></result>'),
                    new Set<String>{ 'Account.Name' }
                );
                Assert.fail('不正なSOAP契約を拒否');
            } catch (SalesforceApiClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('一致'), '失敗理由を通知');
            }
            Test.stopTest();
        }
    }
    /** 不正なSOAP入力・応答を拒否 */
    @IsTest
    static void rejectsUnknownStatus() {
        System.runAs(testUser) {
            Test.startTest();
            try {
                codec.readUpdateResults(
                    response('<result><fullName>Account.Name</fullName></result>'),
                    new Set<String>{ 'Account.Name' }
                );
                Assert.fail('不正なSOAP契約を拒否');
            } catch (SalesforceApiClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('成否'), '失敗理由を通知');
            }
            Test.stopTest();
        }
    }
    /** 壊れたXMLを成功扱いしない */
    @IsTest
    static void rejectsMalformedXml() {
        System.runAs(testUser) {
            Test.startTest();
            HttpResponse raw = new HttpResponse();
            raw.setStatusCode(200);
            raw.setBody('invalid');
            try {
                codec.readUpdateResults(raw, new Set<String>{ 'Account.Name' });
                Assert.fail('壊れたXMLを拒否');
            } catch (SalesforceApiClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('形式'), '形式不正を通知');
            }
            Test.stopTest();
        }
    }
    /** 不明なSOAP Faultを未保存と断定しない */
    @IsTest
    static void rejectsSoapFault() {
        System.runAs(testUser) {
            Test.startTest();
            HttpResponse raw = new HttpResponse();
            raw.setStatusCode(500);
            raw.setBody(
                '<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><env:Fault/></env:Body></env:Envelope>'
            );
            try {
                codec.readUpdateResults(raw, new Set<String>{ 'Account.Name' });
                Assert.fail('Faultを拒否');
            } catch (SalesforceApiClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('[OE-SAVE-UNCONFIRMED]'), '結果不明を明示拒否と区別');
            }
            Test.stopTest();
        }
    }
    private static HttpResponse response(String results) {
        HttpResponse value = new HttpResponse();
        value.setStatusCode(200);
        value.setBody(
            '<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><updateMetadataResponse xmlns="http://soap.sforce.com/2006/04/metadata">' +
                results +
                '</updateMetadataResponse></env:Body></env:Envelope>'
        );
        return value;
    }

    /**
     * 標準項目だけの要求を生成
     * @param fields 検証する分類定義
     * @return 一括更新XML
     */
    private static String createStandardRequest(Map<String, Map<String, Object>> fields) {
        return new ObjectExplorerApiProtocol.CustomFieldCodec().createUpdateRequest(fields, new Map<String, Dom.XmlNode>());
    }

    /** null応答や空白本文をXML解析前に拒否 */
    @IsTest
    static void rejectsMissingSoapResponse() {
        System.runAs(testUser) {
            Test.startTest();
            HttpResponse response = new HttpResponse();
            response.setStatusCode(200);
            for (HttpResponse value : new List<HttpResponse>{ null, response }) {
                try {
                    codec.readOperation(value, 'updateMetadataResponse', '更新結果不明');
                    Assert.fail('必須値の欠落を拒否');
                } catch (SalesforceApiClient.IntegrationException e) {
                    Assert.isTrue(e.getMessage().contains('応答形式'), '欠落を明示したエラーで拒否');
                }
            }
            response.setBody('   ');
                try {
                    codec.readOperation(response, 'updateMetadataResponse', '更新結果不明');
                    Assert.fail('必須値の欠落を拒否');
                } catch (SalesforceApiClient.IntegrationException e) {
                    Assert.isTrue(e.getMessage().contains('応答形式'), '欠落を明示したエラーで拒否');
                }
            Test.stopTest();
        }
    }

    /** 空白の完全名と必須定義のnullをXML生成前に拒否 */
    @IsTest
    static void rejectsMissingFieldMetadata() {
        System.runAs(testUser) {
            Test.startTest();
            for (String name : new List<String>{ null, '', '   ' }) {
                try {
                    codec.requireFullName(name);
                    Assert.fail('必須値の欠落を拒否');
                } catch (SalesforceApiClient.IntegrationException e) {
                    Assert.isTrue(e.getMessage().contains('識別子'), '欠落を明示したエラーで拒否');
                }
            }
                try {
                    codec.appendMetadataField(null, 'Account.Name', null);
                    Assert.fail('必須値の欠落を拒否');
                } catch (SalesforceApiClient.IntegrationException e) {
                    Assert.isTrue(e.getMessage().contains('識別名'), '欠落を明示したエラーで拒否');
                }
            Test.stopTest();
        }
    }

    /** 分類以外のXML定義を属性・ネスト・空要素ごと保持 */
    @IsTest
    static void copiesCompleteDefinitionElement() {
        System.runAs(testUser) {
            Dom.Document source = new Dom.Document();
            source.load('<root xmlns:x="urn:test" plain="value" x:kind="Text"><child>text</child><empty/></root>');
            Dom.Document target = new Dom.Document();
            Dom.XmlNode parent = target.createRootElement('parent', null, null);
            Test.startTest();
            codec.copyDefinitionElement(source.getRootElement(), parent);
            Test.stopTest();
            // 送信するXMLを再読込し、接頭辞付き属性の名前空間を確認
            Dom.Document serialized = new Dom.Document();
            serialized.load(target.toXmlString());
            Dom.XmlNode copied = serialized.getRootElement().getChildElement('root', null);
            Assert.areEqual('value', copied.getAttribute('plain', null), '通常属性を保持');
            Assert.areEqual('Text', copied.getAttribute('kind', 'urn:test'), '名前空間付き属性を保持');
            Assert.areEqual('text', copied.getChildElement('child', null).getText(), '子要素の本文を保持');
            Assert.isNotNull(copied.getChildElement('empty', null), '空要素を保持');
        }
    }
}
