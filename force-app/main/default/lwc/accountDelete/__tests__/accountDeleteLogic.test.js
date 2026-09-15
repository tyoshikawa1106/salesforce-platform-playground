import { createDeleteView } from '../accountDeleteLogic';

describe('取引先削除の表示モデル', () => {
    it.each([undefined, null])('応答未確認時は開始不可: %s', (response) => {
        expect(createDeleteView(response, false, '').canStart).toBe(false);
    });
    it.each(['Holding', 'Queued', 'Preparing', 'Processing', 'Unknown'])('未終了状態では再実行不可: %s', (status) => {
        expect(createDeleteView({ latestJob: { Id: 'run', Status: status } }, false, '').canStart).toBe(false);
    });
    it.each(['Completed', 'PartialFailure', 'Failed', 'Aborted'])('終端状態では再実行可能: %s', (status) => {
        expect(createDeleteView({ latestJob: { Id: 'run', Status: status } }, false, '').canStart).toBe(true);
    });
    it('別ジョブの完了応答で受付済み状態を解除しない', () => {
        const view = createDeleteView({ latestJob: { Id: 'old-job', Status: 'Completed' } }, false, 'new-job');
        expect(view.acceptedJobCompleted).toBe(false);
        expect(view.hasRun).toBe(true);
        expect(view.status).toBe('状態未確認');
        expect(view.jobId).toBe('new-job');
        expect(view.canStart).toBe(false);
    });
    it('受付したジョブが終了したら再実行を許可する', () => {
        const view = createDeleteView({ latestJob: { Id: 'job', Status: 'Completed' } }, false, 'job');
        expect(view.acceptedJobCompleted).toBe(true);
        expect(view.canStart).toBe(true);
        expect(view.status).toBe('完了');
    });
    it('権限不足では古い履歴を表示しない', () => {
        const view = createDeleteView(
            { blockMessage: '権限不足', latestJob: { Id: 'run', Status: 'Completed' } },
            false,
            ''
        );
        expect(view.hasRun).toBe(false);
        expect(view.canStart).toBe(false);
    });
});
