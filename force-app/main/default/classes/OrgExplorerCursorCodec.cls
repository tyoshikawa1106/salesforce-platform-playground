/**
 * 権限を与えないページ継続位置の厳密な変換
 */
public with sharing class OrgExplorerCursorCodec {

    /**
     * 公開権限を持たないページ位置の継続情報
     */
    public class Cursor {

        // カーソル契約の版
        public Integer v;
        // ページ取得の用途
        public String purpose;
        // 発行先の閲覧者
        public Id viewerId;
        // 階層モード
        public String mode;
        // 一覧の固定範囲
        public String scope;
        // 可視確認済みの親
        public Id parentId;
        // 無効ユーザーの表示条件
        public Boolean includeInactive;
        // 応答した最終レコード
        public Id lastId;
        // 発行時刻
        public Datetime issuedAt;
        // 有効期限
        public Datetime expiresAt;

        /**
         * 未発行の継続位置と有効期間を初期化
         */
        public Cursor() {
            // カーソル契約の版を初期化
            this.v = 1;
            // ページ取得の用途を初期化
            this.purpose = '';
            // 発行先の閲覧者を初期化
            this.viewerId = null;
            // 階層モードを初期化
            this.mode = '';
            // 一覧の固定範囲を初期化
            this.scope = '';
            // 可視確認済みの親を初期化
            this.parentId = null;
            // 無効ユーザーの表示条件を初期化
            this.includeInactive = false;
            // 応答した最終レコードを初期化
            this.lastId = null;
            // 発行時刻を初期化
            this.issuedAt = System.now();
            // 有効期限を初期化
            this.expiresAt = this.issuedAt.addMinutes(10);
        }
    }


    /**
     * 継続値をBase64へ変換
     * @param cursor 可視確認済みIDだけを含む継続情報
     * @return 暗号化や真正性を保証しない位置情報
     */
    public String encode(Cursor cursor) {
        // 永続化せず応答内だけで保持する形式へ変換
        return EncodingUtil.base64Encode(Blob.valueOf(JSON.serialize(cursor)));
    }

    /**
     * 未知のプロパティと型違いを拒否して復元
     * @param value 長さ検証済みの継続値
     * @return 復元した未検証の位置情報
     */
    public Cursor decode(String value) {
        // 復元後も利用者・用途・期限を別途照合する
        return (Cursor) JSON.deserializeStrict(
            EncodingUtil.base64Decode(value).toString(),
            Cursor.class
        );
    }

    /**
     * 用途・閲覧者・検索条件と有効期間を照合
     * @param actual 復元した継続情報
     * @param expected 現在の要求から作った比較条件
     * @return 条件が一致して有効な場合だけtrue
     */
    public Boolean matches(Cursor actual, Cursor expected) {
        // 時間と版の不正を先に除外
        if (actual == null || actual.v != 1 || actual.issuedAt == null || actual.expiresAt == null) {
            return false;
        }
        // 発行時刻を改ざんして長期利用できないよう期限幅も確認
        Datetime nowAt = System.now();
        // 将来発行、期限切れ、逆転、過長な有効期間を拒否
        if (
            actual.issuedAt > nowAt ||
            actual.expiresAt <= nowAt ||
            actual.expiresAt <= actual.issuedAt ||
            actual.expiresAt.getTime() - actual.issuedAt.getTime() > 600000
        ) {
            return false;
        }
        // 改変可能な継続値に権限判断を委譲しない
        return actual.viewerId == UserInfo.getUserId() &&
            actual.purpose == expected.purpose &&
            actual.mode == expected.mode &&
            actual.scope == expected.scope &&
            actual.parentId == expected.parentId &&
            actual.includeInactive == expected.includeInactive;
    }

    /**
     * 一覧と検索の境界IDを用途の種別で確認
     * @param encoded 元の継続値、初回は空文字
     * @param cursor 条件照合済みの継続値
     * @param expectedType 必須のレコード種別
     * @return 初回か、有効な種別の境界を持つ場合だけtrue
     */
    public Boolean isPagePositionValid(String encoded, Cursor cursor, Schema.SObjectType expectedType) {
        // 未指定だけを初回として許可
        return String.isBlank(encoded) || (cursor?.lastId?.getSObjectType() == expectedType);
    }
    /**
     * 継続値を復元し、閲覧者・用途・表示条件・有効期間を照合
     * @param value 符号化された継続値
     * @param expected 現在の要求から生成した照合条件
     * @return 復元または照合に失敗した場合はnull、一致した場合は境界情報
     */
    public Cursor decodeMatching(String value, Cursor expected) {
        // 壊れた継続値は安全な不正カーソルとして拒否
        try {
            // 未知の項目を受け付けず復元
            Cursor cursor = decode(value);
            // 現在の要求と一致する場合だけ使用
            Boolean valid = matches(cursor, expected);
            // 不正値を照会条件へ渡さない
            return valid ? cursor : null;
        } catch (Exception e) {
            // 解析失敗は内部のJSONやIDを公開せず拒否
            return null;
        }
    }
}