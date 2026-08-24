/**
 * 日付と時刻の変換・判定処理を提供
 */
public with sharing class DateTimeUtil {

    private static final Date REFERENCE_SUNDAY = Date.newInstance(1900, 1, 7);

    /**
     * インスタンス化を禁止
     */
    @TestVisible
    private DateTimeUtil() {
        // 静的メソッドだけを公開するため外部からの生成を禁止
        throw new IllegalArgumentException('DateTimeUtil はインスタンス化できません。');
    }

    /**
     * yyyy-MM-dd または yyyy/MM/dd 形式の文字列を Date へ変換
     *
     * @param value 変換する日付文字列
     * @return 変換した日付、空または不正な形式の場合は null
     */
    public static Date parseDate(String value) {
        if (String.isBlank(value)) {
            return null;
        }

        try {
            return Date.valueOf(value.trim().replace('/', '-'));
        } catch (TypeException e) {
            return null;
        }
    }

    /**
     * 文字列が変換可能な日付か判定
     *
     * @param value 判定する日付文字列
     * @return 変換可能な日付の場合 true、それ以外の場合 false
     */
    public static Boolean isValidDate(String value) {
        return parseDate(value) != null;
    }

    /**
     * 日付が土曜日または日曜日か判定
     *
     * @param value 判定する日付
     * @return 土曜日または日曜日の場合 true、それ以外の場合 false
     */
    public static Boolean isWeekend(Date value) {
        if (value == null) {
            return false;
        }

        Integer daysSinceSunday = REFERENCE_SUNDAY.daysBetween(value);
        Integer dayOfWeek = Math.mod(daysSinceSunday, 7);
        if (dayOfWeek < 0) {
            dayOfWeek += 7;
        }
        return dayOfWeek == 0 || dayOfWeek == 6;
    }

    /**
     * 時刻が開始時刻から終了時刻までの範囲内か判定
     *
     * 開始時刻が終了時刻より後の場合は日を跨ぐ時間帯として判定
     *
     * @param targetTime 判定する時刻
     * @param startTime 範囲の開始時刻
     * @param endTime 範囲の終了時刻
     * @return 境界を含む時間帯の範囲内の場合 true、それ以外の場合 false
     */
    public static Boolean isWithinTimeRange(Time targetTime, Time startTime, Time endTime) {
        if (targetTime == null || startTime == null || endTime == null) {
            return false;
        }
        if (startTime <= endTime) {
            return targetTime >= startTime && targetTime <= endTime;
        }
        return targetTime >= startTime || targetTime <= endTime;
    }

    /**
     * 開始日と終了日が有効な範囲か判定
     *
     * @param startDate 範囲の開始日
     * @param endDate 範囲の終了日
     * @return 両方の日付が存在し開始日が終了日以前の場合 true、それ以外の場合 false
     */
    public static Boolean isValidDateRange(Date startDate, Date endDate) {
        return startDate != null && endDate != null && startDate <= endDate;
    }
}
