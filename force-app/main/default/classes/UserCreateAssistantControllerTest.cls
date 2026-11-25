/** ユーザー作成と割り当ての保存単位の検証 */
@IsTest
private with sharing class UserCreateAssistantControllerTest {

    private static User testUser = new User(Id = UserInfo.getUserId());

    /** コピー元の選択から参照項目を取得 */
    @IsTest
    static void loadsSelectedSource() {
        User source = buildUser('参照元');

        System.runAs(testUser) {
            insert source;
            Test.startTest();
            UserCreateAssistantWrapper form = UserCreateAssistantController.getForm(source.Id);
            Test.stopTest();
            Map<String, Object> lastName;
            for (Map<String, Object> field : form.fields) {
                if (field.get('apiName') == 'LastName') {
                    lastName = field;
                }
            }
            Assert.isNotNull(lastName, '参照元の姓をフォームに含める');
            Assert.areEqual(source.LastName, lastName.get('value'), '選択したレコードを表示する');
        }

    }

    /** 取得対象を指定しない要求を空のフォームとして扱わない */
    @IsTest
    static void rejectsMissingSourceForDisplay() {

        System.runAs(testUser) {
            Test.startTest();
            try {
                UserCreateAssistantController.getForm(null);
                Assert.fail('コピー元が未指定なら取得失敗を返す');
            } catch (AuraHandledException e) {
                Assert.isNotNull(e.getMessage(), 'ユーザー選び直しを案内');
            }
            Test.stopTest();
        }

    }

    /** 元の利用者を維持しながら同じロールとプロファイルで作成 */
    @IsTest
    static void createsUserWithoutModifyingSource() {
        User source = buildUser('変更しない元');
        Map<String, Object> target = buildTarget('別の新規');

        System.runAs(testUser) {
            UserRole role = new UserRole(Name = 'ユーザー作成試験');
            insert role;
            source.UserRoleId = role.Id;
            insert source;
            PermissionSet direct = new PermissionSet(Name = 'UserCreateNoCopy', Label = '引継対象外');
            insert direct;
            insert new PermissionSetAssignment(AssigneeId = source.Id, PermissionSetId = direct.Id);
            UserCreateAssistantWrapper request = buildRequest(source, target);
            request.sendResetEmail = true;
            Test.startTest();
            Id createdId = UserCreateAssistantController.saveUser(request);
            Test.stopTest();
            User created = [SELECT IsActive, LastName, ProfileId, UserRoleId, Username FROM User WHERE Id = :createdId];
            User original = [SELECT IsActive, LastName FROM User WHERE Id = :source.Id];
            Assert.areEqual(target.get('Username'), created.Username, '入力されたユーザー名で新規作成');
            Assert.areEqual(target.get('LastName'), created.LastName, '新規側の氏名を使用');
            Assert.isTrue(created.IsActive, '新規ユーザーは有効で作成');
            Assert.areEqual(role.Id, created.UserRoleId, '元のロールを引き継ぐ');
            Assert.areEqual(source.ProfileId, created.ProfileId, '元のライセンスに対応する同じプロファイルを使う');
            Assert.isTrue(original.IsActive, '通常の作成ではコピー元を有効のままにする');
            Assert.areEqual(source.LastName, original.LastName, '通常の作成では元の氏名を維持');
            Assert.areEqual(0, [SELECT COUNT() FROM PermissionSetAssignment WHERE AssigneeId = :createdId AND PermissionSetId = :direct.Id], 'チェックを外した権限セットは付与しない');
        }

    }

    /** 無効を指定した旧クライアントからの作成要求を拒否 */
    @IsTest
    static void rejectsInactiveTarget() {
        System.runAs(testUser) {
            User source = buildUser('無効な元');
            source.IsActive = false;
            insert source;
            Map<String, Object> target = buildTarget('新規');
            target.put('IsActive', false);
            UserCreateAssistantWrapper request = buildRequest(source, target);
            Test.startTest();
            try {
                UserCreateAssistantController.saveUser(request);
                Assert.fail('無効な新規ユーザーは作成できない');
            } catch (AuraHandledException expected) {
                Assert.isNotNull(expected.getMessage(), '有効状態のエラーを返す');
            }
            target.put('IsActive', true);
            request.targetValuesJson = JSON.serialize(target);
            Id createdId = UserCreateAssistantController.saveUser(request);
            Test.stopTest();
            Assert.isTrue([SELECT IsActive FROM User WHERE Id = :createdId].IsActive, '無効なコピー元からも有効なユーザーを作成');
            Assert.isFalse([SELECT IsActive FROM User WHERE Id = :source.Id].IsActive, 'コピー元は無効なまま');
        }
    }

    /** 元の利用者を編集・無効化して有効な割り当てを引き継ぐ */
    @IsTest
    static void deactivatesSourceAndCopiesSelectedAssignments() {
        User source = buildUser('引継元');
        Map<String, Object> target = buildTarget('引継先');

        System.runAs(testUser) {
            insert source;
            PermissionSet direct = new PermissionSet(Name = 'UserCreateDirect', Label = '直接割り当て');
            PermissionSet member = new PermissionSet(Name = 'UserCreateMember', Label = 'グループ経由');
            insert new List<PermissionSet>{ direct, member };
            PermissionSetGroup groupRecord = createAssignableGroup(member.Id, 'UserCreateGroup');
            insert new List<PermissionSetAssignment>{
                new PermissionSetAssignment(AssigneeId = source.Id, PermissionSetId = direct.Id),
                new PermissionSetAssignment(AssigneeId = source.Id, PermissionSetGroupId = groupRecord.Id)
            };
            UserCreateAssistantWrapper request = buildRequest(source, target);
            request.deactivateSource = true;
            request.copyPermissionSets = true;
            request.copyPermissionSetGroups = true;
            request.sourceValuesJson = '{"LastName":"退任済"}';
            Test.startTest();
            Id createdId = UserCreateAssistantController.saveUser(request);
            Test.stopTest();
            User original = [SELECT IsActive, LastName FROM User WHERE Id = :source.Id];
            Assert.isFalse(original.IsActive, 'チェック時だけ元の利用者を無効化');
            Assert.areEqual('退任済', original.LastName, '入力された元の氏名を保存');
            Assert.areEqual(1, [SELECT COUNT() FROM PermissionSetAssignment WHERE AssigneeId = :createdId AND PermissionSetId = :direct.Id], '直接の割り当てを複製');
            Assert.areEqual(1, [SELECT COUNT() FROM PermissionSetAssignment WHERE AssigneeId = :createdId AND PermissionSetGroupId = :groupRecord.Id], 'グループ単位で複製');
            Assert.areEqual(0, [SELECT COUNT() FROM PermissionSetAssignment WHERE AssigneeId = :createdId AND PermissionSetId = :member.Id AND PermissionSetGroupId = null], 'グループ内の権限セットは個別に付与しない');
        }

    }

    /** 新規ユーザーの保存失敗時は元の編集と無効化を取り消す */
    @IsTest
    static void rollsBackSourceWhenNewUsernameIsAlreadyUsed() {
        User source = buildUser('元の氏名');
        Map<String, Object> target = buildTarget('失敗する新規');
        target.put('Username', source.Username);

        System.runAs(testUser) {
            insert source;
            UserCreateAssistantWrapper request = buildRequest(source, target);
            request.deactivateSource = true;
            request.sourceValuesJson = '{"LastName":"編集後"}';
            Test.startTest();
            try {
                UserCreateAssistantController.saveUser(request);
                Assert.fail('同じユーザー名で新規作成できない');
            } catch (AuraHandledException e) {
                Assert.isNotNull(e.getMessage(), '再試行できるエラーを返す');
            }
            Test.stopTest();
            User original = [SELECT IsActive, LastName FROM User WHERE Id = :source.Id];
            Assert.isTrue(original.IsActive, '新規ユーザーを保存できない場合は元の利用者を有効に戻す');
            Assert.areEqual(source.LastName, original.LastName, '途中で行った氏名変更も取り消す');
        }

    }

    /** グループ割り当てに失敗したら作成・無効化を戻し、引き継ぎを外すと再試行できる */
    @IsTest
    static void retriesWithoutGroupAfterAssignmentFailure() {
        User source = buildUser('再試行元');
        Map<String, Object> target = buildTarget('再試行先');
        String targetUsername = (String)target.get('Username');

        System.runAs(testUser) {
            insert source;
            PermissionSet initial = new PermissionSet(Name = 'UserCreateGroupInitial', Label = '変更前');
            PermissionSet additional = new PermissionSet(Name = 'UserCreateGroupAdditional', Label = '追加分');
            insert new List<PermissionSet>{ initial, additional };
            PermissionSetGroup groupRecord = createAssignableGroup(initial.Id, 'UserCreateGroupRetry');
            insert new PermissionSetAssignment(AssigneeId = source.Id, PermissionSetGroupId = groupRecord.Id);
            // 構成変更で未再計算にし、新規割り当てを行えない状態を用意
            insert new PermissionSetGroupComponent(PermissionSetId = additional.Id, PermissionSetGroupId = groupRecord.Id);
            UserCreateAssistantWrapper request = buildRequest(source, target);
            request.deactivateSource = true;
            request.copyPermissionSetGroups = true;
            Test.startTest();
            try {
                UserCreateAssistantController.saveUser(request);
                Assert.fail('再計算前のグループを新規ユーザーに付与できない');
            } catch (AuraHandledException e) {
                Assert.isNotNull(e.getMessage(), '割り当ての失敗を画面に通知');
            }
            Assert.areEqual(0, [SELECT COUNT() FROM User WHERE Username = :targetUsername], '割り当て失敗時に新規ユーザーを取り消す');
            Assert.isTrue([SELECT IsActive FROM User WHERE Id = :source.Id].IsActive, '元ユーザーの無効化も取り消す');
            request.copyPermissionSetGroups = false;
            Id targetId = UserCreateAssistantController.saveUser(request);
            Test.stopTest();
            Assert.areEqual(targetUsername, [SELECT Username FROM User WHERE Id = :targetId].Username, '同じ入力のままグループを外して保存');
            Assert.areEqual(0, [SELECT COUNT() FROM PermissionSetAssignment WHERE AssigneeId = :targetId AND PermissionSetGroupId = :groupRecord.Id], '再試行ではグループを付与しない');
        }

    }

    /**
     * 試験用の権限セットを含み、コピー元に割り当て可能なグループを作成
     * @param memberId グループに含めるテスト用権限セット
     * @param developerName テスト用グループの API 名
     * @return 権限を計算済みのグループ
     */
    private static PermissionSetGroup createAssignableGroup(Id memberId, String developerName) {
        PermissionSetGroup groupRecord = new PermissionSetGroup(DeveloperName = developerName, MasterLabel = developerName);
        insert groupRecord;
        insert new PermissionSetGroupComponent(PermissionSetId = memberId, PermissionSetGroupId = groupRecord.Id);
        Test.calculatePermissionSetGroup(groupRecord.Id);
        return groupRecord;
    }

    /**
     * 割り当て・無効化を選択しない新規作成リクエスト
     * @param source コピー元ユーザー
     * @param target 新規側への入力項目
     * @return テストの入力やモードを追加できる保存リクエスト
     */
    private static UserCreateAssistantWrapper buildRequest(User source, Map<String, Object> target) {
        UserCreateAssistantWrapper request = new UserCreateAssistantWrapper();
        request.sourceId = source.Id;
        request.deactivateSource = false;
        request.copyPermissionSets = false;
        request.copyPermissionSetGroups = false;
        request.sourceValuesJson = '{}';
        request.targetValuesJson = JSON.serialize(target);
        return request;
    }

    /**
     * テスト間で重複しない識別子を持つユーザーを準備
     * @param lastName テストで照合する利用者の姓
     * @return 一意なユーザー名とニックネームを持つ未保存ユーザー
     */
    private static User buildUser(String lastName) {
        String uniqueKey = EncodingUtil.convertToHex(Crypto.generateAesKey(128));
        return new User(
            LastName = lastName, ProfileId = UserInfo.getProfileId(), IsActive = true,
            Alias = 'ucatest', Email = 'user-create-test@example.invalid',
            Username = uniqueKey + '@example.invalid', CommunityNickname = uniqueKey,
            TimeZoneSidKey = 'Asia/Tokyo', LocaleSidKey = UserInfo.getLocale(),
            LanguageLocaleKey = UserInfo.getLanguage(), EmailEncodingKey = 'UTF-8'
        );
    }

    /**
     * 新規側から送る入力項目だけをシリアライズ対象にする
     * @param lastName 新規ユーザーの姓
     * @return 固定項目を除く新規側の入力値
     */
    private static Map<String, Object> buildTarget(String lastName) {
        Map<String, Object> target = new Map<String, Object>(buildUser(lastName).getPopulatedFieldsAsMap());
        target.remove('ProfileId');
        return target;
    }
}
