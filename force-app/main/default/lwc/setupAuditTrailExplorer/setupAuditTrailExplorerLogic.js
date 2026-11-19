import TIME_ZONE from '@salesforce/i18n/timeZone';

// 月別・全期間で同じ順に列を出力する。
export const CSV_HEADER = '日付,ユーザー,ソースの名前空間プレフィックス,アクション,セクション,代理ユーザー\n';

// 月選択の基準を実行ユーザーの暦に合わせる。
export function currentMonth() {
    // 年と月を別々に取り出し、実行環境の日付順序に依存しないようにする。
    const parts = new Intl.DateTimeFormat('en', { year: 'numeric', month: '2-digit', timeZone: TIME_ZONE })
        .formatToParts(new Date());
    // 月選択値と同じ年・月形式に揃える。
    return parts.find(part => part.type === 'year').value + '-' + parts.find(part => part.type === 'month').value;
}

// 月をまたぐ移動先を計算する。
export function offsetMonth(month, offset) {
    // 月初を基準にして月末の日数差を避ける。
    const date = new Date(month + '-01T00:00:00Z');
    // 年境界も含めて指定月数だけ移動する。
    date.setUTCMonth(date.getUTCMonth() + offset);
    // 月選択に使う部分を取り出す。
    return date.toISOString().slice(0, 7);
}

// CSVの時刻を実行ユーザーのタイムゾーンで表し、時の先頭をゼロで埋めない。
const CSV_DATE_FORMAT = new Intl.DateTimeFormat('ja-JP', {
    calendar: 'gregory', timeZone: TIME_ZONE, timeZoneName: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric',
    minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});

// 明細・分析・CSVの次回取得に必要な境界だけを引き継ぐ。
export function pageCursor({ nextId, nextTime }) {
    // 同一日時の履歴を区別できるようIDと日時を組にする。
    return { nextId, nextTime };
}

// ユーザー以外の検索候補を履歴から収集する。
export const FILTER_OPTION_FIELDS = ['action', 'namespacePrefix', 'delegateUser'];

// 項目ごとに候補の重複を取り除く準備をする。
export function filterOptionGroups() {
    // ページ間で共有する集合を項目別に用意する。
    return Object.fromEntries(FILTER_OPTION_FIELDS.map(field => [field, new Set()]));
}

// 分析済みの履歴を検索候補にも利用する。
export function collectFilterOptions(groups, buckets) {
    // 各集計行から候補値を取り出す。
    for (const bucket of buckets) {
        // 検索可能な項目だけを調べる。
        for (const field of FILTER_OPTION_FIELDS) {
            // 未設定値は選択候補から外す。
            if (bucket[field]) {
                // 別の集計行にある同じ候補を一つにまとめる。
                groups[field].add(bucket[field]);
            }
        }
    }
}

// 収集済みの候補を画面用の並びに整える。
export function sortFilterOptions(groups) {
    // 項目ごとの集合を日本語の照合順に並べた配列へ変換する。
    return Object.fromEntries(FILTER_OPTION_FIELDS.map(field => [
        field, [...groups[field]].sort((left, right) => left.localeCompare(right, 'ja'))
    ]));
}

// 履歴の文字を一つのCSVセルに収める。
function csvCell(value) {
    // セル内の改行をLFに揃え、引用符を二重にして囲む。
    return '"' + String(value ?? '').replace(/\r\n?/g, '\n').replaceAll('"', '""') + '"';
}

// 両方の出力期間で同じ規則を使って明細ページを書き出す。
export function formatCsvPage(records) {
    // 同じ秒に続く履歴で日時の書式変換を共有する。
    let lastDate;
    // 直前の履歴に対応する日時文字列を保持する。
    let formattedDate;
    // 取得順を維持して各履歴を一行にする。
    return records.map(row => {
        // 日時が変わったときだけ変換し直す。
        if (row.CreatedDate !== lastDate) {
            // 次の履歴との比較に使う元の日時を保持する。
            lastDate = row.CreatedDate;
            // 秒とタイムゾーンを含む日時に整える。
            formattedDate = CSV_DATE_FORMAT.format(new Date(lastDate));
        }
        // アクションにはAPIが返した説明を使い、ユーザーには取得したログイン名を使う。
        return [formattedDate, row.CreatedBy?.Username, row.ResponsibleNamespacePrefix,
            row.Display, row.Section, row.DelegateUser].map(csvCell).join(',') + '\n';
    }).join('');
}

