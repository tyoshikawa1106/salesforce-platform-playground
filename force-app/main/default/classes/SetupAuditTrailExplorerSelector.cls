/** ユーザーモードで期間内の設定変更履歴を分割して取得する。 */
public with sharing class SetupAuditTrailExplorerSelector {
    private static final String DETAIL_FIELDS = 'Id, CreatedDate, CreatedBy.Name, CreatedBy.Username, ResponsibleNamespacePrefix, Display, Section, DelegateUser';
    private static final String OPTION_FIELDS = 'Id, CreatedDate, Action, ResponsibleNamespacePrefix, DelegateUser';
    private static final String LOOKUP_FIELDS = OPTION_FIELDS + ', CreatedById, CreatedBy.Name, CreatedBy.Username';
    private static final String CHART_FIELDS = LOOKUP_FIELDS + ', Section';

    /** 検索条件とページ境界を保持する。 */
    public class Criteria {
        public Date monthStart;
        public Date day;
        public Id userId;
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

    public enum Projection { DETAIL, CHART, OPTIONS }

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
        String fields = fieldSet == Projection.CHART ? CHART_FIELDS :
            (fieldSet == Projection.OPTIONS ? LOOKUP_FIELDS : DETAIL_FIELDS);
        Map<String, Object> binds = new Map<String, Object>{ 'endAt' => criteria.endAt, 'sizeLimit' => sizeLimit };
        String query = 'SELECT ' + fields + ' FROM SetupAuditTrail' + filters(criteria, binds);
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
        if (criteria.userId != null) {
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
