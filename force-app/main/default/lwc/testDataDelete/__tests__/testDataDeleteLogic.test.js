import { createRows, createView } from '../testDataDeleteLogic';

const response = {
    objectNames: ['Contact', 'Account'],
    labels: { Account: '取引先', Contact: '取引先責任者' },
    unavailableObjects: [],
    executionState: 'IDLE',
    jobs: [],
    errorMessage: ''
};

describe('全件削除の表示状態', () => {
    it('未取得をゼロ件と扱わない', () => {
        expect(createRows(response, {}).map((row) => row.remaining)).toEqual(['未確認', '未確認']);
        expect(createView(response, {}, false, '', false).canStart).toBe(false);
    });
    it('全対象を確認してから実行を許可する', () => {
        expect(createView(response, { Account: 2, Contact: 0 }, false, '', false).canStart).toBe(true);
    });
    it('機能なしと権限による確認不能を区別する', () => {
        const result = createRows({ ...response, unavailableObjects: ['Contact'] }, { Account: 1 });
        expect(result[0].remaining).toBe('対象外（機能なし）');
        expect(result[0].known).toBe(true);
    });
    it('受付したジョブと異なる完了履歴を使わない', () => {
        const view = createView(
            { ...response, jobs: [{ Id: 'other', Status: 'Completed' }] },
            { Account: 1, Contact: 0 },
            false,
            'accepted',
            false
        );
        expect(view.canStart).toBe(false);
        expect(view.jobStatus).toBe('受付ジョブ確認中');
    });
    it('受付ジョブが終了しても全体完了と表示しない', () => {
        const view = createView(
            { ...response, executionState: 'RUNNING', jobs: [{ Id: 'accepted', Status: 'Completed' }] },
            { Account: 1, Contact: 0 },
            false,
            'accepted',
            false
        );
        expect(view.status).toBe('削除処理中');
        expect(view.canStart).toBe(false);
    });
    it('受付応答の欠落は更新しても自動的に解消しない', () => {
        const view = createView(response, { Account: 1, Contact: 0 }, false, '', true);
        expect(view.status).toBe('受付不明');
        expect(view.canStart).toBe(false);
    });
    it('全対象ゼロ件を確認した場合だけ対象なしと表示する', () => {
        const view = createView(response, { Account: 0, Contact: 0 }, false, '', false);
        expect(view.status).toBe('対象レコードなし（残件数確認済み）');
        expect(view.canStart).toBe(false);
    });
    it.each([
        [{ ...response, errorMessage: '権限がありません' }, false],
        [{ ...response, executionState: 'RUNNING' }, false],
        [response, true],
        [undefined, false]
    ])('権限不足・実行中・通信中・未確認では開始不可', (data, busy) => {
        expect(createView(data, { Account: 1, Contact: 0 }, busy, '', false).canStart).toBe(false);
    });
});

it('終了した受付ジョブだけで残存データを完了扱いしない', () => {
    const view = createView(
        { ...response, jobs: [{ Id: 'accepted', Status: 'Completed', NumberOfErrors: 1 }] },
        { Account: 1, Contact: 0 },
        false,
        'accepted',
        false
    );
    expect(view.status).toBe('削除停止・残件数あり');
    expect(view.jobStatus).toBe('受付ジョブにエラーあり');
    expect(view.canStart).toBe(true);
});
