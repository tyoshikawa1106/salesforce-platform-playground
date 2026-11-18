/** 検索期間を検証し、設定変更履歴を画面用に整形する。 */
public with sharing class SetupAuditTrailExplorerService {
    private static final Integer CSV_TEXT_BUDGET = 500000;

    public static void checkPeriod(Date monthStart, Date day) {
        if (monthStart == null || monthStart.day() != 1 ||
            (day != null && day.toStartOfMonth() != monthStart)) {
            throw new AuraHandledException('対象月と日付を確認してください。');
        }
    }

    /** 続きのページを指定するときは日時とIDを一緒に受け取る。 */
    public static void checkCursor(Id nextId, Datetime nextTime) {
        if ((nextId == null) != (nextTime == null)) {
            throw new AuraHandledException('ページの取得条件が不正です。');
        }
    }

    public static Datetime midnight(Date day) {
        return Datetime.newInstance(day, Time.newInstance(0, 0, 0, 0));
    }

    /** 文字数によって返却するCSV明細の件数を抑える。 */
    public static Integer csvPageSize(List<SetupAuditTrail> rows, Integer maximum) {
        Integer textLength = 0;
        Integer available = Math.min(rows.size(), maximum);
        for (Integer index = 0; index < available; index++) {
            SetupAuditTrail row = rows[index];
            textLength += length(row.Display) + length(row.CreatedBy?.Username) +
                length(row.ResponsibleNamespacePrefix) + length(row.Section) + length(row.DelegateUser);
            if (textLength > CSV_TEXT_BUDGET) {
                return Math.max(1, index);
            }
        }
        return maximum;
    }

    private static Integer length(String value) {
        return value == null ? 0 : value.length();
    }

    /** 候補の値だけをページ内で重複排除し、次ページの位置と一緒に返す。 */
    public static SetupAuditTrailExplorerWrapper summarizeOptions(List<SetupAuditTrail> rows, Integer sizeLimit) {
        SetupAuditTrailExplorerWrapper response = page(rows, sizeLimit);
        Set<String> actions = new Set<String>();
        Set<String> namespaces = new Set<String>();
        Set<String> delegates = new Set<String>();
        response.userOptions = new Map<String, String>();
        response.userNames = new Map<String, String>();
        for (SetupAuditTrail row : rows) {
            if (row.CreatedById != null && String.isNotBlank(row.CreatedBy?.Username)) {
                String userId = String.valueOf(row.CreatedById);
                response.userOptions.put(userId, row.CreatedBy.Username);
                if (String.isNotBlank(row.CreatedBy.Name)) {
                    response.userNames.put(userId, row.CreatedBy.Name);
                }
            }
            actions.add(row.Action);
            namespaces.add(row.ResponsibleNamespacePrefix);
            delegates.add(row.DelegateUser);
        }
        actions.remove(null);
        namespaces.remove(null);
        delegates.remove(null);
        response.options = new Map<String, List<String>>{
            'action' => new List<String>(actions),
            'namespacePrefix' => new List<String>(namespaces),
            'delegateUser' => new List<String>(delegates)
        };
        return response;
    }

    private static SetupAuditTrailExplorerWrapper page(List<SetupAuditTrail> rows, Integer sizeLimit) {
        SetupAuditTrailExplorerWrapper response = new SetupAuditTrailExplorerWrapper();
        if (rows.size() > sizeLimit) {
            SetupAuditTrail lastRow = rows[sizeLimit - 1];
            response.nextId = lastRow.Id;
            response.nextTime = lastRow.CreatedDate;
            for (Integer index = rows.size() - 1; index >= sizeLimit; index--) {
                rows.remove(index);
            }
        }
        return response;
    }

    public static SetupAuditTrailExplorerWrapper summarize(List<SetupAuditTrail> rows, Boolean chart, Integer sizeLimit) {
        SetupAuditTrailExplorerWrapper response = page(rows, sizeLimit);
        if (!chart) {
            response.records = rows;
            return response;
        }
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