// 合意した更新項目だけを画面と保存要求で共有
export const EDIT_FIELDS = ['OwnerId', 'Industry', 'Type', 'Rating'];

export function validateSearch(filters) {
    // 日付の逆転はサーバー呼び出し前に案内
    return filters.startDate && filters.endDate && filters.startDate > filters.endDate
        ? '開始日は終了日以前を指定してください。'
        : '';
}

export function applyEdit(records, changes, recordId, fieldName, value) {
    // 表示中の許可項目だけを編集対象にする
    const original = records.find((record) => record.Id === recordId);
    // 不正なイベントから状態を変更しない
    if (!original || !EDIT_FIELDS.includes(fieldName)) {
        // 不正な入力では既存の変更を維持
        return changes;
    }
    // 既存の変更を破壊せず対象行だけを更新
    const next = { ...changes, [recordId]: { ...changes[recordId] } };
    // 空文字と未設定を同じ値として比較
    const normalized = value || null;
    // 元の値に戻った項目は保存対象から除外
    if ((original[fieldName] || null) === normalized) {
        // 元の値に戻した項目を送信対象から除外
        delete next[recordId][fieldName];
    } else {
        // 明示的なnullをクリア要求として保持
        next[recordId][fieldName] = normalized;
    }
    // 全項目が元の値へ戻った行のハイライトを解除
    if (Object.keys(next[recordId]).length === 0) {
        // 変更のなくなった行の表示状態を解除
        delete next[recordId];
    }
    // 入力を破壊せず新しい変更集合を返却
    return next;
}

export function buildSaveRequest(records, changes) {
    // 表示中の行だけを更新前のバージョンと対応させる
    const originals = new Map(records.map((record) => [record.Id, record]));
    // 編集行から更新対象を生成
    const entries = Object.entries(changes);
    // クライアント側でも更新上限を強制
    if (!entries.length || entries.length > 200) {
        throw new Error('変更件数は1〜200件にしてください。');
    }
    // 変更値と読取時点の日時を別々に送信
    const request = { changes: [], versions: {} };
    // 所有者クリアや表示外の更新を保存前に拒否
    entries.forEach(([id, fields]) => {
        // 対象行を取得して更新前情報を確認
        const original = originals.get(id);
        // 不正な状態で保存を実行しない
        if (!original || !original.LastModifiedDate || ('OwnerId' in fields && !fields.OwnerId)) {
            throw new Error('所有者と更新前の情報を確認してください。');
        }
        // Apexへ渡す項目を許可リストに限定
        const record = { Id: id };
        // nullを落とさず変更項目だけを転記
        EDIT_FIELDS.forEach((field) => {
            // 変更していない項目を上書きしない
            if (Object.hasOwn(fields, field)) {
                // 明示的なクリアを含めて変更値を転記
                record[field] = fields[field];
            }
        });
        // 各行の差分とバージョンを対応させる
        request.changes.push(record);
        // 保存時の競合検出に使う元の日時を保持
        request.versions[id] = original.LastModifiedDate;
    });
    // 検証済みの変更と日時をまとめて返却
    return request;
}

function createOptions(metadata, value) {
    // 未設定への変更を明示的な選択肢にする
    const options = [
        { label: '（値をクリア）', value: '' },
        ...(metadata?.values || []).map((entry) => ({ label: entry.label, value: entry.value }))
    ];
    // 非アクティブな既存値も空欄に置き換えず表示
    if (value && !options.some((option) => option.value === value)) {
        options.push({ label: `${value}（現在の値）`, value });
    }
    // レコードタイプ別の選択肢を表示へ返却
    return options;
}

export function buildRows(records, changes, errors, editableFields, picklists, defaultRecordTypeId, busy) {
    // 元データ・変更値・権限を一つの行表示モデルへ変換
    return records.map((original) => {
        // 変更値を元のレコードへ重ねて表示
        const change = changes[original.Id];
        // 行のレコードタイプに対応する選択肢を取得
        const metadata = picklists[original.RecordTypeId || defaultRecordTypeId];
        // 表示中の値を生成
        const row = { ...original, ...change };
        // 入力値と状態をテンプレートに渡す
        return {
            ...row,
            url: `/lightning/r/Account/${row.Id}/view`,
            rowClass: change ? 'changed-row' : '',
            status: change ? '変更あり' : '',
            error: errors[row.Id] || '',
            ownerLabel: `${row.Name}の所有者`,
            industryLabel: `${row.Name}の業種`,
            typeLabel: `${row.Name}の種別`,
            ratingLabel: `${row.Name}の評価`,
            industryValue: row.Industry || '',
            typeValue: row.Type || '',
            ratingValue: row.Rating || '',
            industryOptions: createOptions(metadata?.Industry, row.Industry),
            typeOptions: createOptions(metadata?.Type, row.Type),
            ratingOptions: createOptions(metadata?.Rating, row.Rating),
            ownerDisabled: busy || !editableFields.includes('OwnerId'),
            industryDisabled: busy || !editableFields.includes('Industry') || !metadata?.Industry,
            typeDisabled: busy || !editableFields.includes('Type') || !metadata?.Type,
            ratingDisabled: busy || !editableFields.includes('Rating') || !metadata?.Rating
        };
    });
}

export function retainFailedChanges(changes, successIds) {
    // 保存成功した行を再保存対象から除外
    const saved = new Set(successIds);
    // 失敗した行の入力はそのまま維持
    return Object.fromEntries(Object.entries(changes).filter(([id]) => !saved.has(id)));
}