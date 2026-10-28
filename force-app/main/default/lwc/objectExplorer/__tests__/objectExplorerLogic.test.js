import {
    applyClassifyBatch, applyClassifyCsv, buildRelationBoard,
    classifyBatches, classifyChanges, classifyCsv, classifyFieldView,
    classifyInput, classifySummary, createClassifyEdits,
    fieldListView, objectOptionWindow, readClassifyCsv, structureCsv, visibleRelations
} from '../objectExplorerLogic';

const fields = [
    { apiName: 'Phone', label: '電話', type: 'PHONE', typeLabel: '電話', custom: false },
    { apiName: 'Name', label: '名前', type: 'STRING', typeLabel: 'テキスト(255)', custom: false }
];
const options = { ComplianceGroup: [{ label: '個人情報', value: 'PII' }], SecurityClassification: [], BusinessStatus: [{ label: '使用中', value: 'Active' }] };
const classifyData = { Name: { editable: true, complianceGroup: '', securityClassification: '', businessStatus: '', ownerId: '', ownerLabel: '未設定' } };
const changedEdits = () => {
    const edits = createClassifyEdits(classifyData);
    edits.Name.draft.businessStatus = 'Active';
    return edits;
};

describe('オブジェクトエクスプローラーの表示・分類契約', () => {
    it('項目の絞り込みと再利用で入力を変更しない', () => {
        const view = fieldListView(fields, ' name ', '', undefined);
        expect(view.rows.map((field) => field.apiName)).toEqual(['Name']);
        expect(fieldListView(fields, ' name ', '', view)).toBe(view);
        expect(fields.map((field) => field.apiName)).toEqual(['Phone', 'Name']);
    });
    it('通常と多態の参照元だけを切り替え、参照先は維持する', () => {
        const relation = (direction, polymorphic) => ({ key: direction, direction, apiName: 'Contact', label: '連絡先', links: [{ field: 'AccountId', label: '取引先', polymorphic }] });
        const data = { apiName: 'Account', label: '取引先', relations: [relation('IN', true), relation('OUT', true)] };
        const standard = visibleRelations(data);
        expect(standard.map((row) => row.direction)).toEqual(['OUT']);
        expect(visibleRelations(data, 'polymorphic')).toHaveLength(2);
        expect(buildRelationBoard(data, standard, 'root').outgoing).toHaveLength(1);
    });
    it('候補の末尾でも全件をDOM用モデルへ展開しない', () => {
        const all = Array.from({ length: 2000 }, (_, index) => ({ value: `Object${index}`, label: `対象${index}` }));
        const view = objectOptionWindow(all, 1999, 2000 * 56);
        expect(view.items).toHaveLength(40);
        expect(view.items.at(-1)).toMatchObject({ position: 2000, total: 2000, selected: true });
    });
    it('分類変更と不正入力を独立して集計する', () => {
        const edits = changedEdits();
        edits.Name.inputErrors = { owner: '候補を選択' };
        expect(classifySummary(edits)).toEqual({ changeCount: 1, inputErrorCount: 1 });
        expect(classifyInput('businessStatus', 'Unknown', options, edits.Name.original).valid).toBe(false);
        expect(classifyInput('businessStatus', '', options, edits.Name.original)).toEqual({ valid: true, value: '' });
        expect(classifyChanges(edits)[0]).toMatchObject({ apiName: 'Name', draft: { businessStatus: 'Active', ownerId: '' } });
    });
    it('変更のない分類行はキャッシュを再利用する', () => {
        const context = { fields, classifyData, edits: createClassifyEdits(classifyData), options, canEdit: true };
        const before = classifyFieldView(context);
        const after = classifyFieldView(context, before);
        expect(after.rows[0]).toBe(before.rows[0]);
        expect(after.rows[1]).toBe(before.rows[1]);
    });
    it('保存結果をAPI名で照合し、失敗行の入力を保持する', () => {
        const edits = changedEdits();
        const changes = classifyChanges(edits);
        const failed = applyClassifyBatch(changes, edits, classifyData, [{ apiName: 'Name', success: false, message: '競合' }]);
        expect(failed.edits.Name.draft.businessStatus).toBe('Active');
        expect(failed.failureCount).toBe(1);
        const saved = applyClassifyBatch(changes, edits, classifyData, [{ apiName: 'Name', success: true, latest: { businessStatus: 'Active' }, owner: { value: '', label: '未設定' } }]);
        expect(saved.successCount).toBe(1);
        expect(classifySummary(saved.edits).changeCount).toBe(0);
        expect(edits.Name.original.businessStatus).toBe('');
        expect(() => applyClassifyBatch(changes, edits, classifyData, [{ apiName: 'Other', success: true }])).toThrow('一致');
    });
    it('保存要求を上限で分割して入力順を維持する', () => {
        const changes = Array.from({ length: 21 }, (_, index) => ({ apiName: String(index) }));
        const batches = classifyBatches(changes);
        expect(batches.map((batch) => batch.length)).toEqual([10, 10, 1]);
        expect(batches.flat()).toEqual(changes);
    });
});

