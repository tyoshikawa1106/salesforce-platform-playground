/** ユーザー作成フォームの表示・入力と割り当ての検証 */
@IsTest
private with sharing class UserCreateAssistantServiceTest {

    private static UserCreateAssistantService service = new UserCreateAssistantService();
    private static User testUser = new User(Id = UserInfo.getUserId());

    /** ライセンス・ロール・プロファイルとコピー元の表示値を保持 */
    @IsTest
    static void buildsReadOnlyAssignmentFields() {
        User source = new User(Id = testUser.Id, ProfileId = UserInfo.getProfileId(), LastName = '表示テスト', LocaleSidKey = 'ja_JP');
        Profile profile = (Profile)JSON.deserialize('{"Name":"試験プロファイル","UserLicense":{"Name":"試験ライセンス"}}', Profile.class);
        source.putSObject('Profile', profile);

        System.runAs(testUser) {
            Test.startTest();
            UserCreateAssistantFieldCatalog catalog = new UserCreateAssistantFieldCatalog();
            Map<String, String> groups = catalog.getFieldGroups();
            List<String> queryFields = service.getQueryFields(catalog.orderedNames);
            UserCreateAssistantWrapper form = service.createForm(groups, catalog.orderedNames, new List<User>{ source });
            Test.stopTest();
            Map<String, Map<String, Object>> byName = new Map<String, Map<String, Object>>();
            List<String> leadingNames = new List<String>();
            Set<String> namesToCheck = new Set<String>{ 'Username', 'Email', 'Alias', 'LastName', 'FirstName' };
            for (Map<String, Object> field : form.fields) {
                String apiName = (String)field.get('apiName');
                byName.put(apiName, field);
                if (namesToCheck.contains(apiName)) {
                    leadingNames.add(apiName);
                }
            }
            Assert.areEqual(new List<String>{ 'LastName', 'FirstName', 'Alias', 'Email', 'Username' }, leadingNames, '基本情報を標準画面の順序で表示');
            Assert.isTrue(queryFields.contains('LastName'), 'コピー元の姓を取得対象に含める');
            Assert.areEqual(source.LastName, byName.get('LastName').get('value'), 'コピー元の値を参照欄に渡す');
            Assert.areEqual('試験ライセンス', byName.get('UserLicenseId').get('displayValue'), '参照先のライセンス名を表示');
            Assert.areEqual('試験プロファイル', byName.get('ProfileId').get('displayValue'), '参照先のプロファイル名を表示');
            for (String locked : new List<String>{ 'ProfileId', 'UserRoleId', 'UserLicenseId' }) {
                Assert.isNotNull(byName.get(locked), '固定項目も参照欄に表示する: ' + locked);
                Assert.areEqual(false, byName.get(locked).get('canCreate'), '固定項目を新規側で編集できない: ' + locked);
                Assert.areEqual(false, byName.get(locked).get('canUpdate'), '固定項目を元の利用者についても編集できない: ' + locked);
            }
        }

    }

    /** 取引先責任者に紐づくユーザーを表示・無効化・作成のコピー元にできない */
    @IsTest
    static void rejectsContactLinkedSource() {
        List<User> sources = new List<User>{new User(Id = sampleId(User.SObjectType), ContactId = sampleId(Contact.SObjectType))};
        System.runAs(testUser) {
            Test.startTest();
            try {
                service.createForm(new Map<String,String>(), new List<String>(), sources);
                Assert.fail('取引先責任者に紐づくユーザーの読み込みを拒否');
            } catch (AuraHandledException expected) {
                Assert.isNotNull(expected.getMessage(), 'コピー元の再選択を案内');
            }
            for (UserCreateAssistantFieldInput.Side side : UserCreateAssistantFieldInput.Side.values()) {
                try {
                    service.prepareUser(sources, '{"LastName":"検証"}', side);
                    Assert.fail('保存時にもコミュニティユーザーを拒否');
                } catch (AuraHandledException expected) {
                    Assert.isNotNull(expected.getMessage(), '外部ユーザーの無効化も新規側の作成も拒否');
                }
            }
            Test.stopTest();
        }
    }

    /** 変更したコピー元の項目だけを更新対象にする */
    @IsTest
    static void preparesSparseSourceUpdate() {
        User source = new User(Id = sampleId(User.SObjectType), LastName = '変更前', ProfileId = UserInfo.getProfileId());

        System.runAs(testUser) {
            Test.startTest();
            User updateRecord = service.prepareUser(new List<User>{ source }, '{"LastName":"変更後","Department":null}', UserCreateAssistantFieldInput.Side.SOURCE);
            Test.stopTest();
            Assert.areEqual(source.Id, updateRecord.Id, '選択中のコピー元を更新');
            Assert.areEqual('変更後', updateRecord.LastName, '入力された姓を適用');
            Assert.isFalse(updateRecord.IsActive, '編集モードでの保存はコピー元を無効化');
            Assert.isFalse(updateRecord.getPopulatedFieldsAsMap().containsKey('ProfileId'), '既存のプロファイルを上書きしない');
        }

    }

    /** 利用者自身の無効化を拒否 */
    @IsTest
    static void rejectsSelfDeactivation() {

        System.runAs(testUser) {
            Test.startTest();
            try {
                service.prepareUser(new List<User>{ testUser }, '{}', UserCreateAssistantFieldInput.Side.SOURCE);
                Assert.fail('ログイン中のユーザーを無効化できない');
            } catch (AuraHandledException e) {
                Assert.isNotNull(e.getMessage(), '操作できない理由を通知');
            }
            Test.stopTest();
        }

    }

    /** 直接割り当てだけを選ぶ場合にグループを含めない */
    @IsTest
    static void copiesOnlyDirectPermissionSet() {
        Id setId = sampleId(PermissionSet.SObjectType);
        List<PermissionSetAssignment> source = new List<PermissionSetAssignment>{
            new PermissionSetAssignment(PermissionSetId = setId),
            new PermissionSetAssignment(PermissionSetGroupId = sampleId(PermissionSetGroup.SObjectType))
        };

        System.runAs(testUser) {
            UserCreateAssistantWrapper request = new UserCreateAssistantWrapper();
            request.targetId = testUser.Id;
            request.copyPermissionSets = true;
            request.copyPermissionSetGroups = false;
            Test.startTest();
            List<PermissionSetAssignment> result = service.createAssignments(request, source, new List<PermissionSetAssignment>());
            Test.stopTest();
            Assert.areEqual(1, result.size(), '直接割り当てだけを作成する');
            Assert.areEqual(setId, result[0].PermissionSetId, '元の権限セットを引き継ぐ');
            Assert.isNull(result[0].PermissionSetGroupId, 'グループを付与しない');
        }

    }

    /** グループの割り当てだけを期限付きで作成 */
    @IsTest
    static void copiesOnlyGroupAndPreservesExpiration() {
        Id groupId = sampleId(PermissionSetGroup.SObjectType);
        Id setId = sampleId(PermissionSet.SObjectType);
        Datetime expiration = System.now().addDays(7);
        List<PermissionSetAssignment> source = new List<PermissionSetAssignment>{
            new PermissionSetAssignment(PermissionSetId = setId),
            new PermissionSetAssignment(PermissionSetId = setId, PermissionSetGroupId = groupId, ExpirationDate = expiration)
        };

        System.runAs(testUser) {
            UserCreateAssistantWrapper request = new UserCreateAssistantWrapper();
            request.targetId = testUser.Id;
            request.copyPermissionSets = false;
            request.copyPermissionSetGroups = true;
            Test.startTest();
            List<PermissionSetAssignment> result = service.createAssignments(request, source, new List<PermissionSetAssignment>());
            Test.stopTest();
            Assert.areEqual(1, result.size(), 'グループだけを作成する');
            Assert.areEqual(testUser.Id, result[0].AssigneeId, '新しい利用者に割り当てる');
            Assert.areEqual(groupId, result[0].PermissionSetGroupId, '元のグループを維持');
            Assert.isNull(result[0].PermissionSetId, '集約された権限セットを直接付与しない');
            Assert.areEqual(expiration, result[0].ExpirationDate, '有効期限を延長しない');
        }

    }

    /** 新規側の作成時に既に付与された割り当ては重複させない */
    @IsTest
    static void skipsAlreadyAssignedPermissions() {
        Id setId = sampleId(PermissionSet.SObjectType);
        Id groupId = sampleId(PermissionSetGroup.SObjectType);
        List<PermissionSetAssignment> existing = new List<PermissionSetAssignment>{
            new PermissionSetAssignment(PermissionSetId = setId),
            new PermissionSetAssignment(PermissionSetGroupId = groupId)
        };

        System.runAs(testUser) {
            UserCreateAssistantWrapper request = new UserCreateAssistantWrapper();
            request.targetId = testUser.Id;
            request.copyPermissionSets = true;
            request.copyPermissionSetGroups = true;
            Test.startTest();
            List<PermissionSetAssignment> result = service.createAssignments(request, existing, existing);
            Test.stopTest();
            Assert.isTrue(result.isEmpty(), '自動付与済みの割り当てを再登録しない');
        }

    }

    /** 期限を過ぎた割り当ては保存時に複製しない */
    @IsTest
    static void skipsExpiredAssignment() {
        PermissionSetAssignment expired = new PermissionSetAssignment(
            PermissionSetId = sampleId(PermissionSet.SObjectType), ExpirationDate = System.now().addDays(-1)
        );

        System.runAs(testUser) {
            UserCreateAssistantWrapper request = new UserCreateAssistantWrapper();
            request.targetId = testUser.Id;
            request.copyPermissionSets = true;
            request.copyPermissionSetGroups = true;
            Test.startTest();
            List<PermissionSetAssignment> result = service.createAssignments(request, new List<PermissionSetAssignment>{ expired }, new List<PermissionSetAssignment>());
            Test.stopTest();
            Assert.isTrue(result.isEmpty(), '取得後に期限切れとなった権限を再付与しない');
        }

    }

    /**
     * 照会を必要としない割り当て変換用に識別子を区別
     * @param objectType テスト対象の設定オブジェクト
     * @return 対象型と同じ接頭辞を持つテスト用識別子
     */
    private static Id sampleId(Schema.SObjectType objectType) {
        return (Id)(objectType.getDescribe(SObjectDescribeOptions.DEFERRED).getKeyPrefix() + '000000000001');
    }
}
