import {
    applyClassifyBatch, applyClassifyCsv, buildRelationBoard, clientErrorDetails,
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
    it('参照専用でも保存済み分類を表示し、編集状態を混在させない', () => {
        const data = { Name: { editable: true, complianceGroup: 'PII', securityClassification: 'Restricted', businessStatus: 'Active', ownerId: '005000000000001AAA', ownerLabel: '分類所有者' } };
        const choices = { ...options, SecurityClassification: [{ label: '制限', value: 'Restricted' }] };
        const edits = createClassifyEdits(data);
        edits.Name.draft.businessStatus = '';
        const view = classifyFieldView({ fields: [fields[1]], classifyData: data, edits, options: choices, canEdit: false });
        expect(view.rows[0]).toMatchObject({ editing: false, complianceLabel: '個人情報', securityLabel: '制限', businessLabel: '使用中', ownerLabel: '分類所有者', changed: false });
        expect(view.rows[0].reason).toContain('権限が必要');
        const empty = classifyFieldView({ fields: [fields[1]], classifyData, edits: {}, options, canEdit: false });
        expect(empty.rows[0]).toMatchObject({ complianceLabel: '', securityLabel: '', businessLabel: '', ownerLabel: '' });
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
    it('オブジェクトと項目のラベルを出力し、照合ではラベルに依存しない', () => {
        const edits = changedEdits();
        const csv = classifyCsv('Account', fields, classifyData, edits, '取引先');
        expect(csv.split('\r\n')[0]).toContain('"オブジェクトラベル","オブジェクトAPI名","項目ラベル","項目API名"');
        expect(csv).toContain('"取引先","Account","名前","Name"');
        const changedLabels = csv.replaceAll('取引先', '別の表示名').replace('"名前"', '"変更ラベル"');
        expect(readClassifyCsv(changedLabels, 'Account', edits, options, classifyData, fields).errors).toEqual([]);
        const legacy = csv.split('\r\n').map((line) => line.split(',').filter((_, i) => i !== 0 && i !== 2).join(',')).join('\r\n');
        expect(readClassifyCsv(legacy, 'Account', edits, options, classifyData, fields).errors).toEqual([]);
    });

    it('分類の画面とCSVは編集可能な項目だけを含め、構造側は全項目を維持する', () => {
        const data = { ...classifyData, Phone: { editable: false } };
        const all = [...fields, { apiName: 'UnknownType__c', label: '未取得' }];
        const edits = createClassifyEdits(data);
        const csv = classifyCsv('Account', all, data, edits);
        expect(csv.split('\r\n')).toHaveLength(2);
        expect(csv).not.toContain('Phone');
        expect(csv).not.toContain('UnknownType__c');
        expect(readClassifyCsv(csv, 'Account', edits, options, data, all).errors).toEqual([]);
        const initial = fieldListView(all, '', '', undefined, {});
        expect(initial.rows).toEqual([]);
        const view = fieldListView(all, '', '', initial, data);
        expect(view.rows.map((field) => field.apiName)).toEqual(['Name']);
        expect(fieldListView(all, '', '', view, data)).toBe(view);
        expect(fieldListView(all, '', '', view).rows).toHaveLength(3);
    });

    it('日本語ヘッダーと引用符を往復し、未保存の変更だけを反映する', () => {
        const edits = changedEdits();
        const csv = classifyCsv('Account', fields, classifyData, edits);
        const baseline = createClassifyEdits(classifyData);
        const parsed = readClassifyCsv(csv, 'Account', baseline, options, classifyData, fields);
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
        expect(readClassifyCsv([...lines, lines[1]].join('\r\n'), 'Account', edits, options, classifyData, fields).errors[0].message).toContain('重複');
        const ownerCsv = csv.replace(/,""$/u, ',"任意の名前"');
        expect(readClassifyCsv(ownerCsv, 'Account', edits, options, classifyData, fields).errors[0].message).toContain('18桁');
    });
    it('閉じていない引用符と未知の分類値を拒否する', () => {
        expect(() => readClassifyCsv('"未閉鎖', 'Account', {}, options)).toThrow('引用符');
        const csv = classifyCsv('Account', fields, classifyData, changedEdits()).replace('Active', 'Unknown');
        expect(readClassifyCsv(csv, 'Account', createClassifyEdits(classifyData), options, classifyData, fields).errors[0].message).toContain('有効な候補');
    });
    it('所有者の照合失敗では他の行も反映せず元の入力を返す', () => {
        const edits = createClassifyEdits(classifyData);
        const applied = applyClassifyCsv([{ apiName: 'Name', line: 2, draft: { businessStatus: 'Active' }, ownerId: '005000000000001AAA' }], {}, edits, 1);
        expect(applied.edits).toBe(edits);
        expect(applied.errors).toHaveLength(1);
    });
    it('構造CSVは分類4列を追加し、編集不可・未取得の項目も保持する', () => {
        const all = [...fields, { apiName: 'Missing__c', label: '未取得', type: 'STRING' }];
        const data = { Name: { editable: false, complianceGroup: 'PII;HIPAA', securityClassification: 'Restricted', businessStatus: 'Active', ownerId: '005000000000001AAA' } };
        const lines = structureCsv(all, 'ja-JP', 'Asia/Tokyo', data).split('\r\n');
        expect(lines).toHaveLength(4);
        expect(lines[0]).toContain('"コンプライアンス分類","データ機密度","項目の利用状況","データ所有者ID"');
        expect(lines.find((line) => line.includes('"Name"'))).toContain('"PII;HIPAA","Restricted","Active","005000000000001AAA"');
        expect(lines.find((line) => line.includes('"Missing__c"'))).toMatch(/,"","","",""$/u);
    });
    it('構造CSVは表示順と同じ項目整形を使用する', () => {
        const csv = structureCsv([{ ...fields[1], label: '名前,"確認"' }], 'ja-JP', 'Asia/Tokyo');
        expect(csv).toContain('"名前,""確認"""');
        expect(csv).toContain('"API名"');
        expect(csv).toContain('"false"');
    });
});

it('エラー位置から組織URL・端末パス・入力値・応答本文を除外する', () => {
    const error = { name: 'TypeError', message: 'sensitive value', body: { accessToken: 'secret-token' }, stack: 'TypeError: sensitive value\n    at save (https://private.example/modules/c/objectExplorer.js:123:7)\n    at caller (/Users/private/project/helper.js:45:9)' };
    const details = clientErrorDetails(error, 'handleSaveClassifyData', 'confirmation');
    expect(details.location).toBe('objectExplorer.js / handleSaveClassifyData / confirmation');
    expect(details.errorType).toBe('TypeError');
    expect(details.frames).toEqual(['objectExplorer.js:123:7', 'helper.js:45:9']);
    const log = JSON.stringify(details);
    for (const privateValue of ['private.example', '/Users/', 'sensitive value', 'secret-token']) { expect(log).not.toContain(privateValue); }
});
it('スタックのないAPIエラーでも処理名と種別を表示する', () => {
    expect(clientErrorDetails({ body: { message: 'server value' } }, 'readObjectInfo', 'field-audit')).toEqual({ location: 'objectExplorer.js / readObjectInfo / field-audit', errorType: 'SalesforceError', frames: [], frame: '' });
});
