// コピー元から新規側に固定で引き継ぐユーザー設定
const LOCKED = new Set(['ProfileId', 'UserRoleId', 'UserLicenseId']);
// 日本語表示ラベルを基準にし、同一ラベルの場合も順序を安定させる
const collator = new Intl.Collator('ja', { numeric: true });

// 両側に同じ順序の見出しと項目を配置
function getEntries(fields) {
    // サーバーが返した標準ユーザー画面の項目順を維持
    const standardGroups = new Map();
    // 任意機能で追加された標準項目も最初の同名グループにまとめる
    for (const field of fields.filter((item) => !item.custom)) {
        // 標準画面の順に初めて現れたグループを登録
        if (!standardGroups.has(field.groupLabel)) standardGroups.set(field.groupLabel, []);
        // 見出しの重複を避けて項目を追加
        standardGroups.get(field.groupLabel).push(field);
    }
    // グループ内の順序を保持して共通の行配列にする
    const standard = [...standardGroups.values()].flat();
    // 組織固有のカスタム項目は表示ラベルの日本語順で配置
    const custom = fields.filter((field) => field.custom).sort((a, b) => collator.compare(a.label, b.label) || a.apiName.localeCompare(b.apiName));
    // 見出しを含む共通の行順を作成
    const entries = [];
    // 各セクションに所属する項目を出力
    for (const [label, items] of [['標準項目', standard], ['カスタム項目', custom]]) {
        // 各列で同じ位置にセクション名を表示
        entries.push({ key: label, title: label, section: true });
        // 空のセクションは参照可能な項目がないことを示す
        if (!items.length) entries.push({ key: label + '-empty', empty: true });
        // 標準画面内の小見出しを連続する項目間で共有
        let previousGroup;
        // 左右それぞれの入力形式は後で組み立てる
        for (const field of items) {
            // 標準のグループが切り替わる位置に見出しを挿入
            if (!field.custom && field.groupLabel && field.groupLabel !== previousGroup) {
                // 同名グループが別の位置にあってもキーを一意に保つ
                entries.push({ key: 'group-' + field.apiName, title: field.groupLabel, group: true });
            }
            // 次の項目とのグループ境界を判断するために保持
            previousGroup = field.groupLabel;
            // 組織が返した型・表示名・アクセス権を保持
            entries.push({ key: field.apiName, field });
        }
    }
    // 両列が共有する配置を返す
    return entries;
}

// コピー元・新規ユーザーごとの表示値と編集部品を選択
function makeCell(field, source, draft, deactivate, originalController) {
    // ライセンス、プロファイル、ロールは保存時もサーバーがコピー元から決定
    const fixed = LOCKED.has(field.apiName);
    // コピー元の有効状態は無効化オプションによってのみ変更
    const active = field.apiName === 'IsActive';
    const pendingDeactivation = source && active && deactivate;
    // 元側は明示的に編集を許可した場合だけ入力部品へ切り替える
    const editable = !fixed && !active && (source ? deactivate && field.canUpdate : field.canCreate) && field.type !== 'readonly';
    // 未入力と利用者が明示的に空にした値を区別
    const raw = Object.hasOwn(draft, field.apiName) ? draft[field.apiName] : source ? field.value : null;
    // 元の設定に影響する操作を読み取り欄に反映
    const display = field.displayValue ?? field.value;
    const type = field.type;
    // チェックを外した状態も有効な入力値として扱う
    const required = editable && type !== 'checkbox' && field.required;
    // 標準選択リストの任意項目は明示的な解除も許容
    let choices = field.options || [];
    if (field.controllerName) {
        const dependency = field.dependency;
        let controller = Object.hasOwn(draft, field.controllerName) ? draft[field.controllerName] : source ? originalController : null;
        if (source && deactivate && field.controllerName === 'IsActive') controller = false;
        const index = dependency?.controllerValues?.[String(controller)];
        choices = dependency?.values.filter(option => option.validFor.includes(index)) || [];
    }
    // 多値項目の保存形式と画面上の配列を変換
    const value = type === 'multipicklist' ? String(raw ?? '').split(';').filter(Boolean) : raw == null ? null : String(raw);
    // 保存済みの候補外値を明示し、選び直すか解除できるようにする。
    const selected = type === 'multipicklist' ? value : [value];
    const unavailable = editable && (type === 'picklist' || type === 'multipicklist')
        ? selected.filter(item => item && !choices.some(choice => choice.value === item)) : [];
    const invalidChoice = unavailable.length > 0 && (!source || Object.hasOwn(draft, field.apiName) || Object.hasOwn(draft, field.controllerName)
        || field.controllerName === 'IsActive' && deactivate);
    choices = choices.concat(unavailable.map(item => ({ label: item + '（選択対象外）', value: item })));
    // 列の入力可否、型と表示値をまとめて返す
    return {
        key: field.apiName, name: field.apiName, label: field.label, value, required,
        display: (source || fixed) && display != null && display !== '' ? String(display) : '—',
        readOnly: !editable, readOnlyCheckbox: !editable && type === 'checkbox' && raw != null, checkbox: type === 'checkbox',
        pendingDeactivation, checked: !pendingDeactivation && String(raw) === 'true',
        richText: field.richText, invalidChoice, picklist: type === 'picklist', multi: type === 'multipicklist', textarea: type === 'textarea',
        reference: type === 'reference' && !field.referenceIdInput, referenceTo: field.referenceTo,
        idInput: type === 'referenceId' || (type === 'reference' && field.referenceIdInput),
        options: editable && type === 'picklist' && !required ? [{ label: '未選択', value: '' }, ...choices] : choices,
        inputType: type === 'datetime' ? 'datetime' : type,
        step: type === 'number' ? String(10 ** -(field.scale || 0)) : undefined,
        maxLength: field.maxLength > 0 ? field.maxLength : undefined
    };
}

