/** 未受付画面の初期値を検証 */
@IsTest
private with sharing class TestDataDeleteWrapperTest {
    @IsTest
    static void initializesUnacceptedView() {
        System.runAs(TestDataFactory.getTestUser()) {
            TestDataDeleteWrapper response = new TestDataDeleteWrapper();
            Assert.areEqual('', response.jobId, '未受付');
            Assert.areEqual('IDLE', response.executionState, '実行中ではない');
            Assert.isTrue(response.objectNames.isEmpty(), '未確認の対象を推測しない');
            Assert.isTrue(response.jobs.isEmpty(), '前回ジョブを持たない');
        }
    }
}
