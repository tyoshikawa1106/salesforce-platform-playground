/**
 * Tests Account domain behavior.
 */
@IsTest
private with sharing class AccountDomainTest {
    @IsTest
    static void shouldNormalizeAccountNames() {
        // Given
        List<Account> accounts = new List<Account>{
            TestDataFactory.createAccount('㈱テスト')
        };

        // When
        System.runAs(getCurrentUser()) {
            Test.startTest();
            AccountDomain.normalizeNames(accounts, null);
            Test.stopTest();
        }

        // Then
        Assert.areEqual(
            '株式会社テスト',
            accounts[0].Name,
            'Domain should apply Account name normalization.'
        );
    }

    private static User getCurrentUser() {
        return new User(Id = UserInfo.getUserId());
    }
}
