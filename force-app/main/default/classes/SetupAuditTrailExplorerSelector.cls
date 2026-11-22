/** ユーザーモードで期間内の設定変更履歴を分割して取得する。 */
public with sharing class SetupAuditTrailExplorerSelector {
    private static final String DETAIL_FIELDS = 'Id, CreatedDate, CreatedBy.Name, CreatedBy.Username, ResponsibleNamespacePrefix, Display, Section, DelegateUser';
    private static final String OPTION_FIELDS = 'Id, CreatedDate, Action, ResponsibleNamespacePrefix, DelegateUser';
    private static final String LOOKUP_FIELDS = OPTION_FIELDS + ', CreatedById, CreatedBy.Name, CreatedBy.Username';
    private static final String DETAIL_ACTOR_FIELDS = DETAIL_FIELDS + ', Action, CreatedById, CreatedBy.UserType';

    /** 検索条件とページ境界を保持する。 */
    public virtual class Criteria {
        public Id userId;
        public List<Id> recordIds;
        public Boolean matchIndex;
        public String action;
        public String namespacePrefix;
        public String delegateUser;
        public Id nextId;
        public Datetime nextTime;
        public Datetime startAt;
        public Datetime endAt;
    }

    /**
     * 表示ページの代理ユーザーを、閲覧できるユーザーの氏名に対応付ける。
     * @param usernames ページに含まれる代理ユーザーのログイン名。
     * @return 小文字のログイン名をキーにした氏名。
     */
    public static Map<String, String> selectDelegateNames(Set<String> usernames) {
        Map<String, String> names = new Map<String, String>();
        if (!usernames.isEmpty()) {
            for (User delegate : [SELECT Username, Name FROM User WHERE Username IN :usernames WITH USER_MODE]) {
                names.put(delegate.Username.toLowerCase(), delegate.Name);
            }
        }
        return names;
    }

    public enum Projection { DETAIL, CHART, OPTIONS, CSV, LOGIN_AS, MATCH_INDEX }

    /**
     * CSVの作成者を確認するため、保持期間内のSalesforce内部操作を取得する。
     * @param beforeTime 作成日時の上限（この日時を含まない）。
     * @return 従業員操作の本文と作成者を照合するための直近の候補。
     */
    public static List<SetupAuditTrail> selectEmployeeActions(Datetime beforeTime) {
        List<SetupAuditTrail> rows = [
            SELECT CreatedById, Display FROM SetupAuditTrail
            WHERE Action = 'BlackTabFrameworkActionRun' AND DelegateUser != null AND CreatedDate < :beforeTime
            WITH USER_MODE ORDER BY CreatedDate DESC, Id DESC LIMIT 200
        ];
        return rows;
    }

    /**
     * 条件に一致する履歴件数を取得する。
     * @param criteria 取得範囲と絞り込み条件。
     * @return 条件に一致する件数。
     */
    public static Integer countMatches(Criteria criteria) {
        Map<String, Object> binds = new Map<String, Object>{ 'endAt' => criteria.endAt };
        String whereClause = filters(criteria, binds);
        return Database.countQueryWithBinds('SELECT COUNT() FROM SetupAuditTrail' + whereClause, binds, AccessLevel.USER_MODE);
    }

    /**
     * カーソルより古い履歴を取得する。
     * @param criteria 取得範囲、絞り込み条件、ページ境界。
     * @param fieldSet 用途に応じて取得する項目。
     * @param sizeLimit ページに含める最大件数。
     * @return 指定条件の履歴レコード。
     */
    public static List<SetupAuditTrail> selectPage(Criteria criteria, Projection fieldSet, Integer sizeLimit) {
        // 条件値はすべてバインド変数で渡す
        Map<String, Object> binds = new Map<String, Object>{ 'endAt' => criteria.endAt, 'sizeLimit' => sizeLimit };
        // 画面で必要なページを一括取得
        return Database.queryWithBinds(pageQuery(criteria, fieldSet, binds), binds, AccessLevel.USER_MODE);
    }

    /**
     * CSVの文字数上限に達した時点で読み取りを終了できる履歴の取得
     * @param criteria 取得期間とページ境界
     * @param sizeLimit 続きの有無を判定する1行を含む取得件数
     * @return 作成日時・ID降順の履歴イテレータ
     */
    public static Iterator<SObject> iterateCsvRows(Criteria criteria, Integer sizeLimit) {
        // 一覧と同じ期間・ページ条件を適用
        Map<String, Object> binds = new Map<String, Object>{ 'endAt' => criteria.endAt, 'sizeLimit' => sizeLimit };
        // 詳細行をページ全体のリストに展開せず順次読み取り
        return Database.getQueryLocatorWithBinds(pageQuery(criteria, Projection.CSV, binds), binds, AccessLevel.USER_MODE).iterator();
    }

    private static String pageQuery(Criteria criteria, Projection fieldSet, Map<String, Object> binds) {
        String fields = DETAIL_ACTOR_FIELDS;
        if (fieldSet == Projection.CHART) {
            fields = LOOKUP_FIELDS + ', Section, CreatedBy.UserType';
        }
        if (fieldSet == Projection.OPTIONS) {
            fields = LOOKUP_FIELDS + ', Section';
        }
        if (fieldSet == Projection.MATCH_INDEX) {
            fields = 'Id, CreatedDate, Section, Action, CreatedById';
        }
        if (fieldSet == Projection.LOGIN_AS) {
            fields = 'Id, CreatedDate, Action, Display, DelegateUser, CreatedById, CreatedBy.Name, CreatedBy.Username, CreatedBy.UserType';
        }
        String query = 'SELECT ' + fields + ' FROM SetupAuditTrail' + filters(criteria, binds);
        if (fieldSet == Projection.LOGIN_AS) {
            query += ' AND Action IN (\'suOrgAdminLogin\', \'suOrgAdminLogout\')';
        }
        if (criteria.nextId != null && criteria.nextTime != null) {
            query += ' AND (CreatedDate < :nextTime OR (CreatedDate = :nextTime AND Id < :nextId))';
            binds.put('nextId', criteria.nextId);
            binds.put('nextTime', criteria.nextTime);
        }
        // 同一日時の履歴も一意に並べて境界の直後から継続
        return query + ' ORDER BY CreatedDate DESC, Id DESC LIMIT :sizeLimit';
    }

    private static String filters(Criteria criteria, Map<String, Object> binds) {
        String query = ' WHERE CreatedDate < :endAt';
        if (criteria.startAt != null) {
            query += ' AND CreatedDate >= :startAt';
            binds.put('startAt', criteria.startAt);
        }
        if (criteria.recordIds != null) {
            query += ' AND Id IN :recordIds';
            binds.put('recordIds', criteria.recordIds);
        } else if (criteria.userId != null) {
            // 照合前の代理ログインは作成者が違っても対象ユーザーの操作になり得る。
            query += criteria.matchIndex == true
                ? ' AND (CreatedById = :userId OR Action = \'suOrgAdminLogin\')'
                : ' AND CreatedById = :userId';
            binds.put('userId', criteria.userId);
        }
        if (String.isNotBlank(criteria.action)) {
            query += ' AND Action = :action';
            binds.put('action', criteria.action);
        }
        if (String.isNotBlank(criteria.namespacePrefix)) {
            query += ' AND ResponsibleNamespacePrefix = :namespacePrefix';
            binds.put('namespacePrefix', criteria.namespacePrefix);
        }
        if (String.isNotBlank(criteria.delegateUser)) {
            query += ' AND DelegateUser = :delegateUser';
            binds.put('delegateUser', criteria.delegateUser);
        }
        return query;
    }
}
