/**
 * DateTimeUtil テスト
 */
@IsTest
private with sharing class DateTimeUtilTest {

    private static User testUser = TestDataFactory.getTestUser();

    /**
     * インスタンス化を拒否
     */
    @IsTest
    static void shouldThrowWhenInstantiated() {
        System.runAs(testUser) {
            Test.startTest();

            try {
                new DateTimeUtil();
                Assert.fail('DateTimeUtil のインスタンス化では例外が必要');
            } catch (IllegalArgumentException e) {
                Assert.isTrue(e.getMessage().contains('DateTimeUtil'), '例外メッセージで対象クラスを識別できる必要あり');
            }

            Test.stopTest();
        }
    }

    /**
     * ハイフン区切りの日付文字列を変換
     */
    @IsTest
    static void shouldParseDateWhenHyphenSeparated() {
        Date actualDate;

        System.runAs(testUser) {
            Test.startTest();

            actualDate = DateTimeUtil.parseDate('2024-02-29');

            Test.stopTest();
        }

        Assert.areEqual(Date.newInstance(2024, 2, 29), actualDate, '閏日を Date へ変換する必要あり');
    }

    /**
     * スラッシュ区切りの日付文字列を変換
     */
    @IsTest
    static void shouldParseDateWhenSlashSeparated() {
        Date actualDate;

        System.runAs(testUser) {
            Test.startTest();

            actualDate = DateTimeUtil.parseDate('2026/08/24');

            Test.stopTest();
        }

        Assert.areEqual(Date.newInstance(2026, 8, 24), actualDate, 'スラッシュ区切りの日付を変換する必要あり');
    }

    /**
     * null の日付文字列は null を返却
     */
    @IsTest
    static void shouldReturnNullWhenDateIsNull() {
        Date actualDate;

        System.runAs(testUser) {
            Test.startTest();

            actualDate = DateTimeUtil.parseDate(null);

            Test.stopTest();
        }

        Assert.isNull(actualDate, 'null は日付へ変換しない必要あり');
    }

    /**
     * 空白の日付文字列は null を返却
     */
    @IsTest
    static void shouldReturnNullWhenDateIsBlank() {
        Date actualDate;

        System.runAs(testUser) {
            Test.startTest();

            actualDate = DateTimeUtil.parseDate('   ');

            Test.stopTest();
        }

        Assert.isNull(actualDate, '空白は日付へ変換しない必要あり');
    }

    /**
     * 存在しない日付文字列は不正と判定
     */
    @IsTest
    static void shouldReturnFalseWhenDateIsInvalid() {
        Boolean isValid;

        System.runAs(testUser) {
            Test.startTest();

            isValid = DateTimeUtil.isValidDate('2025-02-29');

            Test.stopTest();
        }

        Assert.isFalse(isValid, '存在しない日付を有効と判定しない必要あり');
    }

    /**
     * 平日は週末ではないと判定
     */
    @IsTest
    static void shouldReturnFalseWhenDateIsWeekday() {
        Boolean isWeekend;

        System.runAs(testUser) {
            Test.startTest();

            isWeekend = DateTimeUtil.isWeekend(Date.newInstance(2026, 8, 24));

            Test.stopTest();
        }

        Assert.isFalse(isWeekend, '月曜日を週末と判定しない必要あり');
    }

    /**
     * 土曜日は週末と判定
     */
    @IsTest
    static void shouldReturnTrueWhenDateIsSaturday() {
        Boolean isWeekend;

        System.runAs(testUser) {
            Test.startTest();

            isWeekend = DateTimeUtil.isWeekend(Date.newInstance(2026, 8, 22));

            Test.stopTest();
        }

        Assert.isTrue(isWeekend, '土曜日を週末と判定する必要あり');
    }

    /**
     * 日曜日は週末と判定
     */
    @IsTest
    static void shouldReturnTrueWhenDateIsSunday() {
        Boolean isWeekend;

        System.runAs(testUser) {
            Test.startTest();

            isWeekend = DateTimeUtil.isWeekend(Date.newInstance(2026, 8, 23));

            Test.stopTest();
        }

        Assert.isTrue(isWeekend, '日曜日を週末と判定する必要あり');
    }

    /**
     * 基準日より前の土曜日も週末と判定
     */
    @IsTest
    static void shouldReturnTrueWhenDateBeforeReferenceIsSaturday() {
        Boolean isWeekend;

        System.runAs(testUser) {
            Test.startTest();

            isWeekend = DateTimeUtil.isWeekend(Date.newInstance(1900, 1, 6));

            Test.stopTest();
        }

        Assert.isTrue(isWeekend, '基準日より前の土曜日を週末と判定する必要あり');
    }

    /**
     * null の日付は週末ではないと判定
     */
    @IsTest
    static void shouldReturnFalseWhenWeekendDateIsNull() {
        Boolean isWeekend;

        System.runAs(testUser) {
            Test.startTest();

            isWeekend = DateTimeUtil.isWeekend(null);

            Test.stopTest();
        }

        Assert.isFalse(isWeekend, 'null を週末と判定しない必要あり');
    }

    /**
     * 同日内の時間帯は境界を含めて判定
     */
    @IsTest
    static void shouldReturnTrueWhenTimeIsOnBoundary() {
        Time boundaryTime = Time.newInstance(9, 0, 0, 0);
        Boolean isWithinRange;

        System.runAs(testUser) {
            Test.startTest();

            isWithinRange = DateTimeUtil.isWithinTimeRange(
                boundaryTime,
                boundaryTime,
                Time.newInstance(18, 0, 0, 0)
            );

            Test.stopTest();
        }

        Assert.isTrue(isWithinRange, '開始時刻を時間帯の範囲内と判定する必要あり');
    }

    /**
     * 日を跨ぐ時間帯の深夜時刻を範囲内と判定
     */
    @IsTest
    static void shouldReturnTrueWhenTimeRangeCrossesMidnight() {
        Boolean isWithinRange;

        System.runAs(testUser) {
            Test.startTest();

            isWithinRange = DateTimeUtil.isWithinTimeRange(
                Time.newInstance(1, 0, 0, 0),
                Time.newInstance(22, 0, 0, 0),
                Time.newInstance(2, 0, 0, 0)
            );

            Test.stopTest();
        }

        Assert.isTrue(isWithinRange, '日を跨ぐ時間帯の深夜時刻を範囲内と判定する必要あり');
    }

    /**
     * 日を跨ぐ時間帯の日中時刻を範囲外と判定
     */
    @IsTest
    static void shouldReturnFalseWhenTimeIsOutsideOvernightRange() {
        Boolean isWithinRange;

        System.runAs(testUser) {
            Test.startTest();

            isWithinRange = DateTimeUtil.isWithinTimeRange(
                Time.newInstance(12, 0, 0, 0),
                Time.newInstance(22, 0, 0, 0),
                Time.newInstance(2, 0, 0, 0)
            );

            Test.stopTest();
        }

        Assert.isFalse(isWithinRange, '日を跨ぐ時間帯の日中時刻を範囲内と判定しない必要あり');
    }

    /**
     * null を含む時間帯は範囲外と判定
     */
    @IsTest
    static void shouldReturnFalseWhenTimeRangeContainsNull() {
        Boolean isWithinRange;

        System.runAs(testUser) {
            Test.startTest();

            isWithinRange = DateTimeUtil.isWithinTimeRange(
                null,
                Time.newInstance(9, 0, 0, 0),
                Time.newInstance(18, 0, 0, 0)
            );

            Test.stopTest();
        }

        Assert.isFalse(isWithinRange, 'null を含む時間帯を有効と判定しない必要あり');
    }

    /**
     * 同じ開始日と終了日は有効な範囲と判定
     */
    @IsTest
    static void shouldReturnTrueWhenDateRangeIsSameDay() {
        Date targetDate = Date.newInstance(2026, 8, 24);
        Boolean isValid;

        System.runAs(testUser) {
            Test.startTest();

            isValid = DateTimeUtil.isValidDateRange(targetDate, targetDate);

            Test.stopTest();
        }

        Assert.isTrue(isValid, '同じ開始日と終了日を有効な範囲と判定する必要あり');
    }

    /**
     * 開始日が終了日より後の場合は不正な範囲と判定
     */
    @IsTest
    static void shouldReturnFalseWhenDateRangeIsReversed() {
        Boolean isValid;

        System.runAs(testUser) {
            Test.startTest();

            isValid = DateTimeUtil.isValidDateRange(
                Date.newInstance(2026, 8, 25),
                Date.newInstance(2026, 8, 24)
            );

            Test.stopTest();
        }

        Assert.isFalse(isValid, '開始日が終了日より後の範囲を有効と判定しない必要あり');
    }

    /**
     * null を含む日付範囲は不正と判定
     */
    @IsTest
    static void shouldReturnFalseWhenDateRangeContainsNull() {
        Boolean isValid;

        System.runAs(testUser) {
            Test.startTest();

            isValid = DateTimeUtil.isValidDateRange(null, Date.newInstance(2026, 8, 24));

            Test.stopTest();
        }

        Assert.isFalse(isValid, 'null を含む日付範囲を有効と判定しない必要あり');
    }
}
