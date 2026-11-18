/** ユーザーモードで期間内の設定変更履歴を分割して取得する。 */
public with sharing class SetupAuditTrailExplorerSelector {
    private static final String DETAIL_FIELDS = 'Id, CreatedDate, CreatedBy.Name, CreatedBy.Username, ResponsibleNamespacePrefix, Display, Section, DelegateUser';
    private static final String OPTION_FIELDS = 'Id, CreatedDate, Action, ResponsibleNamespacePrefix, DelegateUser';
    private static final String LOOKUP_FIELDS = OPTION_FIELDS + ', CreatedById, CreatedBy.Name, CreatedBy.Username';
    private static final String CHART_FIELDS = LOOKUP_FIELDS + ', Section';

    /** 対象月に記録された設定変更履歴の件数を返す。 */
    public static Integer countMonth(Datetime startAt, Datetime endAt) {
        return countMatches(startAt, endAt, null, null, null, null);
    }

    public static Integer countMatches(Datetime startAt, Datetime endAt, Id userId, String action, String namespacePrefix, String delegateUser) {
        Map<String, Object> binds = new Map<String, Object>{'startAt' => startAt, 'endAt' => endAt};
        String whereClause = filters(startAt, userId, action, namespacePrefix, delegateUser, binds);
        return Database.countQueryWithBinds('SELECT COUNT() FROM SetupAuditTrail' + whereClause, binds, AccessLevel.USER_MODE);
    }

    public static List<SetupAuditTrail> selectPage(
        Datetime startAt, Datetime endAt, Id userId, String action, String namespacePrefix, String delegateUser, Id nextId, Datetime nextTime, Boolean chart, Integer sizeLimit
    ) {
        return selectInOrder(startAt, endAt, userId, action, namespacePrefix, delegateUser, nextId, nextTime, chart ? CHART_FIELDS : DETAIL_FIELDS, sizeLimit, false);
    }

    public static List<SetupAuditTrail> selectTail(
        Datetime startAt, Datetime endAt, Id userId, String action, String namespacePrefix, String delegateUser, Id nextId, Datetime nextTime, Integer sizeLimit
    ) {
        return selectInOrder(startAt, endAt, userId, action, namespacePrefix, delegateUser, nextId, nextTime, DETAIL_FIELDS, sizeLimit, true);
    }

    /** 候補に必要な項目を、履歴と同じカーソル順で取得する。 */
    public static List<SetupAuditTrail> selectOptionPage(
        Datetime startAt, Datetime endAt, Id nextId, Datetime nextTime, Integer sizeLimit
    ) {
        return selectInOrder(startAt, endAt, null, null, null, null, nextId, nextTime, LOOKUP_FIELDS, sizeLimit, false);
    }

    private static List<SetupAuditTrail> selectInOrder(
        Datetime startAt, Datetime endAt, Id userId, String action, String namespacePrefix, String delegateUser, Id nextId, Datetime nextTime, String fields, Integer sizeLimit,
        Boolean ascending
    ) {
        Map<String, Object> binds = new Map<String, Object>{'endAt' => endAt, 'sizeLimit' => sizeLimit};
        String query = 'SELECT ' + fields + ' FROM SetupAuditTrail' + filters(startAt, userId, action, namespacePrefix, delegateUser, binds);
        if (nextId != null && nextTime != null) {
            String operator = ascending ? ' > ' : ' < ';
            query += ' AND (CreatedDate' + operator + ':nextTime OR (CreatedDate = :nextTime AND Id' + operator + ':nextId))';
            binds.put('nextId', nextId);
            binds.put('nextTime', nextTime);
        }
        query += ascending ? ' ORDER BY CreatedDate ASC, Id ASC LIMIT :sizeLimit' : ' ORDER BY CreatedDate DESC, Id DESC LIMIT :sizeLimit';
        return Database.queryWithBinds(query, binds, AccessLevel.USER_MODE);
    }

    private static String filters(Datetime startAt, Id userId, String action, String namespacePrefix, String delegateUser, Map<String, Object> binds) {
        String query = ' WHERE CreatedDate < :endAt';
        if (startAt != null) {
            query += ' AND CreatedDate >= :startAt';
            binds.put('startAt', startAt);
        }
        if (userId != null) {
            query += ' AND CreatedById = :userId';
            binds.put('userId', userId);
        }
        if (String.isNotBlank(action)) {
            query += ' AND Action = :action';
            binds.put('action', action);
        }
        if (String.isNotBlank(namespacePrefix)) {
            query += ' AND ResponsibleNamespacePrefix = :namespacePrefix';
            binds.put('namespacePrefix', namespacePrefix);
        }
        if (String.isNotBlank(delegateUser)) {
            query += ' AND DelegateUser = :delegateUser';
            binds.put('delegateUser', delegateUser);
        }
        return query;
    }
}
