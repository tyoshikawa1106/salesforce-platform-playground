// ID型を明示し、参照型の空括弧だけを除去
export function fieldTypeLabel(field) {
    // DescribeのID型を参照関係と誤表示しない
    if (String(field.type || '').toUpperCase() === 'ID') { return 'ID'; }
    // Salesforceの型表記を取得したまま基準にする
    const label = field.typeLabel || '';
    // 半角・全角の空括弧を表示とCSVで統一して除去
    return String(field.type || '').toUpperCase() === 'REFERENCE' ? label.replace(/\s*(?:\(\s*\)|（\s*）)\s*$/u, '') : label;
}

// 桁数・参照先を検索用の型名から外し、暗号化や複数選択などの型の違いは維持
export function fieldTypeGroup(field) {
    const label = fieldTypeLabel(field);
    if (String(field.type || '').toUpperCase() === 'REFERENCE') { return label.replace(/\s*[（(].*[）)]\s*$/u, '').trim(); }
    return label.replace(/\s*[（(][\d\s,，、.]*[）)]/gu, '').trim();
}

// 日本語の項目ラベル昇順とし、同名の場合はAPI名で順序を固定
function compareFieldLabels(a, b) {
    // ラベル未取得の呼出元でも項目の識別子を維持
    return (a.label || a.apiName).localeCompare(b.label || b.apiName, 'ja') || a.apiName.localeCompare(b.apiName);
}

// 項目定義の取得時だけ整列・型名加工・検索文字列の生成を行う
function indexFields(fields) {
    // 検索条件で順番が変わらない索引を元データとは別に保持
    return [...fields].sort(compareFieldLabels).map((field) => ({
        field: { ...field, typeLabel: fieldTypeLabel(field) },
        type: fieldTypeGroup(field), label: field.label.toLowerCase(), apiName: field.apiName.toLowerCase()
    }));
}
// 対象と検索条件が同じなら整列済みの結果と型候補を再利用
export function fieldListView(fields, search, type, previous) {
    // 分類値の変更では項目定義と検索条件は変わらない
    if (previous?.source === fields && previous.search === search && previous.type === type) { return previous; }
    // 入力のたびに全項目を整列・加工せず取得時の索引を共有
    const index = previous?.source === fields ? previous.index : indexFields(fields);
    // 型候補も加工済みの索引から一度だけ生成
    const typeOptions = previous?.source === fields ? previous.typeOptions : [{ label: 'すべてのデータ型', value: '' },
        ...[...new Set(index.map((entry) => entry.type))].sort((a, b) => a.localeCompare(b, 'ja')).map((value) => ({ label: value, value }))];
    // 検索語は各項目の比較前に一度だけ正規化
    const needle = (search || '').trim().toLowerCase();
    // 絞り込みでも整列済みの順序と項目モデルを維持
    const rows = index.filter((entry) => (!type || entry.type === type) && (entry.label.includes(needle) || entry.apiName.includes(needle))).map((entry) => entry.field);
    // 依存元と索引を同じモデルで管理し、別オブジェクトの値を持ち越さない
    return { source: fields, search, type, index, rows, typeOptions };
}

// 保存可否と未保存確認に必要な件数を一回の走査で集計
export function classificationSummary(edits) {
    // 件数と対象のAPI名を同じ結果へまとめる
    const result = { changeCount: 0, inputErrorCount: 0 };
    // 同じ行の変更判定を集計と絞り込みで共有
    for (const state of Object.values(edits)) {
        // 分類値と所有者IDの比較は各行で一度だけ行う
        const changed = classificationChanged(state);
        // 未確定入力は変更件数と分けて数える
        const invalid = hasInvalidClassificationInput(state);
        // 一つの行で複数属性が変わっても一件として扱う
        if (changed) { result.changeCount += 1; }
        // 入力エラーのある行を数える
        if (invalid) { result.inputErrorCount += 1; }
    }
    // ページ位置に依存しない一覧全体の集計
    return result;
}

