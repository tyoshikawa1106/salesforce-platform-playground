/** 設定変更履歴の一覧とグラフの取得を受け付ける。 */
public with sharing class SetupAuditTrailExplorerController {
    private static final Integer CSV_PAGE_SIZE = 2000;
    private static final Integer CHART_PAGE_SIZE = 5000;

    /** 月内の検索期間と応答形式を受け取り、Selectorには確定した期間を渡す。 */
    private class MonthRequest extends SetupAuditTrailExplorerSelector.Criteria {
        public Date monthStart;
        public Date day;
        public String section;
        public Boolean chart;
        public Boolean csv;
        public Integer pageSize;
    }

    /**
     * 対象月の履歴件数を取得する。
     * @param monthStart 対象月の初日。
     * @return 対象月の件数。
     */
    @AuraEnabled
    public static Integer countMonth(Date monthStart) {
        MonthRequest criteria = new MonthRequest();
        criteria.monthStart = monthStart;
        setPeriod(criteria);
        return SetupAuditTrailExplorerSelector.countMatches(criteria);
    }

    /**
     * 対象月の候補を分割取得する。
     * @param monthStart 対象月の初日。
     * @param nextId 直前ページの境界レコードID。
     * @param nextTime 直前ページの境界日時。
     * @return 取得ページと続きのカーソル。
     */
    @AuraEnabled
    public static SetupAuditTrailExplorerWrapper loadDistinctFilterOptions(Date monthStart, Id nextId, Datetime nextTime) {
        MonthRequest criteria = new MonthRequest();
        criteria.monthStart = monthStart;
        criteria.nextId = nextId;
        criteria.nextTime = nextTime;
        setPeriod(criteria);
        SetupAuditTrailExplorerService.checkCursor(nextId, nextTime);
        List<SetupAuditTrail> rows = SetupAuditTrailExplorerSelector.selectPage(
            criteria, SetupAuditTrailExplorerSelector.Projection.OPTIONS, CHART_PAGE_SIZE + 1
        );
        return SetupAuditTrailExplorerService.summarizeOptions(rows, CHART_PAGE_SIZE);
    }

    /**
     * 条件に一致する履歴件数を取得する。
     * @param criteriaJson クライアントが指定した検索条件。
     * @return 条件に一致する件数。
     */
    @AuraEnabled
    public static Integer countMatches(String criteriaJson) {
        return SetupAuditTrailExplorerSelector.countMatches(readCriteria(criteriaJson));
    }

    /**
     * 保持期間内の履歴をCSV用に分割取得する。
     * @param cutoff 初回は未指定。続きは最初の応答で返した取得上限。
     * @param nextId 直前ページの境界レコードID。
     * @param nextTime 直前ページの境界日時。
     * @return 取得ページと続きのカーソル。
     */
    @AuraEnabled
    public static SetupAuditTrailExplorerWrapper exportAllHistory(Datetime cutoff, Id nextId, Datetime nextTime) {
        SetupAuditTrailExplorerService.checkCursor(nextId, nextTime);
        SetupAuditTrailExplorerSelector.Criteria criteria = new SetupAuditTrailExplorerSelector.Criteria();
        criteria.endAt = cutoff ?? System.now();
        criteria.nextId = nextId;
        criteria.nextTime = nextTime;
        SetupAuditTrailExplorerWrapper wrapper = loadDetails(criteria, CSV_PAGE_SIZE);
        // 後続ページでも同じ期間を照会できるよう、今回の検索に使った上限を返す。
        wrapper.cutoff = criteria.endAt;
        return wrapper;
    }

    /**
     * 月境界をまたぐ代理ログインを照合するため、保持期間内の入退場履歴だけを取得する。
     * @param cutoff 照合上限。未指定なら初回の組織時刻。
     * @param nextId 直前ページの境界レコードID。
     * @param nextTime 直前ページの境界日時。
     * @return 照合行、固定した上限と次のページ境界。
     */
    @AuraEnabled
    public static SetupAuditTrailExplorerWrapper loadLoginAsHistory(Datetime cutoff, Id nextId, Datetime nextTime) {
        SetupAuditTrailExplorerService.checkCursor(nextId, nextTime);
        SetupAuditTrailExplorerSelector.Criteria criteria = new SetupAuditTrailExplorerSelector.Criteria();
        criteria.endAt = cutoff ?? System.now();
        criteria.nextId = nextId;
        criteria.nextTime = nextTime;
        Integer sizeLimit = 200;
        List<SetupAuditTrail> rows = SetupAuditTrailExplorerSelector.selectPage(
            criteria, SetupAuditTrailExplorerSelector.Projection.LOGIN_AS, sizeLimit + 1
        );
        SetupAuditTrailExplorerWrapper wrapper = SetupAuditTrailExplorerService.summarizeDetails(rows, sizeLimit);
        wrapper.cutoff = criteria.endAt;
        return wrapper;
    }

    /**
     * 対象月の履歴を用途に応じて分割取得する。
     * @param criteriaJson クライアントが指定した検索条件、用途、ページ境界。
     * @return 取得ページと続きのカーソル。
     */
    @AuraEnabled
    public static SetupAuditTrailExplorerWrapper load(String criteriaJson) {
        MonthRequest criteria = readCriteria(criteriaJson);
        SetupAuditTrailExplorerService.checkCursor(criteria.nextId, criteria.nextTime);
        if (criteria.csv == true) {
            return loadDetails(criteria, CSV_PAGE_SIZE);
        }
        if (criteria.matchIndex == true) {
            List<SetupAuditTrail> matches = SetupAuditTrailExplorerSelector.selectPage(
                criteria, SetupAuditTrailExplorerSelector.Projection.MATCH_INDEX, CHART_PAGE_SIZE + 1
            );
            return SetupAuditTrailExplorerService.summarizeMatches(matches, CHART_PAGE_SIZE, criteria.section);
        }
        if (criteria.chart == true) {
            List<SetupAuditTrail> rows = SetupAuditTrailExplorerSelector.selectPage(
                criteria, SetupAuditTrailExplorerSelector.Projection.CHART, CHART_PAGE_SIZE + 1
            );
            return SetupAuditTrailExplorerService.summarizeChart(rows, CHART_PAGE_SIZE);
        }
        Integer sizeLimit = Math.max(1, Math.min(2000, criteria.pageSize ?? 50));
        List<SetupAuditTrail> rows = SetupAuditTrailExplorerSelector.selectPage(
            criteria, SetupAuditTrailExplorerSelector.Projection.DETAIL, sizeLimit + 1
        );
        SetupAuditTrailExplorerWrapper wrapper = SetupAuditTrailExplorerService.summarizeDetails(rows, sizeLimit);
        // 表示ページに含まれる代理ユーザーだけをまとめて氏名に変換する。
        Set<String> delegates = new Set<String>();
        Boolean needsEmployeeActors = false;
        for (SetupAuditTrail row : wrapper.records) {
            if (row.CreatedById != null && String.isBlank(row.CreatedBy?.Username)) {
                needsEmployeeActors = true;
            }
            if (String.isNotBlank(row.DelegateUser)) {
                delegates.add(row.DelegateUser);
            }
        }
        if (needsEmployeeActors) {
            wrapper.employeeActorIds = employeeActors();
        }
        wrapper.delegateNames = SetupAuditTrailExplorerSelector.selectDelegateNames(delegates);
        return wrapper;
    }

    private static List<Id> employeeActors() {
        return SetupAuditTrailExplorerService.employeeActorIds(SetupAuditTrailExplorerSelector.selectEmployeeActions(System.now()));
    }

    private static SetupAuditTrailExplorerWrapper loadDetails(SetupAuditTrailExplorerSelector.Criteria criteria, Integer sizeLimit) {
        List<SetupAuditTrail> rows = SetupAuditTrailExplorerSelector.selectPage(
            criteria, SetupAuditTrailExplorerSelector.Projection.CSV, sizeLimit + 1
        );
        Integer pageSize = SetupAuditTrailExplorerService.csvPageSize(rows, sizeLimit);
        SetupAuditTrailExplorerWrapper wrapper = SetupAuditTrailExplorerService.summarizeDetails(rows, pageSize);
        // 月別でも全期間でも、作成者確認は出力ごとに一度で済ませる。
        if (criteria.nextId == null) {
            wrapper.employeeActorIds = employeeActors();
        }
        return wrapper;
    }

    private static MonthRequest readCriteria(String criteriaJson) {
        MonthRequest criteria = String.isBlank(criteriaJson) ? new MonthRequest() :
            (MonthRequest) JSON.deserialize(criteriaJson, MonthRequest.class);
        setPeriod(criteria);
        return criteria;
    }

    private static void setPeriod(MonthRequest criteria) {
        SetupAuditTrailExplorerService.checkPeriod(criteria.monthStart, criteria.day);
        criteria.startAt = SetupAuditTrailExplorerService.midnight(criteria.day ?? criteria.monthStart);
        Date endDay = criteria.day == null ? criteria.monthStart.addMonths(1) : criteria.day.addDays(1);
        criteria.endAt = SetupAuditTrailExplorerService.midnight(endDay);
    }
}
