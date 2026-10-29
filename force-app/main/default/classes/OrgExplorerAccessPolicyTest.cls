/**
 * 照会項目と公開列への参照権限の適用
 */
@IsTest
private with sharing class OrgExplorerAccessPolicyTest {

    private static User testUser = new User(Id = UserInfo.getUserId());

    /** 参照できない任意項目を除外 */
    @IsTest
    static void excludesUnavailableOptionalFields() {

        System.runAs(testUser) {
            OrgExplorerAccessPolicy access = new OrgExplorerAccessPolicy();
            access.usersEnabled = true;
            access.managerEnabled = false;
            access.membershipEnabled = false;
            access.titleEnabled = false;
            access.departmentEnabled = false;
            access.emailEnabled = false;
            access.employeeNumberEnabled = false;
            access.profileEnabled = false;
            Test.startTest();
            List<String> fields = access.getUserFields('MANAGER_MEMBERS');
            List<String> columns = access.getMemberColumns('ROLE_MEMBERS');
            Map<String, String> cardLabels = access.getCardFieldLabels();
            Map<String, String> columnLabels = access.getMemberColumnLabels('ROLE_MEMBERS');
            Test.stopTest();
            Assert.areEqual(new List<String>{ 'Id', 'Name', 'IsActive' }, fields, '非参照の任意項目を照会へ含めない');
            Assert.areEqual(new List<String>{ 'label', 'isActive' }, columns, '参照可能な必須列だけを公開');
            Assert.isTrue(cardLabels.isEmpty(), '非参照のカード項目ラベルも公開しない');
            Assert.areEqual(new Set<String>{ 'label', 'isActive' }, columnLabels.keySet(), '一覧のラベルも非参照項目を除く');
        }
    }

    /** 非公開の連絡先項目をノード検索から除外 */
    @IsTest
    static void keepsPrivateContactFieldsOutOfNodeQueries() {

        System.runAs(testUser) {
            OrgExplorerAccessPolicy access = new OrgExplorerAccessPolicy();
            access.usersEnabled = true;
            access.managerEnabled = true;
            access.membershipEnabled = true;
            access.rolesEnabled = true;
            access.titleEnabled = true;
            access.departmentEnabled = true;
            access.emailEnabled = true;
            access.employeeNumberEnabled = true;
            access.profileEnabled = true;
            Test.startTest();
            List<String> nodeFields = access.getUserFields('MANAGER_STRUCTURE');
            List<String> memberFields = access.getUserFields('MANAGER_MEMBERS');
            List<String> columns = access.getMemberColumns('ROLE_MEMBERS');
            Map<String, String> cardLabels = access.getCardFieldLabels();
            Map<String, String> columnLabels = access.getMemberColumnLabels('ROLE_MEMBERS');
            Test.stopTest();
            Assert.areEqual(User.Department.getDescribe().getLabel(), columnLabels.get('department'), '一覧とカードの部署ラベルが一致する');
            Assert.areEqual(User.Title.getDescribe().getLabel(), columnLabels.get('title'), '一覧とカードの役職ラベルが一致する');
            Assert.areEqual(User.EmployeeNumber.getDescribe().getLabel(), columnLabels.get('employeeNumber'), '従業員番号のラベルも項目定義に従う');
            Assert.isFalse(columnLabels.containsKey('role'), '一覧にないロール列を追加しない');
            Assert.isFalse(columnLabels.containsKey('managerName'), 'マネージャーの固定見出しを項目ラベルで上書きしない');
            Assert.areEqual(
                new Map<String, String>{
                    'department' => User.Department.getDescribe().getLabel(),
                    'title' => User.Title.getDescribe().getLabel(),
                    'role' => User.UserRoleId.getDescribe().getLabel()
                },
                cardLabels,
                'カードのラベルを項目定義から取得する'
            );
            Assert.areEqual(
                new List<String>{ 'Id', 'Name', 'IsActive', 'ManagerId', 'UserRoleId', 'Title', 'Department' },
                nodeFields,
                '図と候補へメール・プロファイルを取得しない'
            );
            Assert.areEqual(
                new List<String>{
                    'Id',
                    'Name',
                    'IsActive',
                    'ManagerId',
                    'UserRoleId',
                    'Title',
                    'Department',
                    'Email',
                    'EmployeeNumber',
                    'ProfileId'
                },
                memberFields,
                '一覧では許可済み項目だけを追加'
            );
            Assert.areEqual(
                new List<String>{ 'label', 'email', 'department', 'title', 'managerName', 'employeeNumber', 'profileName', 'isActive' },
                columns,
                '参照可能な列を表示順で提供'
            );
        }
    }

    /** 範囲に必要な項目とロール列だけを選択 */
    @IsTest
    static void selectsOnlyFieldsAndRoleColumnsNeededByScope() {

        System.runAs(testUser) {
            OrgExplorerAccessPolicy access = new OrgExplorerAccessPolicy();
            access.usersEnabled = true;
            access.managerEnabled = true;
            access.membershipEnabled = true;
            access.rolesEnabled = true;
            access.profileEnabled = true;
            access.employeeNumberEnabled = true;
            Test.startTest();
            List<String> candidateFields = access.getUserFields('MANAGER_SEARCH');
            List<String> roleFields = access.getUserFields('ROLE_MEMBERS');
            List<String> managerFields = access.getUserFields('MANAGER_MEMBERS');
            List<String> columns = access.getMemberColumns('MANAGER_MEMBERS');
            Map<String, String> labels = access.getMemberColumnLabels('MANAGER_MEMBERS');
            access.rolesEnabled = false;
            List<String> deniedFields = access.getUserFields('MANAGER_MEMBERS');
            List<String> deniedColumns = access.getMemberColumns('MANAGER_MEMBERS');
            Map<String, String> deniedLabels = access.getMemberColumnLabels('MANAGER_MEMBERS');
            Test.stopTest();
            Assert.isFalse(candidateFields.contains('ManagerId'), '候補では上司IDを取得しない');
            Assert.isFalse(candidateFields.contains('UserRoleId'), '候補では所属ロールIDを取得しない');
            Assert.isFalse(candidateFields.contains('EmployeeNumber'), '候補へ従業員番号を取得しない');
            Assert.isTrue(roleFields.contains('EmployeeNumber'), 'ロール一覧で従業員番号を取得する');
            Assert.isTrue(managerFields.contains('EmployeeNumber'), '上司一覧で従業員番号を取得する');
            Assert.areEqual(columns.indexOf('employeeNumber') + 1, columns.indexOf('profileName'), '従業員番号の直後にプロファイルを表示する');
            Assert.isFalse(roleFields.contains('UserRoleId'), 'ロール側一覧に不要な所属IDを取得しない');
            Assert.isTrue(managerFields.contains('UserRoleId'), '上司側一覧のロール名取得に必要なIDを取得する');
            Assert.areEqual(columns.indexOf('profileName') + 1, columns.indexOf('roleName'), 'プロファイルの右隣へロールを追加する');
            Assert.isFalse(labels.containsKey('roleName'), '固定見出しのロール列へ項目ラベルを重複して返さない');
            Assert.isFalse(deniedFields.contains('UserRoleId'), '関連ロールを参照できなければ所属IDも取得しない');
            Assert.isFalse(deniedColumns.contains('roleName'), '関連ロールの権限がなければ列を公開しない');
            Assert.isFalse(deniedLabels.containsKey('roleName'), '非参照列のラベルも公開しない');
        }
    }

    /** ユーザー参照不可では表示列を空にする */
    @IsTest
    static void omitsAllColumnsWithoutUserAccess() {

        System.runAs(testUser) {
            OrgExplorerAccessPolicy access = new OrgExplorerAccessPolicy();
            access.usersEnabled = false;
            Test.startTest();
            List<String> columns = access.getMemberColumns('ROLE_MEMBERS');
            Map<String, String> labels = access.getMemberColumnLabels('ROLE_MEMBERS');
            Test.stopTest();
            Assert.isTrue(columns.isEmpty(), 'ユーザーの必須項目を参照できなければ列を公開しない');
            Assert.isTrue(labels.isEmpty(), 'ユーザーを参照できなければ一覧ラベルも公開しない');
        }
    }
    /**
     * 内部失敗を固定の公開エラーへ変換
     */
    @IsTest
    static void createsSafeServerError() {
        System.runAs(testUser) {
            Test.startTest();
            OrgExplorerAccessPolicy.requireValidRequest(null);
            OrgExplorerAccessPolicy.requireValidRequest('');
            AuraHandledException error = OrgExplorerAccessPolicy.createException('SERVER_ERROR');
            Test.stopTest();
            Assert.areEqual(
                '取得できませんでした。時間をおいて再試行してください。',
                error.getMessage(),
                '固定文言だけを返す'
            );
        }
    }

    /**
     * 参照拒否を内部の照会情報なしで通知
     */
    @IsTest
    static void createsSafeAccessError() {
        System.runAs(testUser) {
            Test.startTest();
            AuraHandledException error = OrgExplorerAccessPolicy.createException('ACCESS_DENIED');
            Test.stopTest();
            Assert.areEqual(
                '必要な参照権限がありません。管理者へ確認してください。',
                error.getMessage(),
                '固定文言だけを返す'
            );
        }
    }

    /** 検証失敗を空の成功応答に変換しない */
    @IsTest
    static void throwsForInvalidRequest() {
        System.runAs(testUser) {
            Test.startTest();
            try {
                OrgExplorerAccessPolicy.requireValidRequest('INVALID_REQUEST');
                Assert.fail('不正要求を拒否する');
            } catch (AuraHandledException error) {
                Assert.areEqual('入力内容を確認してください。', error.getMessage(), '検証失敗は固定の公開メッセージで通知');
            }
            Test.stopTest();
        }
    }

    /** 内部例外を固定メッセージへ変換し、公開済み例外を保持 */
    @IsTest
    static void convertsInternalErrorsWithoutDetails() {
        System.runAs(testUser) {
            AuraHandledException published = OrgExplorerAccessPolicy.createException('NOT_FOUND_OR_UNAVAILABLE');
            Test.startTest();
            AuraHandledException retained = OrgExplorerAccessPolicy.toPublicException(published);
            AuraHandledException queryFailure = OrgExplorerAccessPolicy.toPublicException(new QueryException('非公開の検索語'));
            AuraHandledException cursorFailure = OrgExplorerAccessPolicy.toPublicException(new System.FatalCursorException('非公開の継続位置'));
            AuraHandledException unknown = OrgExplorerAccessPolicy.toPublicException(new IllegalArgumentException('非公開の引数'));
            AuraHandledException fallback = OrgExplorerAccessPolicy.createException('UNKNOWN');
            Test.stopTest();
            Assert.areEqual(published, retained, '公開済み例外を一般エラーで上書きしない');
            Assert.areEqual('必要な参照権限がありません。管理者へ確認してください。', queryFailure.getMessage(), '照会の内部情報を公開しない');
            Assert.areEqual('ページの有効期限または条件が変わりました。再読込してください。', cursorFailure.getMessage(), '標準カーソル失効を固定文で通知');
            Assert.areEqual('取得できませんでした。時間をおいて再試行してください。', unknown.getMessage(), '内部例外は固定文に限定');
            Assert.areEqual(unknown.getMessage(), fallback.getMessage(), '未知のコードも一般エラーに統一');
        }
    }
}