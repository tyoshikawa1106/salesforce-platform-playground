import { classifyInput, normalizeClassify, createOwnerOptions } from './objectExplorerClassifyLogic';
import { compareFieldLabels, fieldTypeLabel, fieldTypeGroup } from './objectExplorerFieldLogic';

// 項目定義の取得時だけ整列・型名加工・検索文字列の生成を行う
function indexFields(fields) {
    // 検索条件で順番が変わらない索引を元データとは別に保持
    return [...fields].sort(compareFieldLabels).map((field) => ({
        field: { ...field, typeLabel: fieldTypeLabel(field) },
        type: fieldTypeGroup(field), label: field.label.toLowerCase(), apiName: field.apiName.toLowerCase()
    }));
}
// 対象と検索条件が同じなら整列済みの結果と型候補を再利用
export function fieldListView(fields, search, type, previous, classifyData) {
    // 分類値の変更では項目定義と検索条件は変わらない
    if (previous?.source === fields && previous.search === search && previous.type === type && previous.classifyData === classifyData) { return previous; }
    // 入力のたびに全項目を整列・加工せず取得時の索引を共有
    const reusable = previous?.source === fields && previous.classifyData === classifyData;
    // 分類モードでは項目自体が編集可能な定義だけを一覧へ含める
    const index = reusable ? previous.index : indexFields(classifyData ? fields.filter((field) => classifyData[field.apiName]?.editable) : fields);
    // 型候補も加工済みの索引から一度だけ生成
    const typeOptions = reusable ? previous.typeOptions : [{ label: 'すべてのデータ型', value: '' },
        ...[...new Set(index.map((entry) => entry.type))].sort((a, b) => a.localeCompare(b, 'ja')).map((value) => ({ label: value, value }))];
    // 検索語は各項目の比較前に一度だけ正規化
    const needle = (search || '').trim().toLowerCase();
    // 絞り込みでも整列済みの順序と項目モデルを維持
    const rows = index.filter((entry) => (!type || entry.type === type) && (entry.label.includes(needle) || entry.apiName.includes(needle))).map((entry) => entry.field);
    // 依存元と索引を同じモデルで管理し、別オブジェクトの値を持ち越さない
    return { source: fields, search, type, index, rows, typeOptions, classifyData };
}

