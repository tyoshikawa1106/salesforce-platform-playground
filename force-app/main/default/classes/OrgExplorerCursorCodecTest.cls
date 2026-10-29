/**
 * 構造の継続情報の形式・期限・利用者の検証
 */
@IsTest
private with sharing class OrgExplorerCursorCodecTest {

    private static OrgExplorerCursorCodec codec = new OrgExplorerCursorCodec();
    private static User testUser = new User(Id = UserInfo.getUserId());

    /**
     * 継続値の期限・利用者・目的を毎回照合
     */
    @IsTest
    static void rejectsExpiredAndCrossPurposeCursors() {

        System.runAs(testUser) {
            OrgExplorerCursorCodec.Cursor expected = new OrgExplorerCursorCodec.Cursor();
            expected.purpose = 'PAGE';
            OrgExplorerCursorCodec.Cursor actual = new OrgExplorerCursorCodec.Cursor();
            actual.purpose = 'PAGE';
            actual.viewerId = testUser.Id;
            Test.startTest();
            Boolean valid = codec.matches(codec.decode(codec.encode(actual)), expected);
            actual.expiresAt = System.now().addMinutes(-1);
            Boolean expired = codec.matches(actual, expected);
            actual.expiresAt = System.now().addMinutes(9);
            actual.purpose = 'SEARCH';
            Boolean crossPurpose = codec.matches(actual, expected);
            Test.stopTest();
            Assert.isTrue(valid, '条件が同じ有効な位置情報を受け入れる');
            Assert.isFalse(expired, '期限切れは自動的に初回へ戻さない');
            Assert.isFalse(crossPurpose, '用途の違う継続値を拒否');
        }

    }

    /**
     * 十分以内を超える有効期間の改変を拒否
     */
    @IsTest
    static void rejectsExtendedCursorLifetime() {

        System.runAs(testUser) {
            OrgExplorerCursorCodec.Cursor actual = new OrgExplorerCursorCodec.Cursor();
            actual.viewerId = testUser.Id;
            actual.expiresAt = actual.issuedAt.addMinutes(11);
            Test.startTest();
            Boolean valid = codec.matches(actual, new OrgExplorerCursorCodec.Cursor());
            Test.stopTest();
            Assert.isFalse(valid, '有効期間を延長したカーソルを拒否');
        }

    }

    /**
     * 将来発行された継続情報を拒否
     */
    @IsTest
    static void rejectsFutureIssuedCursor() {

        System.runAs(testUser) {
            OrgExplorerCursorCodec.Cursor actual = new OrgExplorerCursorCodec.Cursor();
            actual.viewerId = testUser.Id;
            actual.issuedAt = System.now().addMinutes(1);
            actual.expiresAt = actual.issuedAt.addMinutes(1);
            Test.startTest();
            Boolean valid = codec.matches(actual, new OrgExplorerCursorCodec.Cursor());
            Test.stopTest();
            Assert.isFalse(valid, '将来の発行時刻を許可しない');
        }

    }

    /**
     * 発行先が異なる継続情報を拒否
     */
    @IsTest
    static void rejectsCursorWithoutMatchingViewer() {

        System.runAs(testUser) {
            OrgExplorerCursorCodec.Cursor actual = new OrgExplorerCursorCodec.Cursor();
            actual.viewerId = null;
            Test.startTest();
            Boolean valid = codec.matches(actual, new OrgExplorerCursorCodec.Cursor());
            Test.stopTest();
            Assert.isFalse(valid, '現在の閲覧者と一致しないカーソルを拒否');
        }

    }

    /**
     * 異種IDへ改変したページ境界を照会前に拒否
     */
    @IsTest
    static void rejectsCursorWithWrongRecordType() {

        System.runAs(testUser) {
            OrgExplorerPageRequest request = new OrgExplorerPageRequest();
            request.requestId = 'cursor-type';
            request.mode = 'ROLE';
            request.scope = 'ROLE_STRUCTURE';
            OrgExplorerCursorCodec.Cursor cursor = new OrgExplorerService().createPageCursor(request);
            cursor.lastId = testUser.Id;
            request.cursor = codec.encode(cursor);
            Test.startTest();
            Boolean valid = codec.isPagePositionValid(request.cursor, cursor, UserRole.SObjectType);
            Test.stopTest();
            Assert.isFalse(valid, 'ロール一覧へUserの境界を流用しない');
        }

    }

    /**
     * 未知の継続情報を公開エラーへ統一
     */
    @IsTest
    static void rejectsUnknownCursorProperties() {

        System.runAs(testUser) {
            OrgExplorerPageRequest request = new OrgExplorerPageRequest();
            request.requestId = 'cursor-unknown';
            request.mode = 'ROLE';
            request.scope = 'ROLE_STRUCTURE';
            OrgExplorerCursorCodec.Cursor cursor = new OrgExplorerService().createPageCursor(request);
            String jsonValue = JSON.serialize(cursor);
            request.cursor = EncodingUtil.base64Encode(
                Blob.valueOf(jsonValue.substring(0, jsonValue.length() - 1) + ',"unexpected":true}')
            );
            Test.startTest();
            OrgExplorerCursorCodec.Cursor decoded = codec.decodeMatching(request.cursor, cursor);
            Test.stopTest();
            Assert.isNull(decoded, '未知の項目がある継続値を拒否');
        }

    }

    /**
     * 構造カーソルの閲覧者・期限・用途・対象型の変更を拒否
     */
    @IsTest
    static void validatesStructureCursorBindings() {

        System.runAs(testUser) {
            OrgExplorerPageRequest request = new OrgExplorerPageRequest();
            request.requestId = 'manager-cursor';
            request.mode = 'MANAGER';
            request.scope = 'MANAGER_STRUCTURE';
            OrgExplorerService service = new OrgExplorerService();
            OrgExplorerCursorCodec.Cursor cursor = service.createPageCursor(request);
            cursor.lastId = UserInfo.getUserId();
            cursor.viewerId = Id.valueOf(
                User.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).getKeyPrefix() + '000000000001'
            );
            request.cursor = codec.encode(cursor);
            Test.startTest();
            OrgExplorerCursorCodec.Cursor otherViewer = codec.decodeMatching(request.cursor, service.createPageCursor(request));
            cursor = service.createPageCursor(request);
            cursor.lastId = UserInfo.getUserId();
            cursor.issuedAt = System.now().addMinutes(-11);
            cursor.expiresAt = System.now().addMinutes(-1);
            request.cursor = codec.encode(cursor);
            OrgExplorerCursorCodec.Cursor expired = codec.decodeMatching(request.cursor, service.createPageCursor(request));
            cursor = service.createPageCursor(request);
            cursor.lastId = Id.valueOf(
                UserRole.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED).getKeyPrefix() + '000000000001'
            );
            request.cursor = codec.encode(cursor);
            Boolean wrongType = codec.isPagePositionValid(request.cursor, cursor, User.SObjectType);
            cursor = service.createPageCursor(request);
            cursor.lastId = UserInfo.getUserId();
            cursor.scope = 'ROLE_STRUCTURE';
            request.cursor = codec.encode(cursor);
            OrgExplorerCursorCodec.Cursor wrongScope = codec.decodeMatching(request.cursor, service.createPageCursor(request));
            Test.stopTest();
            Assert.isNull(otherViewer, '別の閲覧者のカーソルを拒否');
            Assert.isNull(expired, '期限切れのカーソルを拒否');
            Assert.isFalse(wrongType, '異種IDの境界を拒否');
            Assert.isNull(wrongScope, '別用途のカーソルを拒否');
        }
    }

    /**
     * 未発行の継続値を有効なページ境界として扱わない
     */
    @IsTest
    static void rejectsMissingCursor() {

        System.runAs(testUser) {
            Test.startTest();
            Boolean valid = codec.matches(null, new OrgExplorerCursorCodec.Cursor());
            Test.stopTest();
            Assert.isFalse(valid, '未発行の継続値を拒否');
        }
    }

    /**
     * 旧クラスで発行した継続情報のJSON形式を維持
     */
    @IsTest
    static void preservesExistingCursorJson() {

        System.runAs(testUser) {
            String legacyJson = '{"v":1,"purpose":"PAGE","viewerId":null,"mode":"ROLE",' +
                '"scope":"ROLE_STRUCTURE","parentId":null,"includeInactive":true,"lastId":null,' +
                '"issuedAt":"2026-01-01T00:00:00.000Z","expiresAt":"2026-01-01T00:10:00.000Z"}';
            Test.startTest();
            OrgExplorerCursorCodec.Cursor value = codec.decode(EncodingUtil.base64Encode(Blob.valueOf(legacyJson)));
            String actualJson = EncodingUtil.base64Decode(codec.encode(value)).toString();
            Test.stopTest();
            Assert.areEqual(JSON.deserializeUntyped(legacyJson), JSON.deserializeUntyped(actualJson), '内部クラス化で継続情報の項目名・型・値を変えない');
        }
    }

    /** 未発行の継続位置を初期化 */
    @IsTest
    static void initializesUnassignedState() {

        System.runAs(testUser) {
            Test.startTest();
            OrgExplorerCursorCodec.Cursor value = new OrgExplorerCursorCodec.Cursor();
            Test.stopTest();
            Assert.areEqual(1, value.v, 'vの初期契約を維持');
            Assert.areEqual('', value.purpose, 'purposeの初期契約を維持');
            Assert.isNull(value.viewerId, 'viewerIdを未設定として扱う');
            Assert.areEqual('', value.mode, 'modeの初期契約を維持');
            Assert.areEqual('', value.scope, 'scopeの初期契約を維持');
            Assert.isNull(value.parentId, 'parentIdを未設定として扱う');
            Assert.areEqual(false, value.includeInactive, 'includeInactiveの初期契約を維持');
            Assert.isNull(value.lastId, 'lastIdを未設定として扱う');
        }
    }

    /**
     * 継続値の期限を発行時刻から正確に設定
     */
    @IsTest
    static void derivesCursorExpiryFromIssuedTime() {

        System.runAs(testUser) {
            Test.startTest();
            OrgExplorerCursorCodec.Cursor cursor = new OrgExplorerCursorCodec.Cursor();
            Test.stopTest();
            Assert.areEqual(cursor.issuedAt.addMinutes(10), cursor.expiresAt, '時刻取得の差で許容期間を超えない');
        }
    }
}
