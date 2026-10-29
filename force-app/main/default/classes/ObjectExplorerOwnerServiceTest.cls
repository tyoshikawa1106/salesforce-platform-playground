/** 所有者IDの厳密照合とCSV候補 */
@IsTest
private with sharing class ObjectExplorerOwnerServiceTest {

    private static ObjectExplorerOwnerService service = new ObjectExplorerOwnerService();
    private static ObjectExplorerOwnerService.CsvOwners csv = new ObjectExplorerOwnerService.CsvOwners();

    private static User testUser = new User(Id = UserInfo.getUserId());

    /** 候補・API参照値を同じ所有者IDへ対応 */
    @IsTest
    static void keepsIdsNamesAndIdentifiersTogether() {

        System.runAs(testUser) {
            Test.startTest();
            User owner = new User(
                Id = testUser.Id,
                LastName = 'Owner',
                Username = 'owner@example.invalid',
                IsActive = true
            );
            Group groupRecord = new Group(
                Id = Id.valueOf(
                    Group.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).getKeyPrefix() + '000000000001'
                ),
                Name = 'Owner Group',
                DeveloperName = 'OwnerGroup'
            );
            List<User> users = new List<User>{ owner };
            List<Group> groups = new List<Group>{ groupRecord };
            Map<Id, SObject> index = service.createOwnerIndex(users, groups);
            Assert.areEqual(2, index.size(), 'ユーザーとグループをIDで保持');
            Assert.areEqual(
                testUser.Id,
                service.selectCachedOwner(String.valueOf(testUser.Id), index)[0].Id,
                '同じIDを選択'
            );
            Assert.isTrue(service.selectCachedOwner('', index).isEmpty(), '未設定を補完しない');
            Assert.areEqual(2, service.createOwnerChoices(users, groups).size(), '両種の候補を生成');
            Assert.areEqual(
                'Owner Group',
                service.createOwnerLabels(users, groups).get(groupRecord.Id),
                'グループ名を同じIDに対応'
            );
            Map<String, Object> values = new Map<String, Object>{
                'complianceGroup' => 'PII',
                'securityClassification' => '',
                'businessStatus' => ''
            };
            Assert.areEqual(
                'owner@example.invalid',
                service.createMetadataDraft(values, new List<SObject>{ owner }).get('businessOwnerUser'),
                'ユーザー識別子を採用'
            );
            Assert.areEqual(
                'OwnerGroup',
                service.createMetadataDraft(values, new List<SObject>{ groupRecord }).get('businessOwnerGroup'),
                'グループ識別子を採用'
            );
            Assert.areEqual(
                '',
                service.createMetadataDraft(values, new List<SObject>()).get('businessOwnerUser'),
                '明示解除を保持'
            );
            Assert.areEqual('', service.createOwnerChoice(new List<SObject>()).get('value'), '未設定は空ID');
            Assert.areEqual(2, csv.createChoices(users, groups).size(), 'CSVも同じIDの候補');
            Assert.areEqual(
                new Set<Id>{ testUser.Id },
                csv.parseIds(JSON.serialize(new List<Id>{ testUser.Id, testUser.Id })),
                'IDを重複排除'
            );
            Test.stopTest();
        }
    }

    /** 所有者集約と無効な現在値の保持 */
    @IsTest
    static void collectsOriginalAndDraftOwners() {

        System.runAs(testUser) {
            Test.startTest();
            Map<String, Map<String, Object>> rows = new Map<String, Map<String, Object>>{
                'Name' => new Map<String, Object>{ 'BusinessOwnerId' => String.valueOf(testUser.Id) }
            };
            List<Object> changes = new List<Object>{
                new Map<String, Object>{ 'draft' => new Map<String, Object>{ 'ownerId' => '' } }
            };
            Assert.areEqual(
                new Set<Id>{ testUser.Id },
                service.collectRequestedOwnerIds(rows, changes),
                '現在値と明示解除を区別'
            );
            service.validateOwnerReference('', new List<SObject>());
            User owner = new User(Id = testUser.Id, Username = 'owner@example.invalid', IsActive = false);
            service.validateSelectedOwner(
                String.valueOf(testUser.Id),
                new List<SObject>{ owner },
                String.valueOf(testUser.Id)
            );
            Assert.areEqual(testUser.Id, owner.Id, '現在の無効所有者は保持可能');
            Test.stopTest();
        }
    }

    /** 別のIDを同じ所有者として扱わない */
    @IsTest
    static void rejectsDifferentOwner() {

        System.runAs(testUser) {
            Test.startTest();
            try {
                service.validateOwnerReference(
                    String.valueOf(testUser.Id),
                    new List<SObject>{
                        new User(
                            Id = Id.valueOf(
                                User.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).getKeyPrefix() +
                                '000000000001'
                            ),
                            Username = 'other@example.invalid'
                        )
                    }
                );
                Assert.fail('別IDを拒否');
            } catch (AuraHandledException error) {
                Assert.isTrue(error.getMessage().contains('特定'), 'ID不一致を通知');
            }
            Test.stopTest();
        }
    }

    /** 無効ユーザーの新規指定を拒否 */
    @IsTest
    static void rejectsNewInactiveOwner() {

        System.runAs(testUser) {
            Test.startTest();
            try {
                service.validateSelectedOwner(
                    String.valueOf(testUser.Id),
                    new List<SObject>{
                        new User(Id = testUser.Id, Username = 'owner@example.invalid', IsActive = false)
                    },
                    ''
                );
                Assert.fail('新規の無効ユーザーを拒否');
            } catch (AuraHandledException error) {
                Assert.isTrue(error.getMessage().contains('無効'), '無効を通知');
            }
            Test.stopTest();
        }
    }

    /** 表示名でAPI識別子を代用しない */
    @IsTest
    static void rejectsMissingIdentifier() {

        System.runAs(testUser) {
            Test.startTest();
            try {
                service.validateOwnerReference(
                    String.valueOf(testUser.Id),
                    new List<SObject>{ new User(Id = testUser.Id) }
                );
                Assert.fail('識別子なしを拒否');
            } catch (AuraHandledException error) {
                Assert.isTrue(error.getMessage().contains('識別子'), '識別子不足を通知');
            }
            Test.stopTest();
        }
    }

    /** 解除値と候補の不整合を拒否 */
    @IsTest
    static void rejectsRecordForEmptyOwner() {

        System.runAs(testUser) {
            Test.startTest();
            try {
                service.validateOwnerReference('', new List<SObject>{ new User(Id = testUser.Id) });
                Assert.fail('解除に別レコードを対応させない');
            } catch (AuraHandledException error) {
                Assert.isTrue(error.getMessage().contains('未設定'), '不整合を通知');
            }
            Test.stopTest();
        }
    }

    /** CSV所有者の種別を確認 */
    @IsTest
    static void rejectsMalformedCsvIds() {

        System.runAs(testUser) {
            Test.startTest();
            try {
                csv.parseIds('["001000000000001AAA"]');
                Assert.fail('ユーザー以外のIDを拒否');
            } catch (AuraHandledException error) {
                Assert.isTrue(error.getMessage().contains('18桁'), '種別を検証');
            }
            Test.stopTest();
        }
    }

    /** CSV照合の上限を確認 */
    @IsTest
    static void rejectsTooManyCsvIds() {

        System.runAs(testUser) {
            Test.startTest();
            List<String> ids = new List<String>();
            for (Integer i = 0; i < 2001; i++) {
                ids.add(String.valueOf(testUser.Id));
            }
            try {
                csv.parseIds(JSON.serialize(ids));
                Assert.fail('件数上限を検証');
            } catch (AuraHandledException error) {
                Assert.isTrue(error.getMessage().contains('2000'), '上限を通知');
            }
            Test.stopTest();
        }
    }

    /** 所有者候補の検索語の前後空白を除去 */
    @IsTest
    static void normalizesOwnerSearchTerm() {

        System.runAs(testUser) {
            Test.startTest();
            String term = service.normalizeSearchTerm('  候補  ');
            Test.stopTest();
            Assert.areEqual('候補', term, '検索語の意味を保ち前後空白だけを除く');
        }
    }

    /** nullの所有者検索語を空文字へ変換 */
    @IsTest
    static void normalizesNullOwnerSearchTerm() {

        System.runAs(testUser) {
            Test.startTest();
            String term = service.normalizeSearchTerm(null);
            Test.stopTest();
            Assert.areEqual('', term, '未指定を空文字へ統一');
        }
    }

}