// 保存可否と未保存確認に必要な件数を一回の走査で集計
export function classifySummary(edits) {
    // 件数と対象のAPI名を同じ結果へまとめる
    const result = { changeCount: 0, inputErrorCount: 0 };
    // 同じ行の変更判定を集計と絞り込みで共有
    for (const state of Object.values(edits)) {
        // 分類値と所有者IDの比較は各行で一度だけ行う
        const changed = classifyChanged(state);
        // 未確定入力は変更件数と分けて数える
        const invalid = hasInvalidClassifyInput(state);
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

// 一覧取得時の分類と所有者IDを基準に、未変更の入力状態を一括生成
export function createClassifyEdits(rows) {
    return Object.fromEntries(Object.entries(rows).filter(([, row]) => row.editable && typeof row.ownerId === 'string' && typeof row.ownerLabel === 'string')
        .map(([apiName, row]) => {
            const original = normalizeClassify(row);
            const owner = { value: row.ownerId, label: row.ownerLabel };
            return [apiName, { original, draft: { ...original }, originalOwner: owner, owner, ownerOptions: createOwnerOptions([], owner), ownerSearch: '', error: '' }];
        }));
}
// 元の値へ戻した行を保存対象から除外
export function classifyChanged(state) {
    // 編集開始前の行を変更ありと扱わない
    if (!state?.original) { return false; }
    // 候補を比較する前に分類の並びと空値を揃える
    const original = normalizeClassify(state.original);
    // 同じ変換を項目ごとに繰り返さない
    const draft = normalizeClassify(state.draft);
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
function classifyResult(apiName, state, classify, result) {
    // 選択位置や表示名による別項目への対応付けを拒否
    if (!state || result?.apiName !== apiName) { throw new Error('保存結果の対象項目を確認できませんでした。'); }
    // 失敗した行は値と基準値を保持して理由だけを更新
    if (!result.success) { return { edit: { ...state, error: result.message }, classify }; }
    // 保存後にサーバーがIDを照合した候補だけを採用
    const owner = result.owner;
    // 所有者が別のIDなら成功として反映しない
    if (!owner || owner.value !== state.owner.value || !owner.label) { throw new Error('保存後の所有者を確認できませんでした。'); }
    // 再取得できた分類値を次の編集の基準へ揃える
    const latest = normalizeClassify(result.latest);
    // 現在値の候補を重複させず、検索結果を維持
    const ownerOptions = createOwnerOptions(state.ownerOptions.filter((option) => option.value !== owner.value && option.value !== ''), owner);
    // 編集行と保存済みの表示値を同じ結果から更新
    return { edit: { ...state, original: latest, draft: { ...latest }, originalOwner: owner, owner, ownerOptions, error: '' },
        classify: { ...classify, ...latest, ownerId: owner.value, ownerLabel: owner.label } };
}

// ページ表示に必要な分類と編集状態を項目へ合成
function classifyRow(field, context) {
    // 表示モデルと再利用判定で同じ入力を使用
    const { classifyData, edits, options, canEdit } = context;
    // 分類未取得を空の分類値と混同しない
    const info = classifyData[field.apiName];
    // 入力中の値はページ移動後も同じAPI名へ結び付ける
    const edit = canEdit ? edits[field.apiName] : undefined;
    // 編集開始済みの行では最新取得した値を表示
    const values = edit?.draft || info || {};
    // 複数選択を個別の値へ戻す
    const compliance = (values.complianceGroup || '').split(';').filter(Boolean);
    // 既存の無効値も表示できるよう基準値を候補へ含める
    const original = edit?.original || values;
    // ハイライトと読み上げで同じ変更判定を使う
    const changed = classifyChanged(edit);
    // ハイライトとエラー表示で同じ入力状態を使う
    const inputErrors = Object.values(edit?.inputErrors || {}).filter(Boolean);
    // ラベル・型と分類の表示状態をまとめる
    return { ...field, ...values, editing: Boolean(edit),
        reason: !canEdit && info?.editable ? '変更には「データ分類の変更」または「オブジェクトのカスタマイズ」権限が必要です。' : info?.reason === '分類情報を設定できない項目です。' ? '' : info?.reason || '',
        rowClass: changed || inputErrors.length ? 'oe-classify-changed' : '', changed, complianceValues: compliance, unavailable: !info,
        complianceOpen: Boolean(edit?.complianceOpen), compliancePopupId: `compliance-${field.apiName}`, compliancePopupClass: edit?.complianceAbove ? 'slds-dropdown slds-dropdown_fluid slds-dropdown_bottom oe-compliance-options' : 'slds-dropdown slds-dropdown_fluid oe-compliance-options',
        complianceOptions: includeCurrentOptions(options.ComplianceGroup, (original.complianceGroup || '').split(';')),
        securityOptions: [{ label: '-- なし --', value: '' }, ...includeCurrentOptions(options.SecurityClassification, [original.securityClassification])],
        businessOptions: [{ label: '-- なし --', value: '' }, ...includeCurrentOptions(options.BusinessStatus, [original.businessStatus])],
        // 空値は候補ラベルを入力欄へ表示せず、保存用の空文字とは分ける
        securityInputValue: values.securityClassification || undefined, businessInputValue: values.businessStatus || undefined,
        complianceLabel: compliance.length ? compliance.map((value) => choiceLabel(value, options.ComplianceGroup)).join(',') : '',
        securityLabel: choiceLabel(values.securityClassification, options.SecurityClassification), businessLabel: choiceLabel(values.businessStatus, options.BusinessStatus),
        ...ownerLookupView(field.apiName, edit, info),
        // 編集不可の分類欄は空値と区別して同じ文言で表示
        ...(!edit ? { complianceLabel: '設定不可', securityLabel: '設定不可', businessLabel: '設定不可', ownerLabel: '設定不可' } : {}), error: inputErrors.join(' / ') || edit?.error || '' };
}
// 表示中のページだけ保持し、変更のない分類行は選択肢と所有者表示を再利用
export function classifyFieldView(context, previous) {
    // 項目定義・分類値・編集状態を同じAPI名へ対応付ける
    const { fields, classifyData, edits, options, canEdit } = context;
    // ページ外の行を蓄積せず、現在表示する行だけを次のキャッシュにする
    const entries = new Map();
    // 各行の依存元が変わった場合だけ表示モデルを作り直す
    const rows = fields.map((field) => {
        // 権限がない状態では編集値を表示へ混ぜない
        const edit = canEdit ? edits[field.apiName] : undefined;
        // 分類読取・保存後の値もキャッシュの一致条件に含める
        const info = classifyData[field.apiName];
        // 同じページ内の直前の行だけを参照
        const cached = previous?.entries.get(field.apiName);
        // 候補定義や編集権限が変わった場合はすべての行を更新
        const entry = previous?.options === options && previous.canEdit === canEdit && cached?.field === field && cached.edit === edit && cached.info === info
            ? cached : { field, edit, info, row: classifyRow(field, context) };
        // 行番号ではなくAPI名で再利用先を固定
        entries.set(field.apiName, entry);
        // 変更されていない行は同じ表示モデルを返す
        return entry.row;
    });
    // 次回の比較に必要なページ内の依存元だけ保持
    return { entries, rows, options, canEdit };
}

// 保存に必要な変更行だけをAPI名とIDから生成
export function classifyChanges(edits) {
    // 保存対象をページや検索条件から独立して抽出
    return Object.entries(edits).filter(([, state]) => classifyChanged(state)).map(([apiName, state]) => {
        // 比較用の順序と空値を統一
        const original = normalizeClassify(state.original);
        // 同じ正規化を編集値にも適用
        const normalizedDraft = normalizeClassify(state.draft);
        // 保存に必要な分類と所有者IDだけを送信し、識別名や表示名は含めない
        const draft = { complianceGroup: normalizedDraft.complianceGroup, securityClassification: normalizedDraft.securityClassification, businessStatus: normalizedDraft.businessStatus, ownerId: state.owner.value };
        // 表示用の明細を組み立てず保存用の基準値と変更値だけを返す
        return { apiName, original: { ...original, ownerId: state.originalOwner.value }, draft };
    });
}

// 一つの入力を修正しても他の未確定入力を解除しない
export function hasInvalidClassifyInput(state) {
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
export function classifyBatches(changes) {
    // 最後の端数も同じ保存経路へ渡す
    return Array.from({ length: Math.ceil(changes.length / 10) }, (_, index) => changes.slice(index * 10, (index + 1) * 10));
}

// 応答順を使わず項目API名で一括保存結果を適用
export function applyClassifyBatch(changes, edits, classifyData, results) {
    // 件数違いを部分成功として扱わない
    if (!Array.isArray(results) || results.length !== changes.length) { throw new Error('保存結果の件数が一致しません。最新状態を確認してください。'); }
    // 未定義や文字列の成否を成功・失敗へ暗黙変換しない
    if (results.some((result) => typeof result?.apiName !== 'string' || typeof result.success !== 'boolean')) { throw new Error('保存結果の形式を確認できませんでした。最新状態を確認してください。'); }
    // 重複や別の項目の結果を更新行へ対応づけない
    const index = new Map(results.map((result) => [result.apiName, result]));
    // 要求と応答の完全な対応を先に確認
    if (index.size !== changes.length || changes.some((change) => !index.has(change.apiName))) { throw new Error('保存結果の対象項目が一致しません。最新状態を確認してください。'); }
    // 全体のコピーはバッチごとに一度だけ作り、入力の参照を変更しない
    const next = { edits: { ...edits }, classifyData: { ...classifyData }, successCount: 0, failureCount: 0 };
    // 各結果は同じAPI名の行だけを生成
    for (const change of changes) {
        // 応答の並びではなく要求の識別子で取得
        const result = index.get(change.apiName);
        // 所有者と対象の照合に失敗した場合はバッチ全体を返さない
        const updated = classifyResult(change.apiName, edits[change.apiName], classifyData[change.apiName], result);
        // 元データとは別のMapへ変更された行だけを反映
        next.edits[change.apiName] = updated.edit;
        // 失敗行の保存済み値は元の参照を維持
        next.classifyData[change.apiName] = updated.classify;
        // 成否はサーバーで確認できた項目だけ集計
        next.successCount += Number(result.success);
        // 確認済みの拒否を失敗件数へ加算
        next.failureCount += Number(!result.success);
    }
    // すべての検証が完了した一括結果だけを画面へ渡す
    return next;
}

export { classifyInput, normalizeClassify, createOwnerOptions };
export { structureFieldView } from './objectExplorerFieldLogic';
export { CLASSIFY_CSV_LIMITS, classifyOwnerBatches, mergeClassifyOwners, classifyCsv, structureCsv, csvFileName, readClassifyCsv, applyClassifyCsv } from './objectExplorerCsv';
// エラーの位置だけを抽出し、URL・入力値・API応答本文を診断情報へ含めない
export function clientErrorDetails(error, operation, phase) {
    // 例外種別は通常のError名だけを採用
    const name = typeof error?.name === 'string' && /^(?:Error|[A-Za-z]+Error)$/.test(error.name) ? error.name : (error?.body ? 'SalesforceError' : 'Error');
    // メッセージやURLから推測せず、スタック上のJSファイル名と行・列だけを抽出
    const frames = typeof error?.stack === 'string' ? [...new Set(error.stack.split('\n').slice(1).flatMap((line) => line.match(/[A-Za-z0-9_$.-]+\.m?js:\d+:\d+/g) || []))].slice(0, 8) : [];
    // 処理場所は呼び出し側が指定する固定の処理名と段階で識別
    return { location: `objectExplorer.js / ${operation} / ${phase}`, errorType: name, frames, frame: frames[0] || '' };
}