// Apexで監査項目を除外済みの関連から、参照元の種類だけを切り替える
export function visibleRelations(data, kind = 'standard') {
    // 空応答も正常な初期状態として扱う
    return (data?.relations || []).map((relation) => {
        // 画面に表示する種類の関連項目だけを検索対象にも使用
        const links = relation.links.filter((link) => relation.direction === 'OUT' || link.polymorphic === (kind === 'polymorphic'));
        // 検索入力のたびに項目名を連結し直さない
        const searchText = [relation.label, relation.apiName, ...links.flatMap((link) => [link.label, link.field])].join(' ').toLocaleLowerCase();
        // 表示用の関連と検索用文字列を同じ生成時点で揃える
        return { ...relation, links, searchText };
    }).filter((relation) => relation.links.length)
        .sort((a, b) => a.label.localeCompare(b.label, 'ja') || a.apiName.localeCompare(b.apiName));
}
// 全関連を方向別のカード一覧に変換し、選択と検索を同じモデルへ反映
export function buildRelationBoard(data, relations, selectedKey, incomingTerm = '', outgoingTerm = '') {
    const shown = relations.filter((row) => row.apiName !== data.apiName);
    // 同じ相手でも参照方向ごとのカードを維持
    const card = (row, root = false) => ({ key: row.key || 'root', apiName: row.apiName, label: row.label,
        className: `oe-node${root ? ' oe-root' : ''}${(row.key || 'root') === selectedKey ? ' oe-selected' : ''}`,
        selected: (row.key || 'root') === selectedKey,
        count: root ? '' : `${row.links.length}項目で関連`,
        links: root ? [] : row.links.slice(0, 2).map((link) => ({ key: link.field, text: `${link.label} (${link.field})：${link.kind}` })),
        more: !root && row.links.length > 2 ? `ほか${row.links.length - 2}件` : '' });
    // 大文字小文字と前後空白の変換は検索語ごとに一度だけ行う
    const incomingNeedle = incomingTerm.trim().toLocaleLowerCase();
    // 左右の検索語を混ぜず同じ変換を適用
    const outgoingNeedle = outgoingTerm.trim().toLocaleLowerCase();
    const incoming = shown.filter((row) => row.direction === 'IN');
    const outgoing = shown.filter((row) => row.direction === 'OUT');
    return { root: card(data, true), incoming: incoming.filter((row) => row.searchText.includes(incomingNeedle)).map((row) => card(row)),
        outgoing: outgoing.filter((row) => row.searchText.includes(outgoingNeedle)).map((row) => card(row)),
        incomingTotal: incoming.length, outgoingTotal: outgoing.length };
}

// 複数選択の順序や空値の表現に依存しない分類値を生成
export function normalizeClassification(values) {
    // 所有者と単一選択は空文字へ揃え、分類集合だけを整列
    return Object.fromEntries(['complianceGroup', 'securityClassification', 'businessStatus'].map((key) => [key, key === 'complianceGroup' ? [...new Set((values[key] || '').split(';').filter(Boolean))].sort().join(';') : values[key] || '']));
}
// 一覧取得時の分類と所有者IDを基準に、未変更の入力状態を一括生成
export function createClassificationEdits(rows) {
    return Object.fromEntries(Object.entries(rows).filter(([, row]) => row.editable && typeof row.ownerId === 'string' && typeof row.ownerLabel === 'string')
        .map(([apiName, row]) => {
            const original = normalizeClassification(row);
            const owner = { value: row.ownerId, label: row.ownerLabel };
            return [apiName, { original, draft: { ...original }, originalOwner: owner, owner, ownerOptions: createOwnerOptions([], owner), ownerSearch: '', error: '' }];
        }));
}
// 元の値へ戻した行を保存対象から除外
export function classificationChanged(state) {
    // 編集開始前の行を変更ありと扱わない
    if (!state?.original) { return false; }
    // 候補を比較する前に分類の並びと空値を揃える
    const original = normalizeClassification(state.original);
    // 同じ変換を項目ごとに繰り返さない
    const draft = normalizeClassification(state.draft);
    // 所有者は表示名や識別名ではなくIDで比較
    return ['complianceGroup', 'securityClassification', 'businessStatus'].some((key) => original[key] !== draft[key]) || state.originalOwner.value !== state.owner.value;
}
// 保存済みの非アクティブな選択値も消さずに表示できる候補を生成
export function includeCurrentOptions(options, values) {
    // 有効な候補を元の順番で維持
    const result = [...options];
    // 同じ値を重複させない
    const present = new Set(options.map((option) => option.value));
    // 既存値を勝手に未設定へ変えない
    for (const value of values.filter(Boolean)) {
        // 組織の有効な選択肢はラベルもそのまま使用
        if (present.has(value)) { continue; }
        // 有効な候補でないことが分かる表示にする
        result.push({ label: `${value}（現在の値）`, value });
        // 同じ既存値は一度だけ追加
        present.add(value);
    }
    // 元の候補は変更しない
    return result;
}
// API値を組織で定義された表示ラベルへ変換
function choiceLabel(value, options) {
    // 空値は表示せず、未知の値は取得値を維持
    return value ? options.find((option) => option.value === value)?.label || value : '';
}
// 所有者の候補・選択状態・読み上げIDを同じ行から生成
function ownerLookupView(apiName, edit, info) {
    // 所有者IDのない表示名を選択済みの値として扱わない
    const owner = edit?.owner || { value: info?.ownerId || '', label: info?.ownerLabel || '' };
    // 選択済みの行は検索候補を開かない
    const open = Boolean(edit?.ownerOpen) && !owner.value;
    // 閉じたルックアップでは候補ごとの変換を省く
    const candidates = open ? (edit.ownerOptions || []).filter((option) => option.value).map((option, index) => ({
        ...option, id: `owner-${apiName}-${index}`, selected: index === edit.ownerActive,
        optionClass: `slds-media slds-listbox__option slds-listbox__option_entity slds-listbox__option_has-meta${index === edit.ownerActive ? ' slds-has-focus' : ''}`
    })) : [];
    // キーボード選択が候補内にある場合だけ読み上げ対象を指定
    const active = candidates[edit?.ownerActive];
    // 表示名と候補の位置は同じIDに結び付ける
    return { ownerLabel: owner.value ? owner.label : '', ownerSearch: edit?.ownerSearch || '', ownerSelected: Boolean(owner.value),
        ownerOpen: open, ownerContainerClass: `slds-combobox_container${owner.value ? ' slds-has-selection' : ''}`, ownerComboboxClass: `slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click${open ? ' slds-is-open' : ''}`, ownerListId: `owners-${apiName}`, ownerActiveId: active?.id || null, ownerCandidates: candidates };
}

