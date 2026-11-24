/** 検索期間を検証し、設定変更履歴を画面用に整形する。 */
public with sharing class SetupAuditTrailExplorerService {
    private static final Integer CSV_TEXT_BUDGET = 500000;

    /**
     * 指定月と日付の整合性を検証する。
     * @param monthStart 対象月の初日。
     * @param day 指定日。未指定なら月全体。
     */
    public static void checkPeriod(Date monthStart, Date day) {
        if (monthStart?.day() != 1 || (day ?? monthStart).toStartOfMonth() != monthStart) {
            throw new AuraHandledException('対象月と日付を確認してください。');
        }
    }

    /**
     * カーソルの日時とIDの組を検証する。
     * @param nextId 直前ページの境界レコードID。
     * @param nextTime 直前ページの境界日時。
     */
    public static void checkCursor(Id nextId, Datetime nextTime) {
        if ((nextId == null) != (nextTime == null)) {
            throw new AuraHandledException('ページの取得条件が不正です。');
        }
    }

    /**
     * 日付を実行ユーザーのタイムゾーンの午前0時に変換する。
     * @param day 指定日。未指定なら月全体。
     * @return 日付に対応する午前0時。
     */
    public static Datetime midnight(Date day) {
        return Datetime.newInstance(day, Time.newInstance(0, 0, 0, 0));
    }

    /** 複数回の明細照会を件数・文字数上限のあるCSVページにまとめる。 */
    public class CsvPage {
        public SetupAuditTrailExplorerWrapper result { get; private set; }
        private Integer maximum;
        @TestVisible private Integer textBudget = CSV_TEXT_BUDGET;
        private Integer textLength = 0;

        /**
         * 出力ページを空の状態で開始する。
         * @param maximum 出力可能な最大件数。
         */
        public CsvPage(Integer maximum) {
            this.maximum = maximum;
            result = new SetupAuditTrailExplorerWrapper();
        }

        /**
         * 取得順に明細を追加し、収まらない行を次の出力ページに残す。
         * @param rows 前回の照会に続く明細。
         * @return 上限を超える行がまだ見つからなければtrue。
         */
        public Boolean append(List<SetupAuditTrail> rows) {
            for (SetupAuditTrail row : rows) {
                textLength += length(row.Display) + length(row.CreatedBy?.Username) +
                    length(row.ResponsibleNamespacePrefix) + length(row.Section) + length(row.DelegateUser);
                if (result.records.size() == maximum || (textLength > textBudget && !result.records.isEmpty())) {
                    SetupAuditTrail last = result.records[result.records.size() - 1];
                    result.nextId = last.Id;
                    result.nextTime = last.CreatedDate;
                    return false;
                }
                result.records.add(row);
            }
            return true;
        }
    }

    private static Integer length(String value) {
        return value?.length() ?? 0;
    }

    /**
     * 候補の値を重複排除して返す。
     * @param rows 取得した設定変更履歴。
     * @param sizeLimit ページに含める最大件数。
     * @return 取得ページと続きのカーソル。
     */
    public static SetupAuditTrailExplorerWrapper summarizeOptions(List<SetupAuditTrail> rows, Integer sizeLimit) {
        SetupAuditTrailExplorerWrapper response = page(rows, sizeLimit);
        Set<String> actions = new Set<String>();
        Set<String> sections = new Set<String>();
        Set<String> namespaces = new Set<String>();
        Set<String> delegates = new Set<String>();
        response.userOptions = new Map<String, String>();
        response.userNames = new Map<String, String>();
        for (SetupAuditTrail row : rows) {
            collectUserOption(response, row);
            actions.add(row.Action);
            sections.add(row.Section);
            namespaces.add(row.ResponsibleNamespacePrefix);
            delegates.add(row.DelegateUser);
        }
        actions.remove(null);
        sections.remove(null);
        namespaces.remove(null);
        delegates.remove(null);
        response.options = new Map<String, List<String>>{
            'action' => new List<String>(actions),
            'section' => new List<String>(sections),
            'namespacePrefix' => new List<String>(namespaces),
            'delegateUser' => new List<String>(delegates)
        };
        return response;
    }

    // 履歴の作成者IDに対応する検索候補だけを集める。
    private static void collectUserOption(SetupAuditTrailExplorerWrapper response, SetupAuditTrail row) {
        if (row.CreatedById == null || row.CreatedBy == null) {
            return;
        }
        String userId = String.valueOf(row.CreatedById);
        if (String.isNotBlank(row.CreatedBy.Username)) {
            response.userOptions.put(userId, row.CreatedBy.Username);
        }
        if (String.isNotBlank(row.CreatedBy.Name)) {
            response.userNames.put(userId, row.CreatedBy.Name);
        }
    }

    private static SetupAuditTrailExplorerWrapper page(List<SetupAuditTrail> rows, Integer sizeLimit) {
        SetupAuditTrailExplorerWrapper response = new SetupAuditTrailExplorerWrapper();
        if (rows.size() <= sizeLimit) {
            return response;
        }
        SetupAuditTrail lastRow = rows[sizeLimit - 1];
        response.nextId = lastRow.Id;
        response.nextTime = lastRow.CreatedDate;
        for (Integer index = rows.size() - 1; index >= sizeLimit; index--) {
            rows.remove(index);
        }
        return response;
    }

    /**
     * 取得元のページ境界を確定し、選択したセクションに一致する照合行を返す。
     * @param rows 作成日時・ID降順の照合行。
     * @param sizeLimit 読み進める元ページの件数。
     * @param section 表示言語のセクション名。未指定なら全行を返す。
     * @return 一致行がなくても元ページの続きを取得できる応答。
     */
    public static SetupAuditTrailExplorerWrapper summarizeMatches(List<SetupAuditTrail> rows, Integer sizeLimit, String section) {
        SetupAuditTrailExplorerWrapper result = page(rows, sizeLimit);
        if (String.isBlank(section)) {
            result.records = rows;
            return result;
        }
        for (SetupAuditTrail row : rows) {
            if (section.equals(row.Section)) {
                result.records.add(row);
            }
        }
        return result;
    }

    /**
     * ページの明細を返す。
     * @param rows 取得した設定変更履歴。
     * @param sizeLimit ページに含める最大件数。
     * @return 取得ページと続きのカーソル。
     */
    public static SetupAuditTrailExplorerWrapper summarizeDetails(List<SetupAuditTrail> rows, Integer sizeLimit) {
        SetupAuditTrailExplorerWrapper response = page(rows, sizeLimit);
        response.records = rows;
        return response;
    }

    /**
     * ページの分析集計を返す。
     * @param rows 取得した設定変更履歴。
     * @param sizeLimit ページに含める最大件数。
     * @return 分析集計と続きのカーソル。
     */
    public static SetupAuditTrailExplorerWrapper summarizeChart(List<SetupAuditTrail> rows, Integer sizeLimit) {
        SetupAuditTrailExplorerWrapper response = page(rows, sizeLimit);
        Map<String, SetupAuditTrailExplorerWrapper.Bucket> buckets = new Map<String, SetupAuditTrailExplorerWrapper.Bucket>();
        for (SetupAuditTrail row : rows) {
            String day = String.valueOf(row.CreatedDate.date());
            String key = JSON.serialize(new List<String>{
                day, row.CreatedById, row.Action, row.Section, row.ResponsibleNamespacePrefix, row.DelegateUser
            });
            SetupAuditTrailExplorerWrapper.Bucket bucket = buckets.get(key);
            if (bucket == null) {
                bucket = new SetupAuditTrailExplorerWrapper.Bucket();
                bucket.day = day;
                bucket.userId = row.CreatedById;
                bucket.userName = row.CreatedBy?.Name;
                bucket.loginName = row.CreatedBy?.Username;
                bucket.action = row.Action;
                bucket.section = row.Section;
                bucket.namespacePrefix = row.ResponsibleNamespacePrefix;
                bucket.delegateUser = row.DelegateUser;
                bucket.count = 0;
                buckets.put(key, bucket);
            }
            bucket.count++;
        }
        response.buckets = buckets.values();
        return response;
    }
}