// 月内の日付を選択肢にする。
export function buildDateOptions(monthDate) {
    // 月末を算出するため月初をUTCで扱う。
    const firstDay = new Date(monthDate + 'T00:00:00Z');
    // 翌月の直前の日から月の日数を求める。
    const days = new Date(Date.UTC(firstDay.getUTCFullYear(), firstDay.getUTCMonth() + 1, 0)).getUTCDate();
    // 直近の日から選べる順に日付を並べる。
    const dates = Array.from({ length: days }, (_, index) =>
        monthDate.slice(0, 8) + String(days - index).padStart(2, '0')
    );
    // 日付を限定しない選択肢を先頭に加える。
    return [{ label: 'すべて', value: '' }, ...dates.map(value => ({ label: value, value }))];
}

// 各検索欄の表示値と候補を組み立てる。
export function buildFilterFields({ userOptions, userNames, filterOptions, selectedValues, lookupField, lookupTerm, lookupIndex }) {
    // ユーザー・名前空間・操作・代理ユーザーに対応する欄を作る。
    return [
        { key: 'userId', label: 'ユーザー', values: Object.keys(userOptions) },
        { key: 'namespacePrefix', label: '名前空間プレフィックス', values: filterOptions?.namespacePrefix },
        { key: 'action', label: 'アクション', values: filterOptions?.action },
        { key: 'delegateUser', label: '代理ユーザー', values: filterOptions?.delegateUser }
    ].map(({ key, label, values }) => {
        // 候補値から画面に表示するラベルを選ぶ。
        const labelFor = value => {
            // ユーザー欄はIDから表示名を解決する。
            if (key === 'userId') {
                // 候補が持つ最も具体的な名前を使う。
                return userNames[value] || userOptions[value] || value;
            }
            // その他の項目は候補値をそのまま表示する。
            return value;
        };
        // 項目別の選択値を取り出す。
        const selected = selectedValues[key];
        // 閉じている欄は選択状態だけを表示する。
        if (lookupField !== key) {
            // 選択した値と解除操作のラベルを組み立てる。
            return {
                key, label, open: false, selected: Boolean(selected),
                inputValue: selected ? labelFor(selected) : '',
                clearLabel: label + 'の選択を解除',
                selectedIcon: key === 'userId' ? 'standard:user' : 'standard:custom'
            };
        }

        // 大文字小文字と前後の空白を無視して検索する。
        const term = lookupTerm.trim().toLocaleLowerCase();
        // 未取得の項目も空の候補として扱う。
        const candidates = values ?? [];
        // ラベルに加えユーザーはIDとログイン名でも探せるようにする。
        const matches = term
            ? candidates.filter(value => labelFor(value).toLocaleLowerCase().includes(term) ||
                (key === 'userId' && (value.toLocaleLowerCase().includes(term) ||
                    userOptions[value]?.toLocaleLowerCase().includes(term))))
            : candidates;
        // 入力欄と候補一覧を関連付ける。
        const listId = key + '-options';
        // 開いた欄の表示とキーボードの選択状態を組み立てる。
        return {
            key, label, open: true, listId,
            inputValue: lookupTerm,
            activeId: lookupIndex >= 0 ? listId + '-' + lookupIndex : undefined,
            noMatches: Boolean(filterOptions) && matches.length === 0,
            options: matches.map((value, index) => ({
                label: labelFor(value),
                code: key === 'userId' ? value : '',
                value,
                id: listId + '-' + index,
                active: index === lookupIndex,
                className: 'slds-listbox__option slds-listbox__option_entity slds-media slds-media_small' +
                    (index === lookupIndex ? ' slds-has-focus' : '')
            }))
        };
    });
}

// ページ境界をまたぐ集計を同じ軸ごとに統合する。
export function mergeChartPage(totals, buckets) {
    // 今回の集計ページをこれまでの結果に統合する。
    for (const bucket of buckets) {
        // 日・ユーザー・操作・セクション・名前空間・代理ユーザーで集計を区別する。
        const key = JSON.stringify([
            bucket.day, bucket.userId, bucket.action, bucket.section, bucket.namespacePrefix, bucket.delegateUser
        ]);
        // 同じ集計軸の取得済み結果を探す。
        const previous = totals.get(key);
        // 前のページにも同じ集計があるか確認する。
        if (previous) {
            // ページをまたぐ同じ集計に件数を加算する。
            previous.count += bucket.count;
        } else {
            // 初出の集計行を応答から複製して保持する。
            totals.set(key, { ...bucket });
        }
    }
}
