/**
 * 照会項目と公開列への参照権限の適用
 */
@IsTest
private with sharing class OrgExplorerAccessPolicyTest {

    private static User testUser = TestDataFactory.getTestUser();

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
}