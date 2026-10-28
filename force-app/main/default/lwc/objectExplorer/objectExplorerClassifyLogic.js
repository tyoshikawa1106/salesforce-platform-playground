// 複数選択の順序や空値の表現に依存しない分類値を生成
export function normalizeClassify(values) {
    // 所有者と単一選択は空文字へ揃え、分類集合だけを整列
    return Object.fromEntries(['complianceGroup', 'securityClassification', 'businessStatus'].map((key) => [key, key === 'complianceGroup' ? [...new Set((values[key] || '').split(';').filter(Boolean))].sort().join(';') : values[key] || '']));
}

// 候補への対応が確認できない入力を未設定へ変換しない
export function classifyInput(key, value, options, original) {
    // サーバーの分類候補名だけを受け付ける
    const properties = { complianceGroup: { source: 'ComplianceGroup', label: 'コンプライアンス分類' }, securityClassification: { source: 'SecurityClassification', label: 'データ機密度' }, businessStatus: { source: 'BusinessStatus', label: '項目の利用状況' } };
    // 未確定の入力を直す場所を表示名で案内
    const property = properties[key];
    // 拒否した値や表示名から別の値を推測しない
    const invalid = { valid: false, message: `${property?.label || '分類'}を有効な候補から選択してください。入力が確定するまで保存できません。` };
    // 不明な属性や候補がない状態の入力を拒否
    if (!property || !Array.isArray(options[property.source])) { return invalid; }
    // 複数選択の解除は空配列、単一選択の解除は空文字に限定
    const multiple = key === 'complianceGroup';
    // 型が崩れた値を暗黙に空へ変換しない
    if (multiple ? !Array.isArray(value) : typeof value !== 'string') { return invalid; }
    // 現在値を保持する場合も有効候補とは区別して許可
    const allowed = new Set([...options[property.source].map((option) => option.value), ...(multiple ? (original[key] || '').split(';').filter(Boolean) : ['', original[key]])]);
    // 複数値も一つずつ型と候補を確認
    const selected = multiple ? value : [value];
    // 対応がない値は推測した別の候補や未設定へ置き換えない
    if (!selected.every((item) => typeof item === 'string' && (!multiple || item !== '') && allowed.has(item))) { return invalid; }
    // 確認できた値だけをAPI表現へまとめる
    return { valid: true, value: multiple ? value.join(';') : value };
}

// 検索範囲外の現在値を所有者候補へ維持
export function createOwnerOptions(options, owner) {
    // IDに対応する表示名を別の候補から補完しない
    return [...options, ...(owner.value && !options.some((option) => option.value === owner.value) ? [owner] : [])];
}
