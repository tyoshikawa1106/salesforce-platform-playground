/** 検索期間を検証し、設定変更履歴を画面用に整形する。 */
public with sharing class SetupAuditTrailExplorerService {
    private static final Integer CSV_TEXT_BUDGET = 500000;

    /**
     * 履歴の本文がSalesforce従業員の操作と明示する作成者だけを採用する。
     * @param rows 内部操作の履歴。
     * @return CSVで会社名を表示できる作成者ID。
     */
    public static List<Id> employeeActorIds(List<SetupAuditTrail> rows) {
        Set<Id> actors = new Set<Id>();
        for (SetupAuditTrail row : rows) {
            if (row.Display?.startsWith('Salesforce 従業員が') == true) {
                actors.add(row.CreatedById);
            }
        }
        actors.remove(null);
        return new List<Id>(actors);
    }

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

    /**
     * 件数・文字数の上限に収まるCSV明細と次ページの境界を取得
     * @param rows 作成日時・ID降順の履歴
     * @param maximum ページの件数上限
     * @return 出力する行と、続きがある場合は最後に出力する行のカーソル
     */
    public static SetupAuditTrailExplorerWrapper summarizeCsv(Iterator<SObject> rows, Integer maximum) {
        // 本文が長い履歴も一定の文字数に分割
        return collectCsvPage(rows, maximum, CSV_TEXT_BUDGET);
    }

    /**
     * 少数の履歴で文字数境界を検証できるよう上限を指定してCSVページを構築
     * @param rows 出力順の履歴
     * @param maximum 件数の上限
     * @param textBudget 文字数の上限
     * @return 出力対象の明細と次ページの境界
     */
    @TestVisible
    private static SetupAuditTrailExplorerWrapper collectCsvPage(Iterator<SObject> rows, Integer maximum, Integer textBudget) {
        // 出力対象に決まった行だけを保持
        SetupAuditTrailExplorerWrapper result = new SetupAuditTrailExplorerWrapper();
        // 現在のページに含める文字数を累積
        Integer textLength = 0;
        // 続きの有無と文字数を確定できる行まで読み取り
        while (rows.hasNext()) {
            // 一度に1行の項目を評価
            SetupAuditTrail row = (SetupAuditTrail) rows.next();
            // CSVに使用する可変長項目を合算
            textLength += length(row.Display) + length(row.CreatedBy?.Username) +
                length(row.ResponsibleNamespacePrefix) + length(row.Section) + length(row.DelegateUser);
            // 先頭行だけで文字数を超えても必ず次へ進めるようにする
            if (result.records.size() == maximum || (textLength > textBudget && !result.records.isEmpty())) {
                // 今回の出力に含まれる最後の行から次のページを再開
                SetupAuditTrail boundary = result.records[result.records.size() - 1];
                // 同一作成日時の境界を識別
                result.nextId = boundary.Id;
                // 次のページで未出力の行を取得するため日時を保存
                result.nextTime = boundary.CreatedDate;
                // 残りの明細は後続ページで読み取り
                break;
            }
            // 上限内の行または最初の1行を出力対象に追加
            result.records.add(row);
        }
        // 最終ページはカーソルを空のまま返却
        return result;
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

    // 代理ログインは後段の照合へ渡し、それ以外の履歴から検索できるユーザーを集める。
    private static void collectUserOption(SetupAuditTrailExplorerWrapper response, SetupAuditTrail row) {
        if (row.Action == 'suOrgAdminLogin') {
            response.records.add(row);
            return;
        }
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
            // 代理ログインだけは照合後のユーザーで画面側の同じ集計に加える。
            if (row.Action == 'suOrgAdminLogin') {
                response.records.add(row);
                continue;
            }
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
                bucket.userType = row.CreatedBy?.UserType;
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