describe('分類CSVの読取と反映', () => {
    it('日本語ヘッダーと引用符を往復し、未保存の変更だけを反映する', () => {
        const edits = changedEdits();
        const csv = classifyCsv('Account', fields, classifyData, edits);
        const baseline = createClassifyEdits(classifyData);
        const parsed = readClassifyCsv(csv, 'Account', baseline, options, classifyData);
        expect(parsed.errors).toEqual([]);
        const applied = applyClassifyCsv(parsed.rows, {}, baseline, 1);
        expect(applied.errors).toEqual([]);
        expect(applied.edits.Name.draft.businessStatus).toBe('Active');
        expect(baseline.Name.draft.businessStatus).toBe('');
        expect(applied.edits.Name.original).toEqual(baseline.Name.original);
    });
    it('別オブジェクト・重複行・不正所有者を保存入力へ混入させない', () => {
        const edits = createClassifyEdits(classifyData);
        const csv = classifyCsv('Account', fields, classifyData, changedEdits());
        expect(readClassifyCsv(csv, 'Contact', edits, options).errors[0].message).toContain('一致');
        const lines = csv.split('\r\n');
        expect(readClassifyCsv([...lines, lines[1]].join('\r\n'), 'Account', edits, options).errors[0].message).toContain('重複');
        const ownerCsv = csv.replace(/,""$/u, ',"任意の名前"');
        expect(readClassifyCsv(ownerCsv, 'Account', edits, options).errors[0].message).toContain('18桁');
    });
    it('閉じていない引用符と未知の分類値を拒否する', () => {
        expect(() => readClassifyCsv('"未閉鎖', 'Account', {}, options)).toThrow('引用符');
        const csv = classifyCsv('Account', fields, classifyData, changedEdits()).replace('Active', 'Unknown');
        expect(readClassifyCsv(csv, 'Account', createClassifyEdits(classifyData), options).errors[0].message).toContain('有効な候補');
    });
    it('所有者の照合失敗では他の行も反映せず元の入力を返す', () => {
        const edits = createClassifyEdits(classifyData);
        const applied = applyClassifyCsv([{ apiName: 'Name', line: 2, draft: { businessStatus: 'Active' }, ownerId: '005000000000001AAA' }], {}, edits, 1);
        expect(applied.edits).toBe(edits);
        expect(applied.errors).toHaveLength(1);
    });
    it('構造CSVは表示順と同じ項目整形を使用する', () => {
        const csv = structureCsv([{ ...fields[1], label: '名前,"確認"' }], 'ja-JP', 'Asia/Tokyo');
        expect(csv).toContain('"名前,""確認"""');
        expect(csv).toContain('"API名"');
        expect(csv).toContain('"false"');
    });
});
