import {
    applicationOptions,
    automationStage,
    errorMessage,
    stageRows,
    stageBlockingMessage,
    stageOperation,
    normalizedApplicationId
} from '../externalClientAppManagerLogic';
describe('個別操作の表示と要求', () => {
    it('候補は表示名とAPI名を併記し、選択値にアプリIDを使う', () => {
        expect(applicationOptions([{ id: 'app', label: '対象', name: 'Target' }], 0)[0]).toMatchObject({ label: '対象', name: 'Target', value: 'app', selected: true });
    });
    it('状態ごとに適用・削除可否を決め、秘密を取り除く', () => {
        const rows = stageRows(
            ['active', 'Rotated', 'expired', 'unknown'].map((state) => ({ id: 'stage', state, secret: 'PRIVATE' }))
        );
        expect(rows.map((r) => r.stateLabel)).toEqual(['未適用', '適用済み', '期限切れ', '不明']);
        expect(rows.map((r) => r.canDelete)).toEqual([true, true, true, false]);
        expect(JSON.stringify(rows)).not.toContain('PRIVATE');
        expect(() => stageRows(undefined)).toThrow();
    });
    it('操作ごとの要求に表示中の状態を含める', () => {
        const app = { id: 'app', label: '対象', name: 'Target' };
        expect(stageOperation('generate', app, undefined, 'entered').input).toEqual({
            action: 'generate',
            appId: 'app',
            confirmation: 'Target',
            confirmationId: 'entered'
        });
        const apply = stageOperation('apply', app, { id: 'stage', state: 'active', stateLabel: '未適用' });
        expect(apply.input.stageState).toBe('active');
        expect(apply.message).toBeUndefined();
        expect(stageOperation('stages', app, undefined, 'entered').input.action).toBe('stages');
        const deletion = stageOperation('deleteStage', app, { id: 'stage', state: 'rotated' }, 'entered');
        expect(deletion.message).toContain('旧コンシューマ鍵と秘密を削除します');
        expect(deletion.message).toContain('連携先が新しい鍵と秘密に切り替わっていること');
        expect(() => stageOperation('replace', app)).toThrow();
    });
    it('15桁と18桁を正規化し、不正なチェックサムや文字を拒否する', () => {
        expect(normalizedApplicationId('0xI000000000001')).toBe('0xI000000000001EAA');
        expect(normalizedApplicationId(' 0xI000000000001EAA ')).toBe('0xI000000000001EAA');
        expect(normalizedApplicationId('0xI000000000001AAA')).toBe('');
        expect(normalizedApplicationId('0xi000000000001')).toBe('');
        expect(normalizedApplicationId('../secret')).toBe('');
        expect(normalizedApplicationId('')).toBe('');
    });
    it('内部例外を公開しない', () => {
        expect(errorMessage(new Error('PRIVATE'))).not.toContain('PRIVATE');
    });
    it('自動更新の対象は一件かつ期待したIDと状態に限定する', () => {
        const row = { id: 'stage', state: 'Rotated' };
        expect(automationStage([row, { id: 'old', state: 'rotated' }], 'stage', 'rotated')).toBe(row);
        expect(automationStage([{ id: 'old', state: 'rotated' }, { id: 'new', state: 'active' }], undefined, 'active').id).toBe('new');
        for (const rows of [
            [],
            [row, row],
            [{ ...row, id: 'other' }],
            [{ ...row, state: 'expired' }],
            [{ state: 'rotated' }]
        ]) {
            expect(() => automationStage(rows, 'stage', 'rotated')).toThrow();
        }
    });
});

describe('資格情報の状態別案内', () => {
    it.each(['unknown', undefined, ''])('不明状態%sでは削除を勧めない', (state) => {
        const message = stageBlockingMessage([{ state }, { state: 'rotated' }]);
        expect(message).toContain('標準設定画面で状態を確認');
        expect(message).not.toContain('削除');
    });
    it('適用済みだけが連携先の切り替え確認を案内する', () => {
        expect(stageBlockingMessage([{ state: 'Rotated' }])).toContain('連携先の切り替え');
        expect(stageBlockingMessage([{ state: 'expired' }])).toContain('期限切れ');
        expect(stageBlockingMessage([{ state: 'expired' }])).not.toContain('連携先');
    });
    it('空一覧と未適用だけでは更新を妨げない', () => {
        expect(stageBlockingMessage([])).toBe('');
        expect(stageBlockingMessage([{ state: 'active' }])).toBe('');
    });
});
