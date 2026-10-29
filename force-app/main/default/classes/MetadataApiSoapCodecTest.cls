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
            String xml = codec.createUpdateRequest(
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
    /** 不正なSOAP入力・応答を拒否 */
    @IsTest
    static void rejectsEmptyRequest() {
        System.runAs(testUser) {
            Test.startTest();
            try {
                codec.createUpdateRequest(new Map<String, Map<String, Object>>());
                Assert.fail('不正なSOAP契約を拒否');
            } catch (MetadataApiIntegrationClient.IntegrationException error) {
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
                codec.createUpdateRequest(
                    new Map<String, Map<String, Object>>{
                        'Account.Name' => new Map<String, Object>{ 'fullName' => 'Account.Phone' }
                    }
                );
                Assert.fail('不正なSOAP契約を拒否');
            } catch (MetadataApiIntegrationClient.IntegrationException error) {
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
                codec.createUpdateRequest(
                    new Map<String, Map<String, Object>>{ 'Account.Name/' => new Map<String, Object>() }
                );
                Assert.fail('不正なSOAP契約を拒否');
            } catch (MetadataApiIntegrationClient.IntegrationException error) {
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
            } catch (MetadataApiIntegrationClient.IntegrationException error) {
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
            } catch (MetadataApiIntegrationClient.IntegrationException error) {
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
            } catch (MetadataApiIntegrationClient.IntegrationException error) {
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
            } catch (MetadataApiIntegrationClient.IntegrationException error) {
                Assert.isTrue(error.getMessage().contains('形式'), '形式不正を通知');
            }
            Test.stopTest();
        }
    }
    /** SOAP Faultを明示拒否として扱う */
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
            } catch (MetadataApiIntegrationClient.RejectedUpdateException error) {
                Assert.isTrue(error.getMessage().contains('拒否'), '明示拒否として扱う');
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
}