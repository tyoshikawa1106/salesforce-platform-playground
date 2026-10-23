/**
 * 検索条件と一覧取得位置の入力契約
 */
@IsTest
private with sharing class OrgExplorerRequestServiceTest {

    private static OrgExplorerRequestService requestService = new OrgExplorerRequestService();
    private static User testUser = TestDataFactory.getTestUser();

    /**
     * ロール構造と検索を参照権限に従って停止
     */
    @IsTest
    static void deniesUnavailableCapabilitiesAndInvalidIdentifiers() {
        System.runAs(testUser) {
            OrgExplorerAccessPolicy access = new OrgExplorerAccessPolicy();
            access.rolesEnabled = false;
            OrgExplorerPageRequest page = new OrgExplorerPageRequest();
            page.requestId = 'test-page';
            page.mode = 'ROLE';
            page.scope = 'ROLE_STRUCTURE';
            OrgExplorerSearchRequest search = new OrgExplorerSearchRequest();
            search.requestId = 'test-search';
            Test.startTest();
            String searchCode = requestService.validateSearch(search, access);
            String badEnvelope = requestService.validateEnvelope(page, '改変した値');
            Test.stopTest();
            Assert.areEqual('ACCESS_DENIED', searchCode, '候補検索を拒否');
            Assert.areEqual('INVALID_REQUEST', badEnvelope, '不正な相関キーを拒否');
        }
    }

    /**
     * 検索語の正規化で元の入力を変更しない
     */
    @IsTest
    static void normalizesSearchWithoutMutatingRequest() {
        System.runAs(testUser) {
            OrgExplorerSearchRequest request = new OrgExplorerSearchRequest();
            request.requestId = 'normalize-1';
            request.term = '  検索対象  ';
            OrgExplorerAccessPolicy access = new OrgExplorerAccessPolicy();

            Test.startTest();
            String code = requestService.validateSearch(request, access);
            String normalized = requestService.normalizeSearchTerm(request.term);
            Test.stopTest();

            Assert.areEqual('', code, '前後空白を除いた語で入力を検証');
            Assert.areEqual('検索対象', normalized, '照会用には前後の空白を除去');
            Assert.areEqual('  検索対象  ', request.term, '検証の副作用で入力を書き換えない');
        }
    }

    /**
     * 標準カーソルなしの途中位置を拒否
     */
    @IsTest
    static void rejectsMissingStandardCursorAtLaterPosition() {
        System.runAs(testUser) {
            OrgExplorerPageRequest request = memberRequest();
            request.startIndex = 50;
            Test.startTest();
            String code = requestService.validateMemberPosition(request);
            Test.stopTest();
            Assert.areEqual('INVALID_CURSOR', code, '標準カーソルなしでは先頭以外を取得しない');
        }
    }

    /**
     * 標準カーソルへ負の取得位置を渡さない
     */
    @IsTest
    static void rejectsNegativeStandardCursorPosition() {
        System.runAs(testUser) {
            OrgExplorerPageRequest request = memberRequest();
            request.startIndex = -1;
            Test.startTest();
            String code = requestService.validateMemberPosition(request);
            Test.stopTest();
            Assert.areEqual('INVALID_CURSOR', code, '負の取得位置を拒否');
        }
    }

    private static OrgExplorerPageRequest memberRequest() {
        OrgExplorerPageRequest request = new OrgExplorerPageRequest();
        request.requestId = 'member-fields';
        request.mode = 'MANAGER';
        request.scope = 'MANAGER_MEMBERS';
        request.parentId = testUser.Id;
        return request;
    }

    /**
     * 上司候補検索にも上司項目の参照を要求
     */
    @IsTest
    static void deniesManagerSearchWithoutManagerAccess() {
        System.runAs(testUser) {
            OrgExplorerAccessPolicy access = new OrgExplorerAccessPolicy();
            access.managerEnabled = false;
            OrgExplorerSearchRequest request = new OrgExplorerSearchRequest();
            request.requestId = 'permission-search';
            request.term = '権限確認';
            Test.startTest();
            String code = requestService.validateManagerSearch(request, access);
            Test.stopTest();
            Assert.areEqual('ACCESS_DENIED', code, '上司検索も同じ権限を要求');
        }
    }

    /**
     * 不正な上司候補要求を照会前に拒否
     */
    @IsTest
    static void rejectsInvalidManagerSearchInputs() {
        System.runAs(testUser) {
            OrgExplorerAccessPolicy access = new OrgExplorerAccessPolicy();
            OrgExplorerSearchRequest request = new OrgExplorerSearchRequest();
            request.requestId = 'invalid-search';
            request.activityFilter = 'UNKNOWN';
            Test.startTest();
            String missing = requestService.validateManagerSearch(null, access);
            String filter = requestService.validateManagerSearch(request, access);
            request.activityFilter = 'ALL';
            request.term = null;
            String empty = requestService.validateManagerSearch(request, access);
            request.term = 'x'.repeat(81);
            String oversized = requestService.validateManagerSearch(request, access);
            Integer queryCount = Limits.getQueries();
            Test.stopTest();
            Assert.areEqual('INVALID_REQUEST', missing, 'nullの上司検索を拒否');
            Assert.areEqual('INVALID_REQUEST', filter, '不正な有効条件を拒否');
            Assert.areEqual('INVALID_REQUEST', empty, '空欄を全件検索に変換しない');
            Assert.areEqual('INVALID_REQUEST', oversized, '長すぎる検索語を拒否');
            Assert.areEqual(0, queryCount, '入力不正でデータを照会しない');
        }
    }

    /**
     * 一覧の取得件数は省略・正の範囲・上限を区別
     */
    @IsTest
    static void validatesMemberPageSize() {
        System.runAs(testUser) {
            OrgExplorerPageRequest request = memberRequest();
            Test.startTest();
            request.pageSize = null;
            String omitted = requestService.validateMemberPosition(request);
            request.pageSize = 5;
            String small = requestService.validateMemberPosition(request);
            request.pageSize = 0;
            String zero = requestService.validateMemberPosition(request);
            request.pageSize = -1;
            String negative = requestService.validateMemberPosition(request);
            request.pageSize = 51;
            String oversized = requestService.validateMemberPosition(request);
            Test.stopTest();
            Assert.areEqual('', omitted, '省略時は通常の50件で受け付ける');
            Assert.areEqual('', small, '小さい取得件数を受け付ける');
            Assert.areEqual('INVALID_REQUEST', zero, 'ゼロ件を拒否');
            Assert.areEqual('INVALID_REQUEST', negative, '負数を拒否');
            Assert.areEqual('INVALID_REQUEST', oversized, '50件を超える指定を拒否');
        }
    }

    /**
     * 長すぎるロール名を検索前に拒否
     */
    @IsTest
    static void rejectsOversizedRoleSearchTerm() {
        System.runAs(testUser) {
            OrgExplorerSearchRequest request = new OrgExplorerSearchRequest();
            request.requestId = 'oversized-role-term';
            request.term = 'x'.repeat(81);
            Test.startTest();
            String code = requestService.validateSearch(request, new OrgExplorerAccessPolicy());
            Integer queries = Limits.getQueries();
            Test.stopTest();
            Assert.areEqual('INVALID_REQUEST', code, '長すぎるロール名を拒否');
            Assert.areEqual(0, queries, '入力不正ではデータを照会しない');
        }
    }

    /**
     * API名検索と一件カーソルの取得位置を直接確認
     */
    @IsTest
    static void validatesDefaultRoleAndCursorPosition() {
        System.runAs(testUser) {
            OrgExplorerAccessPolicy access = new OrgExplorerAccessPolicy();
            OrgExplorerSearchRequest search = new OrgExplorerSearchRequest();
            search.requestId = 'default-role';
            search.developerName = 'SampleCompany';
            OrgExplorerPageRequest request = memberRequest();
            request.paginationCursor = Database.getPaginationCursorWithBinds(
                'SELECT Id FROM User WHERE Id = :id', new Map<String, Object>{ 'id' => testUser.Id }, AccessLevel.USER_MODE
            );
            Test.startTest();
            String valid = requestService.validateSearch(search, access);
            search.developerName = '1Invalid';
            String invalidApiName = requestService.validateSearch(search, access);
            search.requestId = '';
            String invalid = requestService.validateSearch(search, access);
            String first = requestService.validateMemberPosition(request);
            Integer size = requestService.getMemberFetchSize(request.paginationCursor, 0, 1);
            request.startIndex = 1;
            String endPosition = requestService.validateMemberPosition(request);
            Test.stopTest();
            Assert.areEqual('', valid, '初期API名を受け付ける');
            Assert.areEqual('INVALID_REQUEST', invalidApiName, '識別子形式でないAPI名を拒否');
            Assert.areEqual('INVALID_REQUEST', invalid, '不正な要求を拒否');
            Assert.areEqual('', first, 'カーソルの先頭を受け付ける');
            Assert.areEqual(1, size, '残件数以内に限定');
            Assert.areEqual('INVALID_CURSOR', endPosition, '終端以降を拒否');
        }
    }

    /**
     * 親ID未指定の所属一覧を全件照会へ変換しない
     */
    @IsTest
    static void rejectsMissingParentOnMemberPage() {
        System.runAs(testUser) {
            OrgExplorerPageRequest request = new OrgExplorerPageRequest();
            request.requestId = 'missing-parent';
            request.mode = 'ROLE';
            request.scope = 'ROLE_MEMBERS';
            Test.startTest();
            String code = requestService.validatePage(request, new OrgExplorerAccessPolicy());
            Test.stopTest();
            Assert.areEqual('INVALID_REQUEST', code, '所属一覧には親が必須');
        }

    }

    /**
     * ロール構造取得へUserのIDを流用しない
     */
    @IsTest
    static void rejectsWrongParentTypeOnRolePage() {
        System.runAs(testUser) {
            OrgExplorerPageRequest request = new OrgExplorerPageRequest();
            request.requestId = 'wrong-parent';
            request.mode = 'ROLE';
            request.scope = 'ROLE_STRUCTURE';
            request.parentId = testUser.Id;
            Test.startTest();
            String code = requestService.validatePage(request, new OrgExplorerAccessPolicy());
            Test.stopTest();
            Assert.areEqual('INVALID_REQUEST', code, '親のオブジェクト種別を確認');
        }

    }

    /**
     * ロール構造の参照だけで所属ユーザーを公開しない
     */
    @IsTest
    static void deniesMembershipWhenRoleStructureIsReadable() {
        System.runAs(testUser) {
            OrgExplorerPageRequest request = new OrgExplorerPageRequest();
            request.requestId = 'membership-denied';
            request.mode = 'ROLE';
            request.scope = 'ROLE_MEMBERS';
            request.parentId = Id.valueOf(
                UserRole.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).getKeyPrefix() +
                String.valueOf(1).leftPad(12, '0')
            );
            OrgExplorerAccessPolicy access = new OrgExplorerAccessPolicy();
            access.rolesEnabled = true;
            access.membershipEnabled = false;
            Test.startTest();
            String code = requestService.validatePage(request, access);
            Test.stopTest();
            Assert.areEqual('ACCESS_DENIED', code, '所属一覧には所属項目の参照権限が必要');
        }

    }

    /**
     * 上司構造はロール参照権限なしでも上司項目の権限で利用可能
     */
    @IsTest
    static void allowsManagerPagesWithoutRoleAccess() {
        System.runAs(testUser) {
            OrgExplorerAccessPolicy access = new OrgExplorerAccessPolicy();
            access.rolesEnabled = false;
            access.membershipEnabled = false;
            access.managerEnabled = true;
            OrgExplorerPageRequest request = new OrgExplorerPageRequest();
            request.requestId = 'manager-access';
            request.mode = 'MANAGER';
            request.scope = 'MANAGER_STRUCTURE';
            Test.startTest();
            String code = requestService.validatePage(request, access);
            Test.stopTest();
            Assert.areEqual('', code, '上司階層へロールの権限を要求しない');
        }
    }

    /**
     * ロールの参照権限があっても上司項目を参照できなければ拒否
     */
    @IsTest
    static void rejectsManagerPagesWithoutManagerAccess() {
        System.runAs(testUser) {
            OrgExplorerAccessPolicy access = new OrgExplorerAccessPolicy();
            access.rolesEnabled = true;
            access.managerEnabled = false;
            OrgExplorerPageRequest request = new OrgExplorerPageRequest();
            request.requestId = 'manager-denied';
            request.mode = 'MANAGER';
            request.scope = 'MANAGER_STRUCTURE';
            Test.startTest();
            String code = requestService.validatePage(request, access);
            Test.stopTest();
            Assert.areEqual('ACCESS_DENIED', code, 'ロールの権限で上司階層の権限を代用しない');
        }
    }

    /**
     * 不正な起点・権限・条件のカーソルを拒否
     */
    @IsTest
    static void rejectsInvalidStructureRequests() {
        System.runAs(testUser) {
            OrgExplorerPageRequest request = structureRequest(testUser.Id);
            OrgExplorerAccessPolicy access = new OrgExplorerAccessPolicy();
            Test.startTest();
            Assert.areEqual('INVALID_REQUEST', requestService.validatePage(request, access), 'Userを起点にしない');
            request.parentId = roleId(2000);
            access.rolesEnabled = false;
            Assert.areEqual('ACCESS_DENIED', requestService.validatePage(request, access), '構造権限なしを拒否');
            request.parentId = null;
            Assert.areEqual('ACCESS_DENIED', requestService.validatePage(request, access), '起点なしでも参照権限を確認');
            access.rolesEnabled = true;
            Assert.areEqual('', requestService.validatePage(request, access), '起点なしの全ロール検索を許可');
            Test.stopTest();
        }
    }

    private static OrgExplorerPageRequest structureRequest(Id rootId) {
        OrgExplorerPageRequest request = new OrgExplorerPageRequest();
        request.requestId = 'structure-test';
        request.mode = 'ROLE';
        request.scope = 'ROLE_STRUCTURE';
        request.parentId = rootId;
        request.includeInactive = true;
        return request;
    }

    private static Id roleId(Integer value) {
        return Id.valueOf('00E' + String.valueOf(value).leftPad(12, '0'));
    }

    /**
     * 直属部下の一覧でも上司項目の参照を要求
     */
    @IsTest
    static void deniesManagerMembersWithoutManagerAccess() {
        System.runAs(testUser) {
            OrgExplorerAccessPolicy access = new OrgExplorerAccessPolicy();
            access.managerEnabled = false;
            OrgExplorerPageRequest request = new OrgExplorerPageRequest();
            request.requestId = 'manager-members-access';
            request.mode = 'MANAGER';
            request.scope = 'MANAGER_MEMBERS';
            request.parentId = UserInfo.getUserId();
            Test.startTest();
            String code = requestService.validatePage(request, access);
            Test.stopTest();
            Assert.areEqual('ACCESS_DENIED', code, '上司項目の参照を必須にする');
        }
    }

    /**
     * 構造要求が標準一覧の取得位置を省略しても受け付ける
     */
    @IsTest
    static void acceptsManagerStructureWithoutMemberPosition() {
        System.runAs(testUser) {
            OrgExplorerPageRequest request = (OrgExplorerPageRequest) JSON.deserialize(
                '{"requestId":"structure-json","mode":"MANAGER","scope":"MANAGER_STRUCTURE","includeInactive":true}',
                OrgExplorerPageRequest.class
            );
            Test.startTest();
            String code = requestService.validatePage(request, new OrgExplorerAccessPolicy());
            Test.stopTest();
            Assert.areEqual('', code, '構造取得では一覧用の位置とカーソルの省略を許可');
        }
    }

    /**
     * 壊れた継続値とモード・対象種別の混在を拒否
     */
    @IsTest
    static void rejectsInvalidRequestsAndCursors() {
        System.runAs(testUser) {
            OrgExplorerPageRequest request = new OrgExplorerPageRequest();
            request.requestId = 'wrong-manager-mode';
            request.scope = 'MANAGER_STRUCTURE';
            Test.startTest();
            request.mode = 'ROLE';
            String code = requestService.validatePage(request, new OrgExplorerAccessPolicy());
            Test.stopTest();
            Assert.areEqual('INVALID_REQUEST', code, 'ロール条件を上司APIへ混ぜない');
        }
    }

    /**
     * 廃止した階層取得範囲を再公開しない
     */
    @IsTest
    static void rejectsRetiredPageScopes() {
        System.runAs(testUser) {
            OrgExplorerPageRequest request = new OrgExplorerPageRequest();
            request.requestId = 'retired-scopes';
            request.mode = 'ROLE';
            List<String> codes = new List<String>();
            Test.startTest();
            for (
                String scope : new List<String>{
                    'MANAGER_ROOTS',
                    'MANAGER_CHILDREN',
                    'ROLE_ROOTS',
                    'ROLE_CHILDREN',
                    'NO_ROLE_MEMBERS'
                }
            ) {
                request.scope = scope;
                codes.add(requestService.validatePage(request, new OrgExplorerAccessPolicy()));
            }
            Integer queries = Limits.getQueries();
            Test.stopTest();
            Assert.areEqual(
                new List<String>{
                    'INVALID_REQUEST',
                    'INVALID_REQUEST',
                    'INVALID_REQUEST',
                    'INVALID_REQUEST',
                    'INVALID_REQUEST'
                },
                codes,
                '旧範囲はすべて拒否'
            );
            Assert.areEqual(0, queries, '廃止範囲でSOQLを実行しない');
        }
    }

    /**
     * 不正な用途・対象型・検索条件を問い合わせ前に拒否
     */
    @IsTest
    static void rejectsInvalidInputsBeforeQuery() {
        System.runAs(testUser) {
            OrgExplorerPageRequest missingParent = managerPage('MANAGER_MEMBERS', null);
            OrgExplorerPageRequest wrongScope = managerPage('UNKNOWN', null);
            OrgExplorerPageRequest wrongType = managerPage(
                'MANAGER_STRUCTURE',
                Id.valueOf(
                    UserRole.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).getKeyPrefix() + '000000000001'
                )
            );
            OrgExplorerPageRequest oversized = managerPage('MANAGER_STRUCTURE', null);
            oversized.cursor = 'x'.repeat(4097);
            OrgExplorerAccessPolicy access = new OrgExplorerAccessPolicy();
            Test.startTest();
            List<String> codes = new List<String>{
                requestService.validatePage(null, access),
                requestService.validatePage(missingParent, access),
                requestService.validatePage(wrongScope, access),
                requestService.validatePage(wrongType, access),
                requestService.validatePage(oversized, access)
            };
            Integer queryCount = Limits.getQueries();
            Test.stopTest();
            for (String code : codes) {
                Assert.areEqual('INVALID_REQUEST', code, '不正なページ要求を拒否');
            }
            Assert.areEqual(0, queryCount, '入力不正でデータを照会しない');
        }
    }

    private static OrgExplorerPageRequest managerPage(String scope, Id parentId) {
        OrgExplorerPageRequest request = new OrgExplorerPageRequest();
        request.requestId = 'manager-page';
        request.mode = 'MANAGER';
        request.scope = scope;
        request.parentId = parentId;
        request.includeInactive = true;
        return request;
    }

    /**
     * 構造要求が標準一覧の取得位置を省略しても受け付ける
     */
    @IsTest
    static void acceptsStructureWithoutMemberPosition() {
        System.runAs(testUser) {
            OrgExplorerPageRequest request = (OrgExplorerPageRequest) JSON.deserialize(
                '{"requestId":"structure-json","mode":"ROLE","scope":"ROLE_STRUCTURE","includeInactive":true}',
                OrgExplorerPageRequest.class
            );
            Test.startTest();
            String code = requestService.validatePage(request, new OrgExplorerAccessPolicy());
            Test.stopTest();
            Assert.areEqual('', code, '構造取得では一覧用の位置とカーソルの省略を許可');
        }
    }
}