/** ユーザーモードで期間内の設定変更履歴を分割して取得する。 */
public with sharing class SetupAuditTrailExplorerSelector {
    private static final String DETAIL_FIELDS = 'Id, CreatedDate, CreatedBy.Name, CreatedBy.Username, ResponsibleNamespacePrefix, Display, Section, DelegateUser';
    private static final String OPTION_FIELDS = 'Id, CreatedDate, Action, ResponsibleNamespacePrefix, DelegateUser';
    private static final String LOOKUP_FIELDS = OPTION_FIELDS + ', CreatedById, CreatedBy.Name, CreatedBy.Username';
    private static final String DETAIL_ACTOR_FIELDS = DETAIL_FIELDS + ', Action, CreatedById, CreatedBy.UserType';

    /** 検索条件とページ境界を保持する。 */
    public class Criteria {
        public Date monthStart;
        public Date day;
        public Id userId;
        public List<Id> recordIds;
        public Boolean matchIndex;
        public String action;
        public String namespacePrefix;
        public String delegateUser;
        public Id nextId;
        public Datetime nextTime;
        public Boolean chart;
        public Boolean csv;
        public Integer pageSize;
        public Datetime startAt;
        public Datetime endAt;
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
        String fields = DETAIL_ACTOR_FIELDS;
        if (fieldSet == Projection.CHART || fieldSet == Projection.OPTIONS) {
            fields = LOOKUP_FIELDS + ', Section';
        }
        if (fieldSet == Projection.MATCH_INDEX) {
            fields = 'Id, CreatedDate, Section, Action, CreatedById';
        }
        if (fieldSet == Projection.LOGIN_AS) {
            fields = 'Id, CreatedDate, Action, Display, DelegateUser, CreatedById, CreatedBy.Name, CreatedBy.Username';
        }
        Map<String, Object> binds = new Map<String, Object>{ 'endAt' => criteria.endAt, 'sizeLimit' => sizeLimit };
        String query = 'SELECT ' + fields + ' FROM SetupAuditTrail' + filters(criteria, binds);
        if (fieldSet == Projection.LOGIN_AS) {
            query += ' AND Action IN (\'suOrgAdminLogin\', \'suOrgAdminLogout\')';
        }
        if (criteria.nextId != null && criteria.nextTime != null) {
            query += ' AND (CreatedDate < :nextTime OR (CreatedDate = :nextTime AND Id < :nextId))';
            binds.put('nextId', criteria.nextId);
            binds.put('nextTime', criteria.nextTime);
        }
        query += ' ORDER BY CreatedDate DESC, Id DESC LIMIT :sizeLimit';
        return Database.queryWithBinds(query, binds, AccessLevel.USER_MODE);
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
        } else if (criteria.userId != null && criteria.matchIndex != true) {
            query += ' AND CreatedById = :userId';
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
