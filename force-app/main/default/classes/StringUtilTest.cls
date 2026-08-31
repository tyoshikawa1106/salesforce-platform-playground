/**
 * StringUtil テスト
 */
@IsTest
private with sharing class StringUtilTest {

    private static User testUser = TestDataFactory.getTestUser();

    /**
     * インスタンス化を拒否
     */
    @IsTest
    static void shouldThrowWhenInstantiated() {
        System.runAs(testUser) {
            Test.startTest();

            try {
                new StringUtil();
                Assert.fail('StringUtil のインスタンス化では例外が必要');
            } catch (IllegalArgumentException e) {
                Assert.isTrue(e.getMessage().contains('StringUtil'), '例外メッセージで対象クラスを識別できる必要あり');
            }

            Test.stopTest();
        }
    }

    /**
     * 最大文字数を超える文字列を切り詰め
     */
    @IsTest
    static void shouldTruncateWhenValueExceedsMaxLength() {
        String actualValue;

        System.runAs(testUser) {
            Test.startTest();

            actualValue = StringUtil.truncate('Salesforce', 5);

            Test.stopTest();
        }

        Assert.areEqual('Sales', actualValue, '最大文字数を超える部分を除外する必要あり');
    }

    /**
     * 最大文字数以内の文字列は維持
     */
    @IsTest
    static void shouldKeepValueWhenWithinMaxLength() {
        String actualValue;

        System.runAs(testUser) {
            Test.startTest();

            actualValue = StringUtil.truncate('Apex', 4);

            Test.stopTest();
        }

        Assert.areEqual('Apex', actualValue, '最大文字数以内の文字列を変更しない必要あり');
    }

    /**
     * null の文字列を空文字列へ変換
     */
    @IsTest
    static void shouldReturnEmptyWhenTruncateValueIsNull() {
        String actualValue;

        System.runAs(testUser) {
            Test.startTest();

            actualValue = StringUtil.truncate(null, 5);

            Test.stopTest();
        }

        Assert.areEqual('', actualValue, 'null の文字列を空文字列へ変換する必要あり');
    }

    /**
     * 負の最大文字数は拒否
     */
    @IsTest
    static void shouldThrowWhenMaxLengthIsNegative() {
        System.runAs(testUser) {
            Test.startTest();

            try {
                StringUtil.truncate('Apex', -1);
                Assert.fail('負の最大文字数では例外が必要');
            } catch (IllegalArgumentException e) {
                Assert.isTrue(e.getMessage().contains('maxLength'), '例外メッセージで不正な引数を識別できる必要あり');
            }

            Test.stopTest();
        }
    }

    /**
     * 指定した文字数ごとに区切り文字列を挿入
     */
    @IsTest
    static void shouldInsertSeparatorAtInterval() {
        String actualValue;

        System.runAs(testUser) {
            Test.startTest();

            actualValue = StringUtil.insertEvery('ABCDEFGHIJ', '-', 3);

            Test.stopTest();
        }

        Assert.areEqual('ABC-DEF-GHI-J', actualValue, '指定間隔で区切り文字列を挿入する必要あり');
    }

    /**
     * 日本語文字列を文字数単位で分割
     */
    @IsTest
    static void shouldInsertSeparatorIntoJapaneseText() {
        String actualValue;

        System.runAs(testUser) {
            Test.startTest();

            actualValue = StringUtil.insertEvery('あいうえお', '/', 2);

            Test.stopTest();
        }

        Assert.areEqual('あい/うえ/お', actualValue, '日本語文字列を文字数単位で分割する必要あり');
    }

    /**
     * null の区切り文字列は文字列を連結したまま維持
     */
    @IsTest
    static void shouldTreatNullSeparatorAsEmpty() {
        String actualValue;

        System.runAs(testUser) {
            Test.startTest();

            actualValue = StringUtil.insertEvery('ABCD', null, 2);

            Test.stopTest();
        }

        Assert.areEqual('ABCD', actualValue, 'null の区切り文字列を空文字列として扱う必要あり');
    }

    /**
     * null の対象文字列を空文字列へ変換
     */
    @IsTest
    static void shouldReturnEmptyWhenInsertValueIsNull() {
        String actualValue;

        System.runAs(testUser) {
            Test.startTest();

            actualValue = StringUtil.insertEvery(null, '-', 3);

            Test.stopTest();
        }

        Assert.areEqual('', actualValue, 'null の文字列を空文字列へ変換する必要あり');
    }

    /**
     * 0 以下の挿入間隔は拒否
     */
    @IsTest
    static void shouldThrowWhenIntervalIsNotPositive() {
        System.runAs(testUser) {
            Test.startTest();

            try {
                StringUtil.insertEvery('Apex', '-', 0);
                Assert.fail('0 の挿入間隔では例外が必要');
            } catch (IllegalArgumentException e) {
                Assert.isTrue(e.getMessage().contains('interval'), '例外メッセージで不正な引数を識別できる必要あり');
            }

            Test.stopTest();
        }
    }

    /**
     * 先頭の 0 を除去
     */
    @IsTest
    static void shouldRemoveLeadingZeros() {
        String actualValue;

        System.runAs(testUser) {
            Test.startTest();

            actualValue = StringUtil.removeLeadingZeros('000123');

            Test.stopTest();
        }

        Assert.areEqual('123', actualValue, '先頭の 0 だけを除去する必要あり');
    }

    /**
     * null の文字列を空文字列へ変換
     */
    @IsTest
    static void shouldReturnEmptyWhenRemovingLeadingZerosFromNull() {
        String actualValue;

        System.runAs(testUser) {
            Test.startTest();

            actualValue = StringUtil.removeLeadingZeros(null);

            Test.stopTest();
        }

        Assert.areEqual('', actualValue, 'null の文字列を空文字列へ変換する必要あり');
    }

    /**
     * 0 だけの文字列は 1 文字の 0 を返却
     */
    @IsTest
    static void shouldKeepSingleZeroWhenValueContainsOnlyZeros() {
        String actualValue;

        System.runAs(testUser) {
            Test.startTest();

            actualValue = StringUtil.removeLeadingZeros('0000');

            Test.stopTest();
        }

        Assert.areEqual('0', actualValue, '0 だけの文字列を空にしない必要あり');
    }

    /**
     * 数値以外を含む文字列でも先頭の 0 だけを除去
     */
    @IsTest
    static void shouldRemoveLeadingZerosFromAlphanumericValue() {
        String actualValue;

        System.runAs(testUser) {
            Test.startTest();

            actualValue = StringUtil.removeLeadingZeros('00ABC');

            Test.stopTest();
        }

        Assert.areEqual('ABC', actualValue, '数値変換せず先頭の 0 だけを除去する必要あり');
    }

    /**
     * 全角・半角スペースを同じ文字列へ置換
     */
    @IsTest
    static void shouldReplaceFullWidthAndHalfWidthSpaces() {
        String actualValue;

        System.runAs(testUser) {
            Test.startTest();

            actualValue = StringUtil.replaceSpaces('A B　C', '_');

            Test.stopTest();
        }

        Assert.areEqual('A_B_C', actualValue, '全角・半角スペースを同じ置換文字列へ変換する必要あり');
    }

    /**
     * null の対象文字列を空文字列へ変換
     */
    @IsTest
    static void shouldReturnEmptyWhenReplacingSpacesInNull() {
        String actualValue;

        System.runAs(testUser) {
            Test.startTest();

            actualValue = StringUtil.replaceSpaces(null, '_');

            Test.stopTest();
        }

        Assert.areEqual('', actualValue, 'null の文字列を空文字列へ変換する必要あり');
    }

    /**
     * null の置換文字列は拒否
     */
    @IsTest
    static void shouldThrowWhenSpaceReplacementIsNull() {
        System.runAs(testUser) {
            Test.startTest();

            try {
                StringUtil.replaceSpaces('A B', null);
                Assert.fail('null の置換文字列では例外が必要');
            } catch (IllegalArgumentException e) {
                Assert.isTrue(e.getMessage().contains('replacement'), '例外メッセージで不正な引数を識別できる必要あり');
            }

            Test.stopTest();
        }
    }

    /**
     * 区切り正規表現で重複のない集合へ分割
     */
    @IsTest
    static void shouldSplitUniqueValuesToSet() {
        Set<String> actualValues;

        System.runAs(testUser) {
            Test.startTest();

            actualValues = StringUtil.splitToSet('A,,B,A', ',');

            Test.stopTest();
        }

        Assert.areEqual(new Set<String>{ 'A', 'B' }, actualValues, '空要素と重複を除外する必要あり');
    }

    /**
     * 空白文字列は空の集合へ変換
     */
    @IsTest
    static void shouldReturnEmptySetWhenSplitValueIsBlank() {
        Set<String> actualValues;

        System.runAs(testUser) {
            Test.startTest();

            actualValues = StringUtil.splitToSet('   ', ',');

            Test.stopTest();
        }

        Assert.isTrue(actualValues.isEmpty(), '空白文字列から値を生成しない必要あり');
    }

    /**
     * 空の区切り正規表現は空の集合を返却
     */
    @IsTest
    static void shouldReturnEmptySetWhenDelimiterIsBlank() {
        Set<String> actualValues;

        System.runAs(testUser) {
            Test.startTest();

            actualValues = StringUtil.splitToSet('A,B', '');

            Test.stopTest();
        }

        Assert.isTrue(actualValues.isEmpty(), '区切り正規表現がない場合は値を生成しない必要あり');
    }
}