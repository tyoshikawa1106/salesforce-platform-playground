/** 設定変更履歴の一覧とグラフの取得を受け付ける。 */
public with sharing class SetupAuditTrailExplorerController {
    private static final Integer CSV_PAGE_SIZE = 2000;
    private static final Integer CHART_PAGE_SIZE = 5000;

    /**
     * 対象月の履歴件数を取得する。
     * @param monthStart 対象月の初日。
     * @return 対象月の件数。
     */
    @AuraEnabled
    public static Integer countMonth(Date monthStart) {
        SetupAuditTrailExplorerSelector.Criteria criteria = new SetupAuditTrailExplorerSelector.Criteria();
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
        SetupAuditTrailExplorerSelector.Criteria criteria = new SetupAuditTrailExplorerSelector.Criteria();
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
     * 対象月の履歴を用途に応じて分割取得する。
     * @param criteriaJson クライアントが指定した検索条件、用途、ページ境界。
     * @return 取得ページと続きのカーソル。
     */
    @AuraEnabled
    public static SetupAuditTrailExplorerWrapper load(String criteriaJson) {
        SetupAuditTrailExplorerSelector.Criteria criteria = readCriteria(criteriaJson);
        SetupAuditTrailExplorerService.checkCursor(criteria.nextId, criteria.nextTime);
        if (criteria.csv == true) {
            return loadDetails(criteria, CSV_PAGE_SIZE);
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
        return SetupAuditTrailExplorerService.summarizeDetails(rows, sizeLimit);
    }

    private static SetupAuditTrailExplorerWrapper loadDetails(SetupAuditTrailExplorerSelector.Criteria criteria, Integer sizeLimit) {
        List<SetupAuditTrail> rows = SetupAuditTrailExplorerSelector.selectPage(
            criteria, SetupAuditTrailExplorerSelector.Projection.DETAIL, sizeLimit + 1
        );
        return SetupAuditTrailExplorerService.summarizeDetails(rows, SetupAuditTrailExplorerService.csvPageSize(rows, sizeLimit));
    }

    private static SetupAuditTrailExplorerSelector.Criteria readCriteria(String criteriaJson) {
        SetupAuditTrailExplorerSelector.Criteria criteria = String.isBlank(criteriaJson) ? new SetupAuditTrailExplorerSelector.Criteria() :
            (SetupAuditTrailExplorerSelector.Criteria) JSON.deserialize(criteriaJson, SetupAuditTrailExplorerSelector.Criteria.class);
        setPeriod(criteria);
        return criteria;
    }

    private static void setPeriod(SetupAuditTrailExplorerSelector.Criteria criteria) {
        SetupAuditTrailExplorerService.checkPeriod(criteria.monthStart, criteria.day);
        criteria.startAt = SetupAuditTrailExplorerService.midnight(criteria.day ?? criteria.monthStart);
        Date endDay = criteria.day == null ? criteria.monthStart.addMonths(1) : criteria.day.addDays(1);
        criteria.endAt = SetupAuditTrailExplorerService.midnight(endDay);
    }
}