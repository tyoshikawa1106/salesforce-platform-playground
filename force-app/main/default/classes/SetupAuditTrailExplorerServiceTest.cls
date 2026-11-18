@IsTest
private class SetupAuditTrailExplorerServiceTest {
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
    static void capsCsvPagesWithoutDroppingTheNextCursor() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            SetupAuditTrail row = (SetupAuditTrail) JSON.deserialize(
                '{"Id":"0Ym000000000001","CreatedDate":"2026-11-01T00:00:00.000Z","Display":"' +
                    '変更'.repeat(500) + '"}', SetupAuditTrail.class
            );
            List<SetupAuditTrail> rows = new List<SetupAuditTrail>();
            for (Integer index = 0; index < 503; index++) {
                rows.add(row);
            }

            Integer pageSize = SetupAuditTrailExplorerService.csvPageSize(rows, 2000);
            SetupAuditTrailExplorerWrapper result = SetupAuditTrailExplorerService.summarizeDetails(rows, pageSize);

            Assert.areEqual(500, result.records.size(), '文字量の上限でページを区切ります。');
            Assert.areEqual(row.Id, result.nextId, '続きの取得条件を返します。');
        }
    }

    @IsTest
    static void permitsFullCsvPageWhenBelowBudget() {
        System.runAs(new User(Id = UserInfo.getUserId())) {
            Integer pageSize = SetupAuditTrailExplorerService.csvPageSize(new List<SetupAuditTrail>(), 2000);
            Assert.areEqual(2000, pageSize, '文字量が少ない場合は既定のページ上限を維持します。');
        }
    }
}