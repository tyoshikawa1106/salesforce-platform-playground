/** 設定変更履歴の一覧とグラフの取得を受け付ける。 */
public with sharing class SetupAuditTrailExplorerController {
    private static final Integer CSV_PAGE_SIZE = 2000;
    private static final Integer CHART_PAGE_SIZE = 5000;

    @AuraEnabled
    public static Integer countMonth(Date monthStart) {
        SetupAuditTrailExplorerService.checkPeriod(monthStart, null);
        Datetime startAt = SetupAuditTrailExplorerService.midnight(monthStart);
        Datetime endAt = SetupAuditTrailExplorerService.midnight(monthStart.addMonths(1));
        Integer total = SetupAuditTrailExplorerSelector.countMonth(startAt, endAt);
        return total;
    }

    /** 旧画面が再読み込みされるまで、従来の候補応答を返す。 */
    @AuraEnabled
    public static SetupAuditTrailExplorerWrapper loadFilterOptions(Date monthStart, Id nextId, Datetime nextTime) {
        return load(monthStart, null, null, null, null, null, nextId, nextTime, true, false, null);
    }

    /** 対象月の候補だけを同じカーソル順で分割取得する。 */
    @AuraEnabled
    public static SetupAuditTrailExplorerWrapper loadDistinctFilterOptions(Date monthStart, Id nextId, Datetime nextTime) {
        SetupAuditTrailExplorerService.checkPeriod(monthStart, null);
        SetupAuditTrailExplorerService.checkCursor(nextId, nextTime);
        Datetime startAt = SetupAuditTrailExplorerService.midnight(monthStart);
        Datetime endAt = SetupAuditTrailExplorerService.midnight(monthStart.addMonths(1));
        List<SetupAuditTrail> rows = SetupAuditTrailExplorerSelector.selectOptionPage(
            startAt, endAt, nextId, nextTime, CHART_PAGE_SIZE + 1
        );
        return SetupAuditTrailExplorerService.summarizeOptions(rows, CHART_PAGE_SIZE);
    }

    @AuraEnabled
    public static Integer countMatches(Date monthStart, Date day, Id userId, String action, String namespacePrefix, String delegateUser) {
        SetupAuditTrailExplorerService.checkPeriod(monthStart, day);
        Datetime startAt = SetupAuditTrailExplorerService.midnight(day ?? monthStart);
        Datetime endAt = SetupAuditTrailExplorerService.midnight(day == null ? monthStart.addMonths(1) : day.addDays(1));
        Integer total = SetupAuditTrailExplorerSelector.countMatches(startAt, endAt, userId, action, namespacePrefix, delegateUser);
        return total;
    }

    @AuraEnabled
    public static List<SetupAuditTrail> loadTail(
        Date monthStart, Date day, Id userId, String action, String namespacePrefix, String delegateUser, Id nextId, Datetime nextTime, Integer pageSize
    ) {
        SetupAuditTrailExplorerService.checkPeriod(monthStart, day);
        SetupAuditTrailExplorerService.checkCursor(nextId, nextTime);
        Datetime startAt = SetupAuditTrailExplorerService.midnight(day ?? monthStart);
        Datetime endAt = SetupAuditTrailExplorerService.midnight(day == null ? monthStart.addMonths(1) : day.addDays(1));
        Integer sizeLimit = Math.max(1, Math.min(50, pageSize ?? 50));
        List<SetupAuditTrail> rows = SetupAuditTrailExplorerSelector.selectTail(
            startAt, endAt, userId, action, namespacePrefix, delegateUser, nextId, nextTime, sizeLimit
        );
        return rows;
    }

    /** 組織に保持されている全期間の履歴をCSV用に分割取得する。 */
    @AuraEnabled
    public static SetupAuditTrailExplorerWrapper exportAllHistory(Datetime cutoff, Id nextId, Datetime nextTime) {
        SetupAuditTrailExplorerService.checkCursor(nextId, nextTime);
        Datetime endAt = cutoff ?? System.now();
        List<SetupAuditTrail> rows = SetupAuditTrailExplorerSelector.selectPage(
            null, endAt, null, null, null, null, nextId, nextTime, false, CSV_PAGE_SIZE + 1
        );
        Integer sizeLimit = SetupAuditTrailExplorerService.csvPageSize(rows, CSV_PAGE_SIZE);
        return SetupAuditTrailExplorerService.summarize(rows, false, sizeLimit);
    }

    @AuraEnabled
    public static SetupAuditTrailExplorerWrapper load(
        Date monthStart, Date day, Id userId, String action, String namespacePrefix, String delegateUser, Id nextId, Datetime nextTime, Boolean chart, Boolean csv, Integer pageSize
    ) {
        SetupAuditTrailExplorerService.checkPeriod(monthStart, day);
        SetupAuditTrailExplorerService.checkCursor(nextId, nextTime);
        Date firstDay = day == null ? monthStart : day;
        Date endDay = day == null ? monthStart.addMonths(1) : day.addDays(1);
        Datetime startAt = SetupAuditTrailExplorerService.midnight(firstDay);
        Datetime endAt = SetupAuditTrailExplorerService.midnight(endDay);
        Boolean isChart = chart == true && csv != true;
        Integer sizeLimit = isChart ? CHART_PAGE_SIZE : (csv == true ? CSV_PAGE_SIZE : Math.max(1, Math.min(2000, pageSize ?? 50)));
        List<SetupAuditTrail> rows = SetupAuditTrailExplorerSelector.selectPage(
            startAt, endAt, userId, action, namespacePrefix, delegateUser, nextId, nextTime, isChart, sizeLimit + 1
        );
        if (csv == true) {
            sizeLimit = SetupAuditTrailExplorerService.csvPageSize(rows, sizeLimit);
        }
        SetupAuditTrailExplorerWrapper response = SetupAuditTrailExplorerService.summarize(rows, isChart, sizeLimit);
        return response;
    }
}