// 保存の応答を対象行へ適用し、未確認の値や別行の入力を変更しない
function classificationResult(apiName, state, classification, result) {
    // 選択位置や表示名による別項目への対応付けを拒否
    if (!state || result?.apiName !== apiName) { throw new Error('保存結果の対象項目を確認できませんでした。'); }
    // 失敗した行は値と基準値を保持して理由だけを更新
    if (!result.success) { return { edit: { ...state, error: result.message }, classification }; }
    // 保存後にサーバーがIDを照合した候補だけを採用
    const owner = result.owner;
    // 所有者が別のIDなら成功として反映しない
    if (!owner || owner.value !== state.owner.value || !owner.label) { throw new Error('保存後の所有者を確認できませんでした。'); }
    // 再取得できた分類値を次の編集の基準へ揃える
    const latest = normalizeClassification(result.latest);
    // 現在値の候補を重複させず、検索結果を維持
    const ownerOptions = createOwnerOptions(state.ownerOptions.filter((option) => option.value !== owner.value && option.value !== ''), owner);
    // 編集行と保存済みの表示値を同じ結果から更新
    return { edit: { ...state, original: latest, draft: { ...latest }, originalOwner: owner, owner, ownerOptions, error: '' },
        classification: { ...classification, ...latest, ownerId: owner.value, ownerLabel: owner.label } };
}

// ページ表示に必要な分類と編集状態を項目へ合成
function classificationRow(field, context) {
    // 表示モデルと再利用判定で同じ入力を使用
    const { classifications, edits, options, canEdit } = context;
    // 分類未取得を空の分類値と混同しない
    const info = classifications[field.apiName];
    // 入力中の値はページ移動後も同じAPI名へ結び付ける
    const edit = canEdit ? edits[field.apiName] : undefined;
    // 編集開始済みの行では最新取得した値を表示
    const values = edit?.draft || info || {};
    // 複数選択を個別の値へ戻す
    const compliance = (values.complianceGroup || '').split(';').filter(Boolean);
    // 既存の無効値も表示できるよう基準値を候補へ含める
    const original = edit?.original || values;
    // ハイライトと読み上げで同じ変更判定を使う
    const changed = classificationChanged(edit);
    // ハイライトとエラー表示で同じ入力状態を使う
    const inputErrors = Object.values(edit?.inputErrors || {}).filter(Boolean);
    // ラベル・型と分類の表示状態をまとめる
    return { ...field, ...values, editing: Boolean(edit),
        reason: !canEdit && info?.editable ? '変更には「オブジェクトのカスタマイズ」権限が必要です。' : info?.reason || (info ? '' : '分類情報を設定できない項目です。'),
        rowClass: changed || inputErrors.length ? 'oe-classification-changed' : '', changed, complianceValues: compliance, unavailable: !info,
        complianceOpen: Boolean(edit?.complianceOpen), compliancePopupId: `compliance-${field.apiName}`, compliancePopupClass: edit?.complianceAbove ? 'slds-dropdown slds-dropdown_fluid slds-dropdown_bottom oe-compliance-options' : 'slds-dropdown slds-dropdown_fluid oe-compliance-options',
        complianceOptions: includeCurrentOptions(options.ComplianceGroup, (original.complianceGroup || '').split(';')),
        securityOptions: [{ label: '-- なし --', value: '' }, ...includeCurrentOptions(options.SecurityClassification, [original.securityClassification])],
        businessOptions: [{ label: '-- なし --', value: '' }, ...includeCurrentOptions(options.BusinessStatus, [original.businessStatus])],
        // 空値は候補ラベルを入力欄へ表示せず、保存用の空文字とは分ける
        securityInputValue: values.securityClassification || undefined, businessInputValue: values.businessStatus || undefined,
        complianceLabel: compliance.length ? compliance.map((value) => choiceLabel(value, options.ComplianceGroup)).join(',') : '',
        securityLabel: choiceLabel(values.securityClassification, options.SecurityClassification), businessLabel: choiceLabel(values.businessStatus, options.BusinessStatus),
        ...ownerLookupView(field.apiName, edit, info), error: inputErrors.join(' / ') || edit?.error || '' };
}
// 表示中のページだけ保持し、変更のない分類行は選択肢と所有者表示を再利用
export function classificationFieldView(context, previous) {
    // 項目定義・分類値・編集状態を同じAPI名へ対応付ける
    const { fields, classifications, edits, options, canEdit } = context;
    // ページ外の行を蓄積せず、現在表示する行だけを次のキャッシュにする
    const entries = new Map();
    // 各行の依存元が変わった場合だけ表示モデルを作り直す
    const rows = fields.map((field) => {
        // 権限がない状態では編集値を表示へ混ぜない
        const edit = canEdit ? edits[field.apiName] : undefined;
        // 分類読取・保存後の値もキャッシュの一致条件に含める
        const info = classifications[field.apiName];
        // 同じページ内の直前の行だけを参照
        const cached = previous?.entries.get(field.apiName);
        // 候補定義や編集権限が変わった場合はすべての行を更新
        const entry = previous?.options === options && previous.canEdit === canEdit && cached?.field === field && cached.edit === edit && cached.info === info
            ? cached : { field, edit, info, row: classificationRow(field, context) };
        // 行番号ではなくAPI名で再利用先を固定
        entries.set(field.apiName, entry);
        // 変更されていない行は同じ表示モデルを返す
        return entry.row;
    });
    // 次回の比較に必要なページ内の依存元だけ保持
    return { entries, rows, options, canEdit };
}

