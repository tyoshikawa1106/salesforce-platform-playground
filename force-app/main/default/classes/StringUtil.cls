/**
 * 文字列の変換・分割処理を提供
 */
public with sharing class StringUtil {

    /**
     * インスタンス化を禁止
     */
    @TestVisible
    private StringUtil() {
        // 静的メソッドだけを公開するため外部からの生成を禁止
        throw new IllegalArgumentException('StringUtil はインスタンス化できません。');
    }

    /**
     * 文字列を指定した最大文字数に切り詰め
     *
     * @param value 対象文字列
     * @param maxLength 最大文字数、0 以上が必要
     * @return 最大文字数以内の文字列、value が null の場合は空文字列
     * @throws IllegalArgumentException maxLength が null または負の場合
     */
    public static String truncate(String value, Integer maxLength) {
        requireNonNegative(maxLength, 'maxLength');
        if (value == null) {
            return '';
        }
        if (value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }

    /**
     * 指定した文字数ごとに区切り文字列を挿入
     *
     * @param value 対象文字列
     * @param separator 挿入する区切り文字列、null は空文字列として扱う
     * @param interval 区切る文字数、1 以上が必要
     * @return 区切り文字列を挿入した文字列、value が null の場合は空文字列
     * @throws IllegalArgumentException interval が null または 1 未満の場合
     */
    public static String insertEvery(String value, String separator, Integer interval) {
        requirePositive(interval, 'interval');
        if (value == null || value == '') {
            return '';
        }

        String actualSeparator = separator == null ? '' : separator;
        List<String> chunks = new List<String>();
        for (Integer startIndex = 0; startIndex < value.length(); startIndex += interval) {
            Integer nextIndex = startIndex + interval;
            Integer endIndex = nextIndex < value.length() ? nextIndex : value.length();
            chunks.add(value.substring(startIndex, endIndex));
        }
        return String.join(chunks, actualSeparator);
    }

    /**
     * 先頭の 0 を除去
     *
     * @param value 対象文字列
     * @return 先頭の 0 を除去した文字列、0 だけの場合は 0、value が null の場合は空文字列
     */
    public static String removeLeadingZeros(String value) {
        if (value == null || value == '') {
            return '';
        }

        Integer firstNonZeroIndex = 0;
        while (firstNonZeroIndex < value.length() - 1 && value.substring(firstNonZeroIndex, firstNonZeroIndex + 1) == '0') {
            firstNonZeroIndex++;
        }
        return value.substring(firstNonZeroIndex);
    }

    /**
     * 全角・半角スペースを指定した文字列へ置換
     *
     * @param value 対象文字列
     * @param replacement 置換後の文字列
     * @return スペースを置換した文字列、value が null の場合は空文字列
     * @throws IllegalArgumentException replacement が null の場合
     */
    public static String replaceSpaces(String value, String replacement) {
        if (replacement == null) {
            throw new IllegalArgumentException('replacement は null にできません。');
        }
        if (value == null) {
            return '';
        }
        return value.replace('　', ' ').replace(' ', replacement);
    }

    /**
     * 区切り正規表現で文字列を重複のない集合へ分割
     *
     * @param value 対象文字列
     * @param delimiterRegex String.split で使用する区切り正規表現
     * @return 空要素を除外した文字列集合、入力が空の場合は空の集合
     */
    public static Set<String> splitToSet(String value, String delimiterRegex) {
        Set<String> values = new Set<String>();
        if (String.isBlank(value) || String.isBlank(delimiterRegex)) {
            return values;
        }

        for (String splitValue : value.split(delimiterRegex)) {
            if (String.isNotEmpty(splitValue)) {
                values.add(splitValue);
            }
        }
        return values;
    }

    private static void requireNonNegative(Integer value, String parameterName) {
        if (value == null || value < 0) {
            throw new IllegalArgumentException(parameterName + ' は 0 以上にしてください。');
        }
    }

    private static void requirePositive(Integer value, String parameterName) {
        if (value == null || value <= 0) {
            throw new IllegalArgumentException(parameterName + ' は 1 以上にしてください。');
        }
    }
}