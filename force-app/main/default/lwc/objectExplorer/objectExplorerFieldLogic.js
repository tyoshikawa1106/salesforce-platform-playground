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
export function compareFieldLabels(a, b) {
    // ラベル未取得の呼出元でも項目の識別子を維持
    return (a.label || a.apiName).localeCompare(b.label || b.apiName, 'ja') || a.apiName.localeCompare(b.apiName);
}

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