@IsTest
private class SetupAuditTrailExplorerServiceTest {
    private static User testUser = new User(Id = UserInfo.getUserId());

    @IsTest
    static void includesDistinctSectionOptions() {
        System.runAs(testUser) {
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
        System.runAs(testUser) {
            String userId = String.valueOf(UserInfo.getUserId());
            SetupAuditTrail row = (SetupAuditTrail) JSON.deserialize(
                '{"Action":"suOrgAdminLogin","CreatedById":"' + userId + '","CreatedBy":{"attributes":{"type":"User"},"Name":"監査担当"}}',
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
        System.runAs(testUser) {
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
        System.runAs(testUser) {
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
        System.runAs(testUser) {
            SetupAuditTrail row = (SetupAuditTrail) JSON.deserialize(
                '{"CreatedDate":"2026-11-01T00:00:00.000Z","Action":"suOrgAdminLogin","CreatedById":"005000000000001"}', SetupAuditTrail.class
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
        System.runAs(testUser) {
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
        System.runAs(testUser) {
            List<SetupAuditTrail> rows = (List<SetupAuditTrail>) JSON.deserialize(
                '[{"Id":"0Ym000000000003","CreatedDate":"2026-11-01T00:02:00.000Z","Display":"変更"},' +
                '{"Id":"0Ym000000000002","CreatedDate":"2026-11-01T00:01:00.000Z","Section":"設定"},' +
                '{"Id":"0Ym000000000001","CreatedDate":"2026-11-01T00:00:00.000Z","Display":"次"}]',
                List<SetupAuditTrail>.class
            );
            SetupAuditTrail boundary = rows[1];
            SetupAuditTrailExplorerService.CsvPage textPage = new SetupAuditTrailExplorerService.CsvPage(3);
            textPage.textBudget = 4;
            SetupAuditTrailExplorerService.CsvPage smallPage = new SetupAuditTrailExplorerService.CsvPage(3);
            smallPage.textBudget = 1;
            SetupAuditTrailExplorerService.CsvPage countPage = new SetupAuditTrailExplorerService.CsvPage(2);

            Test.startTest();
            Assert.isTrue(textPage.append(new List<SetupAuditTrail>{rows[0]}));
            Assert.isFalse(textPage.append(new List<SetupAuditTrail>{rows[1], rows[2]}));
            Assert.isFalse(smallPage.append(rows));
            Assert.isFalse(countPage.append(rows));
            Test.stopTest();

            SetupAuditTrailExplorerWrapper result = textPage.result;
            SetupAuditTrailExplorerWrapper oversized = smallPage.result;
            SetupAuditTrailExplorerWrapper counted = countPage.result;
            Assert.areEqual(1, oversized.records.size(), '先頭行だけで文字数を超えた場合も出力を進めます。');
            Assert.areEqual(rows[0].Id, oversized.nextId, '超過した先頭行の次から再開します。');
            Assert.areEqual(2, counted.records.size(), '文字数に余裕があっても件数上限で区切ります。');
            Assert.areEqual(boundary.Id, counted.nextId, '件数で区切った場合も次の行を失いません。');
            Assert.areEqual(2, result.records.size(), '4文字に収まる2行までを返します。');
            Assert.areEqual(boundary.Id, result.nextId, '最後に出力した行のIDから再開します。');
            Assert.areEqual(boundary.CreatedDate, result.nextTime, '最後に出力した行の日時から再開します。');
        }
    }

    @IsTest
    static void permitsFullCsvPageWhenBelowBudget() {
        System.runAs(testUser) {
            List<SetupAuditTrail> rows = new List<SetupAuditTrail>{new SetupAuditTrail(), new SetupAuditTrail()};
            SetupAuditTrailExplorerService.CsvPage complete = new SetupAuditTrailExplorerService.CsvPage(2);
            Assert.isTrue(complete.append(rows));
            SetupAuditTrailExplorerWrapper page = complete.result;
            Assert.areEqual(2, page.records.size(), '件数上限ちょうどの全行を出力します。');
            Assert.isNull(page.nextTime, '続きがなければカーソルを返しません。');
        }
    }
}