// 新規作成で設定できる値だけを元ユーザーの保存値から取り込む
export function initialTargetValues(fields) {
    // 空にできる項目は null を明示して、作成時の既定値による置き換えを防ぐ
    return Object.fromEntries(fields
        .filter((field) => field.canCreate && field.type !== 'readonly' && !LOCKED.has(field.apiName) && (field.value != null || field.nillable))
        .map((field) => [field.apiName, field.type === 'checkbox' ? field.apiName === 'IsActive' || String(field.value) === 'true' : field.value ?? null]));
}

// 見出しをまたがず、同じ区分の連続した項目を横に2つずつ並べる
export function buildFieldLines(fields) {
    // 左右共通の行順を組み立てる
    const lines = [];
    const originals = new Map(fields.map(field => [field.apiName, field.value]));
    // 見出しと空の案内は単独で一行を使う
    for (const entry of getEntries(fields)) {
        // 直前の行に相方のない項目があれば隣に配置する
        if (entry.field?.controllerName) entry.originalController = originals.get(entry.field.controllerName);
        const previous = lines[lines.length - 1];
        // 複数選択リストは候補と選択済みの二つの欄で一行を使う。
        const paired = Boolean(entry.field) && entry.field.type !== 'multipicklist';
        if (paired && previous?.paired && previous.entries.length === 1) {
            previous.entries.push(entry);
        } else {
            // 最初の項目のキーを行の識別にも使う
            lines.push({ key: entry.key, paired, entries: [entry] });
        }
    }
    // 各パネルで同じ組み合わせを利用する
    return lines;
}

// 共通の項目配置から、指定した側の表示値と入力部品を構築
export function buildPanel(lines, side, draft, deactivate = false) {
    // コピー元を編集できる条件は無効化の選択に従う
    const source = side === 'source';
    return {
        side, label: source ? 'コピー元ユーザー' : '新規ユーザー',
        panelClass: 'c-panel c-' + side + ' slds-box slds-theme_default',
        rows: lines.map((line) => ({
            key: line.key,
            className: line.paired ? 'c-field-pair' : undefined,
            cells: line.entries.map((entry) => (entry.field ? makeCell(entry.field, source, draft, deactivate, entry.originalController) : entry))
        }))
    };
}

// 画面操作の型に合わせて保存用の値へ正規化
export function getDraftValue(value) {
    // 多値選択は Salesforce の保存形式にそろえる
    return Array.isArray(value) ? value.join(';') : value === '' ? null : value;
}

// 入力画面と同じ順序で対象ユーザーの識別情報と作成後の状態を表示する。
function confirmationUserRows(user, active) {
    // 日本語画面では姓・名の順に並べ、未入力の名前部分は省く。
    const name = [user.LastName, user.FirstName, user.MiddleName, user.Suffix].filter(Boolean).join(' ');
    return [
        { label: '氏名', value: name || '—' },
        { label: 'メール', value: user.Email || '—' },
        { label: 'ユーザー名', value: user.Username || '—' },
        { label: '有効', checkbox: active != null, checked: active, value: '参照不可' }
    ];
}

// 確認時点の編集内容を固定し、対象と権限を区分ごとに表示する。
export function buildConfirmationSections(fields, sourceDraft, target, options) {
    // 無効化するときは、保存が予定されているコピー元の変更も示す。
    const source = Object.fromEntries(fields.map(field => [field.apiName, field.value]));
    if (options.deactivateSource) Object.assign(source, sourceDraft);
    const sourceActive = source.IsActive == null ? null : String(source.IsActive) === 'true';
    return [
        { title: 'コピー元ユーザー', rows: confirmationUserRows(source, options.deactivateSource ? false : sourceActive),
            deactivating: options.deactivateSource },
        { title: '新規ユーザー', rows: [
            ...confirmationUserRows(target, true),
            { label: 'パスワードリセットメール', value: options.sendResetEmail ? '送信する' : '送信しない' }
        ] },
        { title: '権限の引き継ぎ', rows: [
            { label: '権限セット', value: options.copyPermissionSets ? '引き継ぐ' : '引き継がない' },
            { label: '権限セットグループ', value: options.copyPermissionSetGroups ? '引き継ぐ' : '引き継がない' }
        ] }
    ];
}