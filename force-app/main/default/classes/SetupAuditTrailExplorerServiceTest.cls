@IsTest
private class SetupAuditTrailExplorerServiceTest {
    /** 従業員操作を明示した同一の作成者を一度だけ採用する。 */
    @IsTest
    static void identifiesOnlyConfirmedEmployeeActors() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            SetupAuditTrail employee = (SetupAuditTrail) JSON.deserialize(JSON.serialize(new Map<String, Object>{
                'CreatedById' => UserInfo.getUserId(), 'Display' => 'Salesforce 従業員がケースに対応'
            }), SetupAuditTrail.class);
            SetupAuditTrail other = (SetupAuditTrail) JSON.deserialize(
                '{"CreatedById":"005000000000001","Display":"別の操作"}', SetupAuditTrail.class
            );
            Test.startTest();
            List<Id> actors = SetupAuditTrailExplorerService.employeeActorIds(
                new List<SetupAuditTrail>{employee, employee, other}
            );
            Test.stopTest();
            Assert.areEqual(new List<Id>{UserInfo.getUserId()}, actors, '根拠のある作成者だけを出力に渡します。');
        }
    }

    @IsTest
    static void includesDistinctSectionOptions() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            SetupAuditTrail row = (SetupAuditTrail) JSON.deserialize('{"Section":"Apex クラス"}', SetupAuditTrail.class);
            Test.startTest();
            SetupAuditTrailExplorerWrapper result = SetupAuditTrailExplorerService.summarizeOptions(
                new List<SetupAuditTrail>{row, row, new SetupAuditTrail()}, 3
            );
            Test.stopTest();
            Assert.areEqual(new List<String>{'Apex クラス'}, result.options.get('section'), '空欄と重複を候補から除きます。');
        }
    }

    /** ログイン名が取得できない作成者も、氏名とIDを候補として返す。 */
    @IsTest
    static void keepsNamedCreatorWithoutUsername() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            String userId = String.valueOf(UserInfo.getUserId());
            SetupAuditTrail row = (SetupAuditTrail) JSON.deserialize(
                '{"CreatedById":"' + userId + '","CreatedBy":{"attributes":{"type":"User"},"Name":"監査担当"}}',
                SetupAuditTrail.class
            );
            Test.startTest();
            SetupAuditTrailExplorerWrapper result = SetupAuditTrailExplorerService.summarizeOptions(new List<SetupAuditTrail>{ row }, 1);
            Test.stopTest();
            Assert.areEqual('監査担当', result.userNames.get(userId), 'ログイン名が空でも氏名を返します。');
            Assert.isFalse(result.userOptions.containsKey(userId), '取得できないログイン名は返しません。');
        }
    }

    @IsTest
    static void rejectsInvalidDay() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            try {
                SetupAuditTrailExplorerService.checkPeriod(Date.newInstance(2026, 11, 1), Date.newInstance(2026, 12, 1));
                Assert.fail('対象月と一致しない日付を拒否する必要があります。');
            } catch (AuraHandledException error) {
                Assert.isNotNull(error, '入力エラーを返します。');
            }
        }
    }

    @IsTest
    static void rejectsIncompleteCursor() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            try {
                SetupAuditTrailExplorerService.checkCursor(null, System.now());
                Assert.fail('日時だけのページ条件を拒否する必要があります。');
            } catch (AuraHandledException error) {
                Assert.isNotNull(error, '取得条件のエラーを返します。');
            }
        }
    }

    @IsTest
    static void summarizesPageAndReturnsCursor() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            SetupAuditTrail row = (SetupAuditTrail) JSON.deserialize(
                '{"CreatedDate":"2026-11-01T00:00:00.000Z","Action":"PermSetCreate"}', SetupAuditTrail.class
            );
            List<SetupAuditTrail> rows = new List<SetupAuditTrail>{row, row, row};
            SetupAuditTrailExplorerService.checkCursor(null, null);
            Test.startTest();
            Datetime midnight = SetupAuditTrailExplorerService.midnight(Date.newInstance(2026, 11, 1));
            SetupAuditTrailExplorerWrapper result = SetupAuditTrailExplorerService.summarizeChart(rows, 2);
            SetupAuditTrailExplorerWrapper detail = SetupAuditTrailExplorerService.summarizeDetails(rows, 3);
            Test.stopTest();
            Assert.isNotNull(midnight, '日付を検索境界に変換します。');
            Assert.areEqual(row.CreatedDate, result.nextTime, '次のページの境界を返します。');
            Assert.areEqual(1, result.buckets.size(), '同じ操作を一つに集計します。');
            Assert.areEqual(2, result.buckets[0].count, '次ページの行を集計から除きます。');
            Assert.areEqual(2, detail.records.size(), '一覧用の明細を返します。');
        }
    }

    @IsTest
    static void keepsSourceCursorAcrossEmptySectionPage() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            SetupAuditTrail other = (SetupAuditTrail) JSON.deserialize(
                '{"Id":"0Ym000000000001","CreatedDate":"2026-11-01T00:00:00.000Z","Section":"Apps"}', SetupAuditTrail.class
            );
            SetupAuditTrail match = (SetupAuditTrail) JSON.deserialize('{"Id":"0Ym000000000002","Section":"Apex"}', SetupAuditTrail.class);
            Test.startTest();
            SetupAuditTrailExplorerWrapper first = SetupAuditTrailExplorerService.summarizeMatches(new List<SetupAuditTrail>{other, match}, 1, 'Apex');
            SetupAuditTrailExplorerWrapper last = SetupAuditTrailExplorerService.summarizeMatches(new List<SetupAuditTrail>{match}, 1, 'Apex');
            Test.stopTest();
            Assert.isTrue(first.records.isEmpty(), '一致しない行と先読み行を送信しません。');
            Assert.areEqual(other.Id, first.nextId, '取得元のページ境界から再開します。');
            Assert.areEqual(other.CreatedDate, first.nextTime, '境界日時を保持します。');
            Assert.areEqual(new List<SetupAuditTrail>{match}, last.records, '次のページで一致行を取得します。');
            Assert.isNull(last.nextId, '最終ページに続きはありません。');
        }
    }

    /** 文字数上限ちょうどの行を含め、その行の日時とIDを次ページの境界に使う */
    @IsTest
    static void capsCsvPagesWithoutDroppingTheNextCursor() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            List<SetupAuditTrail> rows = (List<SetupAuditTrail>) JSON.deserialize(
                '[{"Id":"0Ym000000000003","CreatedDate":"2026-11-01T00:02:00.000Z","Display":"変更"},' +
                '{"Id":"0Ym000000000002","CreatedDate":"2026-11-01T00:01:00.000Z","Section":"設定"},' +
                '{"Id":"0Ym000000000001","CreatedDate":"2026-11-01T00:00:00.000Z","Display":"次"}]',
                List<SetupAuditTrail>.class
            );
            SetupAuditTrail boundary = rows[1];
            rows.add(new SetupAuditTrail());
            Iterator<SObject> cursor = rows.iterator();

            Test.startTest();
            SetupAuditTrailExplorerWrapper result = SetupAuditTrailExplorerService.collectCsvPage(cursor, 3, 4);
            SetupAuditTrailExplorerWrapper oversized = SetupAuditTrailExplorerService.collectCsvPage(rows.iterator(), 3, 1);
            SetupAuditTrailExplorerWrapper counted = SetupAuditTrailExplorerService.summarizeCsv(rows.iterator(), 2);
            Test.stopTest();

            Assert.areEqual(1, oversized.records.size(), '先頭行だけで文字数を超えた場合も出力を進めます。');
            Assert.areEqual(rows[0].Id, oversized.nextId, '超過した先頭行の次から再開します。');
            Assert.areEqual(2, counted.records.size(), '文字数に余裕があっても件数上限で区切ります。');
            Assert.areEqual(boundary.Id, counted.nextId, '件数で区切った場合も次の行を失いません。');
            Assert.isTrue(cursor.hasNext(), '文字数上限を超えた後の行は読み取りません。');
            Assert.areEqual(2, result.records.size(), '4文字に収まる2行までを返します。');
            Assert.areEqual(boundary.Id, result.nextId, '最後に出力した行のIDから再開します。');
            Assert.areEqual(boundary.CreatedDate, result.nextTime, '最後に出力した行の日時から再開します。');
        }
    }

    @IsTest
    static void permitsFullCsvPageWhenBelowBudget() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            List<SObject> rows = new List<SObject>{new SetupAuditTrail(), new SetupAuditTrail()};
            SetupAuditTrailExplorerWrapper page = SetupAuditTrailExplorerService.summarizeCsv(rows.iterator(), 2);
            Assert.areEqual(2, page.records.size(), '件数上限ちょうどの全行を出力します。');
            Assert.isNull(page.nextTime, '続きがなければカーソルを返しません。');
        }
    }
}
