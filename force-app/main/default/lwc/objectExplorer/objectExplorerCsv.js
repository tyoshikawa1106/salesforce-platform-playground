import { classifyInput, normalizeClassify, createOwnerOptions } from './objectExplorerClassifyLogic';
import { compareFieldLabels, structureRows } from './objectExplorerFieldLogic';

// 出力と読取で同じ列名・順序を使用し、表示ラベルで項目を推測しない
const CLASSIFY_CSV_COLUMNS = ['ObjectLabel', 'ObjectApiName', 'FieldLabel', 'FieldApiName', 'ComplianceGroup', 'SecurityClassification', 'BusinessStatus', 'BusinessOwnerId'];
// 出力用の日本語列と内部のAPI列を同じ位置で対応付ける
const CLASSIFY_CSV_LABELS = ['オブジェクトラベル', 'オブジェクトAPI名', '項目ラベル', '項目API名', 'コンプライアンス分類', 'データ機密度', '項目の利用状況', 'データ所有者ID'];
// ブラウザの入力検証とDOMのエラー表示を一定の規模へ制限
export const CLASSIFY_CSV_LIMITS = Object.freeze({ rows: 10000, bytes: 5 * 1024 * 1024, owners: 500 });

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
    return `${objectName}-${isReference ? 'fields' : 'classify'}-${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}.csv`;
}

// BOMと引用符で文字コード・セル境界・改行を保持
function encodeCsv(rows) {
    // falseや0もそのまま出力し、引用符だけをエスケープ
    return '\uFEFF' + rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
}

// 編集可能な項目をページ・検索条件から独立して出力
export function classifyCsv(objectName, fields, classifyData, edits, objectLabel = objectName) {
    // 一覧と同じ編集可否で分類未取得・編集不可を除外
    const rows = fields.filter((field) => classifyData[field.apiName]?.editable).sort(compareFieldLabels).map((field) => {
        // 同じAPI名の取得済み分類を出力の基準にする
        const info = classifyData[field.apiName];
        // 編集中の行は入力値、それ以外は取得値を使用
        const values = edits[field.apiName]?.draft || info;
        // 所有者の表示名ではなく同じ行のIDを出力
        const ownerId = edits[field.apiName]?.owner.value ?? info.ownerId ?? '';
        // 項目一覧にある全対象をAPI名のまま保持
        return [objectLabel, objectName, field.label || field.apiName, field.apiName, values.complianceGroup, values.securityClassification, values.businessStatus, ownerId];
    });
    // Excelでも文字コードとセル境界を維持できるようBOMと引用符を付与
    return encodeCsv([CLASSIFY_CSV_LABELS, ...rows]);
}

// 読取専用行は保存済み分類と所有者IDが同じ場合だけ読み飛ばす
function unchangedReadOnlyCsv(values, info) {
    // 空欄と複数分類の並び順を通常の編集と同じ基準で比較
    const original = normalizeClassify(info);
    // CSVのAPI値を取得済み値へ正規化して照合
    const current = normalizeClassify({ complianceGroup: values.ComplianceGroup, securityClassification: values.SecurityClassification, businessStatus: values.BusinessStatus });
    // 表示名による所有者の同一視を行わない
    return ['complianceGroup', 'securityClassification', 'businessStatus'].every((key) => original[key] === current[key]) && values.BusinessOwnerId === (info.ownerId || '');
}

// 引用符・改行・BOMを扱い、壊れたCSVを別の列へ対応付けない
function parseClassifyCsv(text) {
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
        if (rows.length > CLASSIFY_CSV_LIMITS.rows + 1) { throw new Error(`CSVは${CLASSIFY_CSV_LIMITS.rows}行以内にしてください。`); }
        // 空行を含む元のCSVレコード番号を次の行へ引き継ぐ
        line += 1;
        // 次の行の列を独立して保持
        cells = [];
    }
    // 空行は内容を持つレコードと区別したまま返却
    return rows;
}

// CSV全体を先に検証し、別の対象・重複・未知の値は一件も反映しない
export function readClassifyCsv(text, objectName, edits, options, classifyData = {}, fields = []) {
    // ファイル形式の不正は行データへ補完しない
    const parsed = parseClassifyCsv(text);
    // 日本語ヘッダーと既存のAPIヘッダーを固定対応で正規化
    const header = (parsed.shift()?.cells || []).map((value) => {
        // 任意の表示名から列を推測しない
        const name = value.trim();
        // 正式な日本語列だけを内部のAPI列へ変換
        const index = CLASSIFY_CSV_LABELS.indexOf(name);
        // 重複は正規化後に検出し、後勝ちで対応付けない
        return index < 0 ? name : CLASSIFY_CSV_COLUMNS[index];
    });
    // 表示用ラベル列は省略可能とし、既存の6列CSVも受け付ける
    const required = CLASSIFY_CSV_COLUMNS.filter((name) => !['ObjectLabel', 'FieldLabel'].includes(name));
    // 未知の列・重複列・更新に必要な列の不足を拒否
    if (new Set(header).size !== header.length || header.some((name) => !CLASSIFY_CSV_COLUMNS.includes(name)) || required.some((name) => !header.includes(name))) { throw new Error(`CSVの列は ${CLASSIFY_CSV_LABELS.join(', ')} にしてください。`); }
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
            const info = Object.hasOwn(classifyData, apiName) ? classifyData[apiName] : undefined;
            // 既知の設定不可項目だけ表示用の値を読み飛ばす
            const known = Boolean(info) || fields.some((field) => field.apiName === apiName);
            if (known && !info?.editable && CLASSIFY_CSV_COLUMNS.slice(4).every((key) => values[key] === '設定不可')) { return; }
            // 旧形式の取得値を含むCSVとの互換性を維持
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
            const result = classifyInput(key, value, options, edit.original);
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
export function applyClassifyCsv(rows, owners, edits, ownerRequest) {
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
export function classifyOwnerBatches(ids) {
    // 保存用の10項目分割とは別の読取単位を使用
    const size = CLASSIFY_CSV_LIMITS.owners;
    // 入力配列を変更せず順序を維持して分割
    return Array.from({ length: Math.ceil(ids.length / size) }, (_, index) => ids.slice(index * size, (index + 1) * size));
}

// 分割した要求と同じ所有者IDの応答だけを集約
export function mergeClassifyOwners(ids, response, previous) {
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