// 保存に必要な変更行だけをAPI名とIDから生成
export function classificationChanges(edits) {
    // 保存対象をページや検索条件から独立して抽出
    return Object.entries(edits).filter(([, state]) => classificationChanged(state)).map(([apiName, state]) => {
        // 比較用の順序と空値を統一
        const original = normalizeClassification(state.original);
        // 同じ正規化を編集値にも適用
        const normalizedDraft = normalizeClassification(state.draft);
        // 保存に必要な分類と所有者IDだけを送信し、識別名や表示名は含めない
        const draft = { complianceGroup: normalizedDraft.complianceGroup, securityClassification: normalizedDraft.securityClassification, businessStatus: normalizedDraft.businessStatus, ownerId: state.owner.value };
        // 表示用の明細を組み立てず保存用の基準値と変更値だけを返す
        return { apiName, original: { ...original, ownerId: state.originalOwner.value }, draft };
    });
}

// 検索範囲外の現在値を所有者候補へ維持
export function createOwnerOptions(options, owner) {
    // IDに対応する表示名を別の候補から補完しない
    return [...options, ...(owner.value && !options.some((option) => option.value === owner.value) ? [owner] : [])];
}

// 候補への対応が確認できない入力を未設定へ変換しない
export function classificationInput(key, value, options, original) {
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

// 一つの入力を修正しても他の未確定入力を解除しない
export function hasInvalidClassificationInput(state) {
    // 所有者と各分類属性のエラーを別々に保持
    return Object.values(state?.inputErrors || {}).some(Boolean);
}

// 候補のスクロール座標と描画範囲で同じ行高を使用
const OBJECT_OPTION_HEIGHT = 56;
// 大量の候補があってもDOMへ展開する件数を固定
const OBJECT_OPTION_WINDOW = 40;
// スクロール中に表示枠の前後が空にならない余白
const OBJECT_OPTION_OVERSCAN = 5;

// 描画する候補の先頭を行変換なしで計算
export function objectOptionStart(count, scrollTop) {
    // 末尾とスクロール前後の余白を同じ境界に揃える
    return Math.min(Math.max(0, count - OBJECT_OPTION_WINDOW), Math.max(0, Math.floor(scrollTop / OBJECT_OPTION_HEIGHT) - OBJECT_OPTION_OVERSCAN));
}

// 取得済み候補のうち表示位置付近だけをSLDSの候補行へ変換
export function objectOptionWindow(options, activeIndex, scrollTop) {
    // 末尾でも描画範囲が配列を超えないよう先頭位置を制限
    const start = objectOptionStart(options.length, scrollTop);
    // 描画範囲の外側を同じ高さの余白として維持
    const end = Math.min(options.length, start + OBJECT_OPTION_WINDOW);
    // 候補IDと表示名を同じ行に維持し、全件中の位置も読み上げへ渡す
    const items = options.slice(start, end).map((option, index) => ({ ...option,
        domId: `object-option-${option.value}`, selected: start + index === activeIndex,
        position: start + index + 1, total: options.length, style: `height:${OBJECT_OPTION_HEIGHT}px`,
        className: `oe-object-option slds-media slds-listbox__option slds-listbox__option_entity slds-listbox__option_has-meta${start + index === activeIndex ? ' slds-has-focus' : ''}` }));
    // 余白と候補行を同じモデルから返す
    return { items, start, end, topStyle: `height:${start * OBJECT_OPTION_HEIGHT}px`, bottomStyle: `height:${(options.length - end) * OBJECT_OPTION_HEIGHT}px` };
}

// キーボードで選んだ候補が表示範囲へ入る最小のスクロール位置を計算
export function objectOptionScrollTop(index, scrollTop, viewportHeight) {
    // 候補上端の座標を固定の行高から算出
    const top = index * OBJECT_OPTION_HEIGHT;
    // 表示枠より上の候補は上端へ合わせる
    if (top < scrollTop) { return top; }
    // 表示枠より下の候補は下端へ合わせ、範囲内なら動かさない
    return Math.max(scrollTop, top + OBJECT_OPTION_HEIGHT - viewportHeight);
}

// 保存対象をAPIの上限に合わせて最大10項目ずつに分割
export function classificationBatches(changes) {
    // 最後の端数も同じ保存経路へ渡す
    return Array.from({ length: Math.ceil(changes.length / 10) }, (_, index) => changes.slice(index * 10, (index + 1) * 10));
}

// 応答順を使わず項目API名で一括保存結果を適用
export function applyClassificationBatch(changes, edits, classifications, results) {
    // 件数違いを部分成功として扱わない
    if (!Array.isArray(results) || results.length !== changes.length) { throw new Error('保存結果の件数が一致しません。最新状態を確認してください。'); }
    // 未定義や文字列の成否を成功・失敗へ暗黙変換しない
    if (results.some((result) => typeof result?.apiName !== 'string' || typeof result.success !== 'boolean')) { throw new Error('保存結果の形式を確認できませんでした。最新状態を確認してください。'); }
    // 重複や別の項目の結果を更新行へ対応づけない
    const index = new Map(results.map((result) => [result.apiName, result]));
    // 要求と応答の完全な対応を先に確認
    if (index.size !== changes.length || changes.some((change) => !index.has(change.apiName))) { throw new Error('保存結果の対象項目が一致しません。最新状態を確認してください。'); }
    // 全体のコピーはバッチごとに一度だけ作り、入力の参照を変更しない
    const next = { edits: { ...edits }, classifications: { ...classifications }, successCount: 0, failureCount: 0 };
    // 各結果は同じAPI名の行だけを生成
    for (const change of changes) {
        // 応答の並びではなく要求の識別子で取得
        const result = index.get(change.apiName);
        // 所有者と対象の照合に失敗した場合はバッチ全体を返さない
        const updated = classificationResult(change.apiName, edits[change.apiName], classifications[change.apiName], result);
        // 元データとは別のMapへ変更された行だけを反映
        next.edits[change.apiName] = updated.edit;
        // 失敗行の保存済み値は元の参照を維持
        next.classifications[change.apiName] = updated.classification;
        // 成否はサーバーで確認できた項目だけ集計
        next.successCount += Number(result.success);
        // 確認済みの拒否を失敗件数へ加算
        next.failureCount += Number(!result.success);
    }
    // すべての検証が完了した一括結果だけを画面へ渡す
    return next;
}

// 出力と読取で同じ列名・順序を使用し、表示ラベルで項目を推測しない
const CLASSIFICATION_CSV_COLUMNS = ['ObjectApiName', 'FieldApiName', 'ComplianceGroup', 'SecurityClassification', 'BusinessStatus', 'BusinessOwnerId'];
// 出力用の日本語列と内部のAPI列を同じ位置で対応付ける
const CLASSIFICATION_CSV_LABELS = ['オブジェクトAPI名', '項目API名', 'コンプライアンス分類', 'データ機密度', '項目の利用状況', 'データ所有者ID'];
// ブラウザの入力検証とDOMのエラー表示を一定の規模へ制限
export const CLASSIFICATION_CSV_LIMITS = Object.freeze({ rows: 10000, bytes: 5 * 1024 * 1024, owners: 500 });

// 整列済みの構造一覧を入力と表示設定が変わった時だけ整形
export function structureFieldView(fields, locale, timeZone, previous) {
    // ページ移動や関連カードの描画では日時整形を繰り返さない
    if (previous?.source === fields && previous.locale === locale && previous.timeZone === timeZone) { return previous; }
    // フィルター済みの行順をそのまま保ち、再整列しない
    return { source: fields, locale, timeZone, rows: formatStructureRows(fields, locale, timeZone) };
}

// 構造CSVの未整列の全項目を画面と同じ行順へ揃える
export function structureRows(fields, locale, timeZone) {
    // 取得済みの項目定義は変更せず一度だけ並べ替える
    const sorted = [...fields].sort(compareFieldLabels);
    // 画面と同じ日時・ユーザー名の表示値を生成
    return formatStructureRows(sorted, locale, timeZone);
}

// 整列済み項目の表示値を生成し、画面とCSVで形式を共用
function formatStructureRows(fields, locale, timeZone) {
    // 対象なしでフォーマッターを生成しない
    if (!fields.length) { return []; }
    // Salesforceの言語とタイムゾーンに合わせ、分単位まで表示
    const formatter = new Intl.DateTimeFormat(locale?.replace('_', '-'), { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    // 同じ行順を維持して日時・ユーザー名だけを合成
    return fields.map((field) => ({ ...field, typeLabel: fieldTypeLabel(field), createdAudit: auditDisplay(field.createdDate, field.createdByName, field.createdById, formatter), modifiedAudit: auditDisplay(field.lastModifiedDate, field.lastModifiedByName, field.lastModifiedById, formatter) }));
}

// 日時とユーザー名を同じ行へまとめ、画面だけユーザーIDからリンクを生成
function auditDisplay(date, userName, userId, formatter) {
    // 取得対象外の日時を補完せず、ユーザー名やリンクも表示しない
    if (!date) { return { text: '—', prefix: '—', userName: '', url: '' }; }
    // 画面とCSVで同じ日時表記を使用
    const dateText = formatter.format(new Date(date));
    // 同じAPI応答のユーザーIDだけを内部レコードリンクに使用
    const url = /^005[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?$/u.test(userId || '') ? `/lightning/r/User/${userId}/view` : '';
    // CSVはリンクを含めず、画面はカンマの後にユーザー名を表示
    return { text: [dateText, userName].filter(Boolean).join(', '), prefix: dateText + (userName ? ', ' : ''), userName: userName || '', url };
}

// 構造CSVは画面と同じ6列・表示値で全件出力
export function structureCsv(fields, locale, timeZone) {
    // 項目定義を同じ表示モデルへ変換
    const rows = structureRows(fields, locale, timeZone).map((field) => [field.label, field.apiName, field.typeLabel, field.custom ? 'True' : 'false', field.createdAudit.text, field.modifiedAudit.text]);
    // オブジェクト名はファイル名に保持し、画面にない列は出力しない
    return encodeCsv([['項目ラベル', 'API名', 'データ型', 'カスタム', '作成日', '最終更新日'], ...rows]);
}

// Salesforce利用者のタイムゾーンで出力日時をファイル名へ付加
export function csvFileName(objectName, isReference, date, timeZone) {
    // 言語による区切りや午前午後表記をファイル名へ持ち込まない
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, numberingSystem: 'latn', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date);
    // 数字の構成要素だけを固定の年月日時分秒へ対応付け
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    // 深夜も00時として秒まで識別できる出力日時を使用
    return `${objectName}-${isReference ? 'fields' : 'classification'}-${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}.csv`;
}

// BOMと引用符で文字コード・セル境界・改行を保持
function encodeCsv(rows) {
    // falseや0もそのまま出力し、引用符だけをエスケープ
    return '\uFEFF' + rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
}

// 分類を取得済みの全項目を、編集可否やページ・絞り込みから独立して出力
export function classificationCsv(objectName, fields, classifications, edits) {
    // 分類情報がない項目だけを除外し、読取専用の項目も含める
    const rows = fields.filter((field) => Object.hasOwn(classifications, field.apiName) && classifications[field.apiName]).sort(compareFieldLabels).map((field) => {
        // 同じAPI名の取得済み分類を出力の基準にする
        const info = classifications[field.apiName];
        // 編集中の行は入力値、読取専用の行は取得値を使用
        const values = edits[field.apiName]?.draft || info;
        // 所有者の表示名ではなく同じ行のIDを出力
        const ownerId = edits[field.apiName]?.owner.value ?? info.ownerId ?? '';
        // 項目一覧にある全対象をAPI名のまま保持
        return [objectName, field.apiName, values.complianceGroup, values.securityClassification, values.businessStatus, ownerId];
    });
    // Excelでも文字コードとセル境界を維持できるようBOMと引用符を付与
    return encodeCsv([CLASSIFICATION_CSV_LABELS, ...rows]);
}

// 読取専用行は保存済み分類と所有者IDが同じ場合だけ読み飛ばす
function unchangedReadOnlyCsv(values, info) {
    // 空欄と複数分類の並び順を通常の編集と同じ基準で比較
    const original = normalizeClassification(info);
    // CSVのAPI値を取得済み値へ正規化して照合
    const current = normalizeClassification({ complianceGroup: values.ComplianceGroup, securityClassification: values.SecurityClassification, businessStatus: values.BusinessStatus });
    // 表示名による所有者の同一視を行わない
    return ['complianceGroup', 'securityClassification', 'businessStatus'].every((key) => original[key] === current[key]) && values.BusinessOwnerId === (info.ownerId || '');
}

// 引用符・改行・BOMを扱い、壊れたCSVを別の列へ対応付けない
function parseClassificationCsv(text) {
    // 文字コード判定用BOMだけを先頭から除外
    const source = text.replace(/^\uFEFF/u, '');
    // セル内と引用符を閉じた後を区別
    let state = 'plain';
    // 未確定の一セルだけを保持
    let cell = '';
    // 一行の列数は見出しと同じ境界で確認
    let cells = [];
    // 空行も行番号を維持して扱う
    const rows = [];
    // 空行を除外しても検証結果のレコード番号を維持
    let line = 1;
    // 最後のセルも同じ区切り処理へ渡す
    for (let index = 0; index <= source.length; index += 1) {
        // ファイル終端を一つの改行と同じ境界へ揃える
        const char = index === source.length ? '\n' : source[index];
        // 引用中の区切り文字と改行はセル内に保持
        if (state === 'quoted') {
            // 引用符が閉じないCSVを黙って採用しない
            if (index === source.length) { throw new Error('閉じていない引用符があります。'); }
            // 連続した引用符だけをセル内の引用符へ戻す
            if (char === '"' && source[index + 1] === '"') { cell += '"'; index += 1; }
            // 引用を閉じた後は区切りだけを受け付ける
            else if (char === '"') { state = 'closed'; }
            // 引用中の改行も列の一部として保持
            else { cell += char; }
            // 引用中の内容を行区切りとして再処理しない
            continue;
        }
        // 引用符はセルの先頭だけで開始
        if (char === '"') {
            // セルの途中や閉じた引用符の直後に別の引用を開始しない
            if (state === 'closed' || cell !== '') { throw new Error('引用符の位置が不正です。'); }
            // 次の区切りを文字列として扱う
            state = 'quoted';
            // 開始引用符を値へ含めない
            continue;
        }
        // 区切り以外の内容だけをセルへ追加
        if (![',', '\r', '\n'].includes(char)) {
            // 閉じた引用符の後へ文字を連結しない
            if (state === 'closed') { throw new Error('引用符の後に区切り以外の文字があります。'); }
            // 空白の扱いは列の意味を検証する段階で決める
            cell += char;
            // セルの途中で行を確定しない
            continue;
        }
        // 行内と行末で同じセル確定を使用
        cells.push(cell);
        // 次のセルは未引用の空値から開始
        cell = '';
        // 引用を閉じた状態を次のセルへ持ち越さない
        state = 'plain';
        // カンマは行を確定しない
        if (char === ',') { continue; }
        // CRLFを二つの行として扱わない
        if (char === '\r' && source[index + 1] === '\n') { index += 1; }
        // 空行の配列を保持せず、見出しと内容のある行だけを格納
        if (!rows.length || cells.some((value) => value.trim())) { rows.push({ cells, line }); }
        // 見出しを除いたデータ行の上限を途中で確認
        if (rows.length > CLASSIFICATION_CSV_LIMITS.rows + 1) { throw new Error(`CSVは${CLASSIFICATION_CSV_LIMITS.rows}行以内にしてください。`); }
        // 空行を含む元のCSVレコード番号を次の行へ引き継ぐ
        line += 1;
        // 次の行の列を独立して保持
        cells = [];
    }
    // 空行は内容を持つレコードと区別したまま返却
    return rows;
}

// CSV全体を先に検証し、別の対象・重複・未知の値は一件も反映しない
export function readClassificationCsv(text, objectName, edits, options, classifications = {}) {
    // ファイル形式の不正は行データへ補完しない
    const parsed = parseClassificationCsv(text);
    // 日本語ヘッダーと既存のAPIヘッダーを固定対応で正規化
    const header = (parsed.shift()?.cells || []).map((value) => {
        // 任意の表示名から列を推測しない
        const name = value.trim();
        // 正式な日本語列だけを内部のAPI列へ変換
        const index = CLASSIFICATION_CSV_LABELS.indexOf(name);
        // 重複は正規化後に検出し、後勝ちで対応付けない
        return index < 0 ? name : CLASSIFICATION_CSV_COLUMNS[index];
    });
    // 列不足・余分な列・重複列を拒否
    if (header.length !== CLASSIFICATION_CSV_COLUMNS.length || new Set(header).size !== header.length || CLASSIFICATION_CSV_COLUMNS.some((name) => !header.includes(name))) { throw new Error(`CSVの列は ${CLASSIFICATION_CSV_LABELS.join(', ')} にしてください。`); }
    // 同じ項目の二重指定を後勝ちで処理しない
    const seen = new Set();
    // 所有者解決を行う前に全行の形式を検証
    const rows = [];
    // 行番号と理由を同じ単位へ保持
    const errors = [];
    // IDの参照だけをまとめてサーバーへ送信
    const ownerIds = new Set();
    // ファイル全体を保存前の入力モデルへ変換
    parsed.forEach(({ cells, line }) => {
        // 列ずれしたレコードを別の項目へ対応付けない
        if (cells.length !== header.length) { errors.push({ line, message: '列数が見出しと一致しません。' }); return; }
        // 誤った列に巨大な本文を入れたCSVを入力やエラー表示へ展開しない
        if (cells.some((value) => value.length > 4096)) { errors.push({ line, message: 'セルの値が長すぎます。分類用のCSV列を確認してください。' }); return; }
        // API列名と値を一度だけ対応付け
        const values = Object.fromEntries(header.map((name, position) => [name, cells[position].trim()]));
        // ラベルや大文字小文字の推測で項目を補完しない
        const apiName = values.FieldApiName;
        // 読取専用・不可視・存在しない項目は更新対象にしない
        const edit = Object.hasOwn(edits, apiName) ? edits[apiName] : undefined;
        // 同じAPI名の別オブジェクトへ反映しない
        if (values.ObjectApiName !== objectName) { errors.push({ line, message: '選択中のオブジェクトとObjectApiNameが一致しません。' }); return; }
        // 更新可能な同じ項目を一件だけ受け付ける
        if (seen.has(apiName)) { errors.push({ line, message: `${apiName}：重複した項目です。` }); return; }
        // 二重指定は内容の一致にかかわらず拒否
        seen.add(apiName);
        // 取得済みの読取専用行は、値の変更がない場合だけ読み飛ばす
        if (!edit) {
            // 未取得の行へ空の分類を補完しない
            const info = Object.hasOwn(classifications, apiName) ? classifications[apiName] : undefined;
            // 出力した読取専用行を再入力しても更新対象にはしない
            if (info && !info.editable && unchangedReadOnlyCsv(values, info)) { return; }
            // 読取専用行の変更や未取得の行はファイル全体のエラー
            errors.push({ line, message: `${apiName}：編集対象外の項目です。読取専用行は変更しないでください。` });
            // 別の入力へ変更を対応付けない
            return;
        }
        // 分類値は既存の入力・候補検証を共用
        const inputs = { complianceGroup: values.ComplianceGroup ? values.ComplianceGroup.split(';') : [], securityClassification: values.SecurityClassification, businessStatus: values.BusinessStatus };
        // 編集値だけを新しい行へ組み立てる
        const draft = {};
        // 選択肢にない値を空値へ変換しない
        for (const [key, value] of Object.entries(inputs)) {
            // 現在値の維持も通常の入力と同じ条件で許可
            const result = classificationInput(key, value, options, edit.original);
            // エラー行は保存対象へ反映しない
            if (!result.valid) { errors.push({ line, message: `${apiName}：${result.message}` }); return; }
            // 有効なAPI値だけを保持
            draft[key] = result.value;
        }
        // 表示名・15桁ID・別種別のIDを所有者として受け付けない
        const ownerId = values.BusinessOwnerId;
        // 空値は明示解除として受け付ける
        if (ownerId && !/^(005|00G)[a-zA-Z0-9]{15}$/u.test(ownerId)) { errors.push({ line, message: `${apiName}：所有者はユーザーまたは公開グループの18桁IDを指定してください。` }); return; }
        // すべての入力を確認できた同じ項目だけを追加
        rows.push({ line, apiName, draft, ownerId });
        // 既に同じIDを保持する所有者以外だけを問い合わせ
        if (ownerId && edit.owner.value !== ownerId && edit.originalOwner.value !== ownerId) { ownerIds.add(ownerId); }
    });
    // 空のCSVを成功した取り込みとして扱わない
    if (!rows.length && !errors.length) { errors.push({ line: 2, message: '更新対象の行がありません。' }); }
    // エラーがあれば候補解決も入力反映も行わない
    return { rows, errors, ownerIds: [...ownerIds] };
}

// IDで確認できた所有者とCSV行だけを既存の編集状態へ合成
export function applyClassificationCsv(rows, owners, edits, ownerRequest) {
    // 途中でエラーが発生しても元の入力を変更しない
    const next = { ...edits };
    // 所有者の不足を黙って未設定へ変換しない
    const errors = [];
    // 現在の選択位置ではなくCSVの項目API名で反映
    for (const row of rows) {
        // 同じ行の最新の編集状態だけを使用
        const state = edits[row.apiName];
        // 現在の所有者と同じIDなら同じ候補を維持
        const current = [state.owner, state.originalOwner].find((owner) => owner.value === row.ownerId);
        // APIで取得した実レコードとの対応だけを採用
        const owner = row.ownerId ? current || owners[row.ownerId] : { value: '', label: '' };
        // ID・表示名・有効状態が未確認ならその行を拒否
        if (!owner || owner.value !== row.ownerId || (row.ownerId && (typeof owner.label !== 'string' || !owner.label || (!current && typeof owner.active !== 'boolean'))) || (owner.active === false && state.originalOwner.value !== row.ownerId)) { errors.push({ line: row.line, message: `${row.apiName}：所有者を確認できないか、新しく指定できない所有者です。` }); continue; }
        // CSV対象外の行と入力基準は維持し、同じ行だけを新しい状態へ更新
        next[row.apiName] = { ...state, draft: row.draft, owner, ownerSearch: '', ownerOptions: createOwnerOptions([], owner), ownerOpen: false, complianceOpen: false, ownerActive: -1, ownerRequest, inputErrors: {}, error: '' };
    }
    // 全件の照合が完了するまで一件も入力へ反映しない
    return { edits: errors.length ? edits : next, errors };
}

// CSV全体の所有者数に関係なく一回の照合要求を一定に制限
export function classificationOwnerBatches(ids) {
    // 保存用の10項目分割とは別の読取単位を使用
    const size = CLASSIFICATION_CSV_LIMITS.owners;
    // 入力配列を変更せず順序を維持して分割
    return Array.from({ length: Math.ceil(ids.length / size) }, (_, index) => ids.slice(index * size, (index + 1) * size));
}

// 分割した要求と同じ所有者IDの応答だけを集約
export function mergeClassificationOwners(ids, response, previous) {
    // 不正なJSON形式を空の所有者集合として採用しない
    if (!response || typeof response !== 'object' || Array.isArray(response)) { throw new Error('所有者の確認結果の形式が不正です。'); }
    // 応答順による別IDへの対応付けを拒否
    const requested = new Set(ids);
    // 同じバッチのID・表示名・有効状態をすべて照合
    for (const [id, owner] of Object.entries(response)) {
        // 余分なIDや未確認の有効状態を採用しない
        if (!requested.has(id) || owner?.value !== id || typeof owner.label !== 'string' || !owner.label || typeof owner.active !== 'boolean') { throw new Error('所有者の確認結果が要求したIDと一致しません。'); }
    }
    // 全バッチが成功するまで元の編集状態へ反映しない
    return { ...previous, ...response };
}
