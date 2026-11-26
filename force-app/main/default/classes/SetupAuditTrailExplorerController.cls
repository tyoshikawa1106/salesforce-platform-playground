/** 設定変更履歴の一覧とグラフの取得を受け付ける。 */
public with sharing class SetupAuditTrailExplorerController {
    private static final Integer CSV_PAGE_SIZE = 2000;
    private static final Integer CHART_PAGE_SIZE = 5000;

    /** 月内の検索期間と応答形式を受け取り、Selectorには確定した期間を渡す。 */
    @TestVisible
    private class MonthRequest extends SetupAuditTrailExplorerSelector.Criteria {
        public Date monthStart;
        public Date day;
        public Datetime cutoff;
        public String section;
        public Boolean matchIndex;
        public Boolean chart;
        public Boolean includeDelegateNames;
        public Boolean csv;
        public Integer pageSize;
    }

    /**
     * 一覧とCSVに出す項目の表示ラベルを取得する。
     * @return 実行ユーザーの言語で取得した項目API名とラベルの対応。
     */
    @AuraEnabled(cacheable=true)
    public static Map<String, String> getColumnLabels() {
        requireCurrentUserAccess();
        Map<String, String> labels = new Map<String, String>();
        for (Schema.SObjectField field : new List<Schema.SObjectField>{
            SetupAuditTrail.CreatedDate, User.Username, SetupAuditTrail.ResponsibleNamespacePrefix,
            SetupAuditTrail.Action, SetupAuditTrail.Display, SetupAuditTrail.Section, SetupAuditTrail.DelegateUser
        }) {
            Schema.DescribeFieldResult definition = field.getDescribe();
            labels.put(definition.getName(), definition.getLabel());
        }
        return labels;
    }

    /**
     * 一覧・分析の検索範囲を同じ組織時刻で固定する。
     * @return 検索に含める履歴の作成日時の上限（この日時を含まない）。
     */
    @AuraEnabled
    public static Datetime startSearch() {
        requireCurrentUserAccess();
        return System.now();
    }

    /**
     * 対象月の履歴件数を取得する。
     * @param monthStart 対象月の初日。
     * @return 対象月の件数。
     */
    @AuraEnabled
    public static Integer countMonth(Date monthStart) {
        requireCurrentUserAccess();
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
        requireCurrentUserAccess();
        MonthRequest criteria = new MonthRequest();
        criteria.monthStart = monthStart;
        criteria.nextId = nextId;
        criteria.nextTime = nextTime;
        setPeriod(criteria);
        return loadFilterOptions(criteria);
    }

    /**
     * 検索開始時点の候補をカーソル順に取得する。
     * @param criteriaJson 表示月の初日、検索開始時刻、続きの日時とIDを含む検索条件
     * @return 表示月の候補と続きの境界
     */
    @AuraEnabled
    public static SetupAuditTrailExplorerWrapper loadOptionsAt(String criteriaJson) {
        requireCurrentUserAccess();
        return loadFilterOptions(readCriteria(criteriaJson));
    }

    private static SetupAuditTrailExplorerWrapper loadFilterOptions(MonthRequest criteria) {
        SetupAuditTrailExplorerService.checkCursor(criteria.nextId, criteria.nextTime);
        List<SetupAuditTrail> rows = readSourcePage(
            criteria, SetupAuditTrailExplorerSelector.Projection.OPTIONS, CHART_PAGE_SIZE + 1
        );
        SetupAuditTrailExplorerWrapper wrapper = SetupAuditTrailExplorerService.summarizeOptions(rows, CHART_PAGE_SIZE);
        wrapper.delegateNames = SetupAuditTrailExplorerSelector.selectDelegateNames(new Set<String>(wrapper.options.get('delegateUser')));
        return wrapper;
    }

    /**
     * 条件に一致する履歴件数を取得する。
     * @param criteriaJson クライアントが指定した検索条件。
     * @return 条件に一致する件数。
     */
    @AuraEnabled
    public static Integer countMatches(String criteriaJson) {
        requireCurrentUserAccess();
        return SetupAuditTrailExplorerSelector.countMatches(readCriteria(criteriaJson));
    }

    /**
     * 実行ユーザーが参照できる全履歴を分割取得する。
     * @param cutoff 初回は未指定。続きは最初の応答で返した取得上限。
     * @param nextId 直前ページの境界レコードID。
     * @param nextTime 直前ページの境界日時。
     * @return 取得ページと続きのカーソル。
     */
    @AuraEnabled
    public static SetupAuditTrailExplorerWrapper exportAllHistory(Datetime cutoff, Id nextId, Datetime nextTime) {
        requireCurrentUserAccess();
        SetupAuditTrailExplorerService.checkCursor(nextId, nextTime);
        SetupAuditTrailExplorerSelector.Criteria criteria = new SetupAuditTrailExplorerSelector.Criteria();
        criteria.endAt = cutoff ?? System.now();
        criteria.nextId = nextId;
        criteria.nextTime = nextTime;
        return loadDetails(criteria, CSV_PAGE_SIZE, criteria.endAt);
    }

    /**
     * 対象月の履歴を用途に応じて分割取得する。
     * @param criteriaJson クライアントが指定した検索条件、用途、ページ境界。
     * @return 取得ページと続きのカーソル。
     */
    @AuraEnabled
    public static SetupAuditTrailExplorerWrapper load(String criteriaJson) {
        requireCurrentUserAccess();
        MonthRequest criteria = readCriteria(criteriaJson);
        SetupAuditTrailExplorerService.checkCursor(criteria.nextId, criteria.nextTime);
        if (criteria.csv == true) {
            return loadDetails(criteria, CSV_PAGE_SIZE, criteria.cutoff);
        }
        if (criteria.matchIndex == true) {
            List<SetupAuditTrail> matches = readSourcePage(
                criteria, SetupAuditTrailExplorerSelector.Projection.MATCH_INDEX, CHART_PAGE_SIZE + 1
            );
            return SetupAuditTrailExplorerService.summarizeMatches(matches, CHART_PAGE_SIZE, criteria.section);
        }
        if (criteria.chart == true) {
            List<SetupAuditTrail> rows = readSourcePage(
                criteria, SetupAuditTrailExplorerSelector.Projection.CHART, CHART_PAGE_SIZE + 1
            );
            SetupAuditTrailExplorerWrapper chart = SetupAuditTrailExplorerService.summarizeChart(rows, CHART_PAGE_SIZE);
            // 旧クライアントでは従来どおり氏名を返す。
            if (criteria.includeDelegateNames != false) {
                chart.delegateNames = delegateNamesFor(rows);
            }
            return chart;
        }
        Integer sizeLimit = Math.max(1, Math.min(2000, criteria.pageSize ?? 50));
        List<SetupAuditTrail> rows = SetupAuditTrailExplorerSelector.selectPage(
            criteria, SetupAuditTrailExplorerSelector.Projection.DETAIL, sizeLimit + 1
        );
        return SetupAuditTrailExplorerService.summarizeDetails(rows, sizeLimit);
    }

    // 先読みで存在を確認した元行を検証してから、集計やセクション絞り込みで応答を縮小する。
    private static List<SetupAuditTrail> readSourcePage(
        SetupAuditTrailExplorerSelector.Criteria criteria, SetupAuditTrailExplorerSelector.Projection projection, Integer sizeLimit
    ) {
        List<SetupAuditTrail> rows = SetupAuditTrailExplorerSelector.selectPage(criteria, projection, sizeLimit);
        if (criteria.nextId != null && rows.isEmpty()) {
            throw new AuraHandledException('続きの履歴を取得できませんでした。もう一度取得してください。');
        }
        return rows;
    }

    private static Map<String, String> delegateNamesFor(List<SetupAuditTrail> rows) {
        Set<String> delegates = new Set<String>();
        for (SetupAuditTrail row : rows) {
            if (String.isNotBlank(row.DelegateUser)) {
                delegates.add(row.DelegateUser);
            }
        }
        return SetupAuditTrailExplorerSelector.selectDelegateNames(delegates);
    }

    private static SetupAuditTrailExplorerWrapper loadDetails(SetupAuditTrailExplorerSelector.Criteria criteria, Integer sizeLimit, Datetime exportCutoff) {
        SetupAuditTrailExplorerService.CsvPage page = new SetupAuditTrailExplorerService.CsvPage(sizeLimit);
        // 一覧と同じ照会で原文を取得し、大きな本文を一括でヒープに載せない。
        while (true) {
            Integer batchSize = Math.min(200, sizeLimit - page.result.records.size() + 1);
            List<SetupAuditTrail> batch = SetupAuditTrailExplorerSelector.selectPage(
                criteria, SetupAuditTrailExplorerSelector.Projection.DETAIL, batchSize
            );
            if (!page.append(batch) || batch.size() < batchSize) {
                break;
            }
            SetupAuditTrail last = batch[batch.size() - 1];
            criteria.nextTime = last.CreatedDate;
            criteria.nextId = last.Id;
        }
        SetupAuditTrailExplorerWrapper wrapper = page.result;
        wrapper.cutoff = exportCutoff;
        return wrapper;
    }

    /** すべての画面要求で、入力検証や履歴取得に先立って閲覧可否を確定 */
    private static void requireCurrentUserAccess() {
        SetupAuditTrailExplorerService.requireAccess(SetupAuditTrailExplorerSelector.getPermissions());
    }

    @TestVisible
    private static MonthRequest readCriteria(String criteriaJson) {
        MonthRequest criteria;
        try {
            criteria = String.isBlank(criteriaJson) ? null : (MonthRequest) JSON.deserialize(criteriaJson, MonthRequest.class);
        } catch (JSONException invalidJson) {
            throw new AuraHandledException('検索条件の形式を確認してください。');
        }
        if (criteria == null) {
            throw new AuraHandledException('検索条件を指定してください。');
        }
        if (criteria.csv == true) {
            // 後続ページも同じ取得開始時刻に固定する。
            criteria.cutoff = criteria.cutoff ?? System.now();
        }
        setPeriod(criteria);
        return criteria;
    }

    private static void setPeriod(MonthRequest criteria) {
        SetupAuditTrailExplorerService.checkPeriod(criteria.monthStart, criteria.day);
        criteria.startAt = SetupAuditTrailExplorerService.midnight(criteria.day ?? criteria.monthStart);
        Date endDay = criteria.day == null ? criteria.monthStart.addMonths(1) : criteria.day.addDays(1);
        Datetime periodEnd = SetupAuditTrailExplorerService.midnight(endDay);
        criteria.endAt = criteria.cutoff != null && criteria.cutoff < periodEnd ? criteria.cutoff : periodEnd;
    }
}