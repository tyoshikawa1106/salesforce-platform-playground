import TIME_ZONE from '@salesforce/i18n/timeZone';

// 一覧の取得件数、照合の区切り、表示行番号に共通のページサイズを使う。
export const PAGE_SIZE = 1000;

// 月別・6ヶ月間で同じ順に列を出力する。
export const CSV_HEADER = '日付,ユーザー,ソースの名前空間プレフィックス,アクション,セクション,代理ユーザー\n';

// 対象月と代理ログインの集計日に、実行ユーザーの暦と同じ年月日を使う。
const DAY_FORMAT = new Intl.DateTimeFormat('en', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TIME_ZONE
});

function localDay(date) {
    // 表示用の並び順や区切り文字に依存せず、Apex の Date と同じキーにする。
    const parts = DAY_FORMAT.formatToParts(date);
    return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
}

export function currentMonth() {
    return localDay(new Date()).slice(0, 7);
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

// 一致行を取り込んだ後の一覧ページの境界を決める。まだ表示件数が足りなければ次の元ページを待つ。
export function matchPageBoundary(records, placesLeft, sourceCursor) {
    // このバッチ内に次の一致行があれば、最後に表示する行の直後から再開できる。
    if (records.length > placesLeft) {
        // 作成日時が同じ履歴をID順に区別する。
        const last = records[placesLeft - 1];
        return { next: { nextId: last.Id, nextTime: last.CreatedDate }, probe: null };
    }
    // 元データの終端なら、表示件数にかかわらず次ページはない。
    if (!sourceCursor.nextId) return { next: {}, probe: null };
    // ちょうど満杯なら表示を先に行い、その先に一致行があるかを調べる。
    if (records.length === placesLeft) return { next: {}, probe: sourceCursor };
    // 一致行が不足しているので、次の元ページからもこの表示ページに取り込む。
    return null;
}

// 取得中の削除・重複・取り違えを表示前に検出するため、件数と各位置のIDを照合する。
export function sameRecordIds(ids, records) {
    return ids.length === records.length && ids.every((id, index) => id === records[index].Id);
}

// 開始境界が直近の照合範囲内なら、その直後に続く一致行を返す。
export function remainingMatchRecords(batch, start) {
    if (!batch) {
        return undefined;
    }
    if (start.nextId === batch.start.nextId && start.nextTime === batch.start.nextTime) {
        return batch.records;
    }
    if (start.nextId) {
        const index = batch.records.findIndex(row => row.Id === start.nextId && row.CreatedDate === start.nextTime);
        if (index >= 0) {
            return batch.records.slice(index + 1);
        }
    }
    return undefined;
}

// ユーザー以外の検索候補を履歴から収集する。
export const FILTER_OPTION_FIELDS = ['action', 'namespacePrefix', 'section', 'delegateUser'];

// 項目ごとに候補の重複を取り除く準備をする。
export function filterOptionGroups() {
    // ページ間で共有する集合を項目別に用意する。
    return Object.fromEntries(FILTER_OPTION_FIELDS.map(field => [field, new Set()]));
}

// 分析済みの履歴を検索候補にも利用する。
export function collectFilterOptions(buckets) {
    // 項目候補とユーザーの検索情報を同じ走査で集める。
    const groups = filterOptionGroups();
    const userOptions = {};
    const userNames = {};
    // 各集計行から候補値を取り出す。
    for (const bucket of buckets) {
        // ログイン名と表示名は取得できたものを個別に保持する。
        if (bucket.userId && bucket.loginName) {
            userOptions[bucket.userId] = bucket.loginName;
        }
        if (bucket.userId && bucket.userName) {
            userNames[bucket.userId] = bucket.userName;
        }
        // 検索可能な項目だけを調べる。
        for (const field of FILTER_OPTION_FIELDS) {
            // 未設定値は選択候補から外す。
            if (bucket[field]) {
                // 別の集計行にある同じ候補を一つにまとめる。
                groups[field].add(bucket[field]);
            }
        }
    }
    // 全集計行を読み終えてから候補を表示順に揃える。
    return { userOptions, userNames, filterOptions: sortFilterOptions(groups) };
}

// 収集済みの候補を画面用の並びに整える。
export function sortFilterOptions(groups) {
    // 項目ごとの集合を日本語の照合順に並べた配列へ変換する。
    return Object.fromEntries(FILTER_OPTION_FIELDS.map(field => [
        field, [...groups[field]].sort((left, right) => left.localeCompare(right, 'ja'))
    ]));
}

// 操作別の定型部分を取り除き、ログインとログアウトの対象表示名を比較する。
const LOGIN_SUFFIX = ' のログインアクセスを使用してログイン済み';
// ログアウト行の本文に記録された許可元の表示名を取り出す。
const LOGOUT_SUFFIX = ' のログインアクセスを使用してログアウト済み';

// 代理ユーザー名の大文字小文字を揃え、対象表示名を完全一致で照合する。
function loginAsKey(delegate, target) {
    // 名前に区切り文字が含まれても異なる組を混同しないようにする。
    return JSON.stringify([delegate.toLowerCase(), target]);
}

// 作成者に代理ユーザー自身が記録されたログインだけが照合の対象になる。
export function hasDelegateAsCreator(row) {
    // 履歴とユーザーのログイン名の大文字小文字を区別しない。
    return Boolean(row.DelegateUser) && row.CreatedBy?.Username?.toLowerCase() === row.DelegateUser.toLowerCase();
}

// 作成者に代理ユーザー自身が記録された日本語の代理ログインだけを照合する。
export function needsLoginAsUser(row) {
    // 通常の作成者や、許可元を既に取得できた履歴には補正を行わない。
    return row.Action === 'suOrgAdminLogin' && hasDelegateAsCreator(row) && row.Display?.endsWith(LOGIN_SUFFIX);
}

// 同じ代理人・対象の履歴を新しい順に読み、各ログインの直後のログアウトを記録する。
export function collectLoginAsPairs(pairs, records) {
    for (const row of records) {
        // 日本語の本文で確認できる対象名は空白や記号を含めて比較する。
        const login = row.Action === 'suOrgAdminLogin';
        const suffix = login ? LOGIN_SUFFIX : LOGOUT_SUFFIX;
        if (!row.DelegateUser || !row.Display?.endsWith(suffix) || row.Display.length === suffix.length) {
            continue;
        }
        const target = row.Display.slice(0, -suffix.length);
        const key = loginAsKey(row.DelegateUser, target);
        const group = pairs.get(key) ?? { byLogin: new Map(), previousTime: Infinity };
        pairs.set(key, group);
        // 同時刻や順序の逆転、操作の重なりがある組に許可元を割り当てない。
        const time = Date.parse(row.CreatedDate);
        if (group.ambiguous || !(time < group.previousTime) ||
            (group.previousTime !== Infinity && login !== Boolean(group.logout))) {
            group.ambiguous = true;
            continue;
        }
        group.previousTime = time;
        if (login) {
            // 作成者の表示名も本文に一致したログアウトだけをこのログインに対応付ける。
            if (needsLoginAsUser(row) && row.Id && row.CreatedById && group.logout?.CreatedBy?.Name === target &&
                group.logout.CreatedById && group.logout.CreatedById !== row.CreatedById && group.logout.CreatedBy.Username &&
                group.logout.CreatedBy.Username.toLowerCase() !== row.DelegateUser.toLowerCase()) {
                group.byLogin.set(row.Id, group.logout);
            }
            group.logout = null;
        } else {
            group.logout = row;
        }
    }
}

// 一意に対応した組だけを履歴IDで参照し、検索と表示に同じ作成者を使う。
export function loginAsActors(pairs) {
    const actors = new Map();
    for (const group of pairs.values()) {
        // 保持期間の端で片側だけの操作があっても、対応の確定した履歴は利用できる。
        if (!group.ambiguous) {
            for (const [id, logout] of group.byLogin) {
                actors.set(id, logout);
            }
        }
    }
    return actors;
}

// システムによる操作に対応する日本語ラベルを返す。
function systemActorLabel(userType, username, confirmedEmployee) {
    // 日本語の自動化プロセスには標準CSVの種別名を出す。
    if (userType === 'AutomatedProcess') {
        // 自動化プロセスの内部ログイン名を表示名に変換する。
        return '自動化プロセス';
    }
    // ログイン名がない場合も、同じ作成者の従業員操作を確認できた場合だけ会社名を使う。
    if (!username && confirmedEmployee) {
        // 日本語の標準CSVでのSalesforce側の実行主体を表す。
        return '株式会社セールスフォース・ジャパン';
    }
    return undefined;
}

// 通常の表示名とログイン名の両方が空の集計だけ、追加の照合を必要とする。
export function needsChartEmployeeLabel(bucket) {
    return bucket.userId && !bucket.userName && !bucket.loginName && bucket.userType !== 'AutomatedProcess';
}

// 通常ユーザーの氏名と集計キーを保ち、判定できた実行者に日本語の表示名を付ける。
export function labelChartActors(buckets, employeeActorIds) {
    const employees = new Set(employeeActorIds);
    for (const bucket of buckets) {
        const label = systemActorLabel(bucket.userType, bucket.loginName, !bucket.userName && employees.has(bucket.userId));
        if (label) {
            bucket.userName = label;
        }
    }
}

// CSVには標準出力に合わせたログイン名を使用する。
function csvUser(row, employeeActorIds, actors) {
    const logout = actors?.get(row.Id);
    return logout && needsLoginAsUser(row) ? logout.CreatedBy.Username :
        systemActorLabel(row.CreatedBy?.UserType, row.CreatedBy?.Username, employeeActorIds.has(row.CreatedById)) || row.CreatedBy?.Username;
}

// 履歴の本人と代理ユーザーを独立して氏名に変換し、照合できない場合は元の表記を保持する。
export function historyRow(row, employeeActorIds, actors, delegateNames, localizedActions) {
    const actor = actors?.get(row.Id) ?? row;
    return {
        ...row,
        displayedUser: actor.CreatedBy?.Name || systemActorLabel(actor.CreatedBy?.UserType, actor.CreatedBy?.Username, employeeActorIds.has(actor.CreatedById)) || actor.CreatedBy?.Username,
        displayedDelegate: delegateNames?.[row.DelegateUser?.toLowerCase()] ?? row.DelegateUser,
        displayedAction: localizedActions?.[row.Id] ?? row.Display
    };
}

// 履歴の文字を一つのCSVセルに収める。
function csvCell(value) {
    // セル内の改行をLFに揃え、引用符を二重にして囲む。
    return '"' + String(value ?? '').replace(/\r\n?/g, '\n').replaceAll('"', '""') + '"';
}

// 両方の出力期間で同じ規則を使って明細ページを書き出す。
export function formatCsvPage(records, employeeActorIds = new Set(), actors, localizedActions) {
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
        // ユーザー・本文をCSV用に整形し、代理ユーザーを独立した列に保存する。
        return [formattedDate, csvUser(row, employeeActorIds, actors), row.ResponsibleNamespacePrefix,
            localizedActions?.[row.Id] ?? row.Display, row.Section, row.DelegateUser].map(csvCell).join(',') + '\n';
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

// 5行ほどの可視範囲と、その前後のスクロール用の行だけを描画する。
export const LOOKUP_WINDOW = 16;

// 候補と確定後の表示で同じ氏名を使う。
function lookupLabel(field, value, { userNames, userOptions, delegateNames }) {
    if (field === 'userId') {
        return userNames[value] || userOptions[value] || '';
    }
    return field === 'delegateUser' ? delegateNames?.[value.toLowerCase()] || value : value;
}

// 入力または元データが変わった時だけ、月全体の候補を検索する。
export function matchingLookupValues(field, input, sources) {
    const candidates = field === 'userId' ? Object.keys(sources.userOptions) : sources.filterOptions?.[field] ?? [];
    const term = input.trim().toLocaleLowerCase();
    if (!term) {
        return candidates;
    }
    return candidates.filter(value => value.toLocaleLowerCase().includes(term) ||
        lookupLabel(field, value, sources).toLocaleLowerCase().includes(term) ||
        (field === 'userId' && sources.userOptions[value]?.toLocaleLowerCase().includes(term)));
}

const LOOKUP_FIELDS = [
    { key: 'userId', label: 'ユーザー' },
    { key: 'namespacePrefix', label: '名前空間プレフィックス' },
    { key: 'action', label: 'アクション' },
    { key: 'section', label: 'セクション' },
    { key: 'delegateUser', label: '代理ユーザー' }
];

// 一覧に適用済みの条件を、検索欄と同じ表示名で確認できるようにする。
export function appliedFilterLabels(filters, sources) {
    const labels = filters.day ? ['日付：' + filters.day] : [];
    for (const { key, label } of LOOKUP_FIELDS) {
        if (filters[key]) {
            labels.push(label + '：' + (lookupLabel(key, filters[key], sources) || filters[key]));
        }
    }
    return labels;
}

// 各検索欄の表示値と現在位置に対応する候補を組み立てる。
export function buildFilterFields({ sources, selectedValues, lookupField, lookupTerm, lookupIndex, matches, start, rowHeight }) {
    return LOOKUP_FIELDS.map(({ key, label }) => {
        const isUserLookup = key === 'userId' || key === 'delegateUser';
        // 項目別の選択値を取り出す。
        const selected = selectedValues[key];
        // 閉じている欄は選択状態だけを表示する。
        const open = lookupField === key && !selected;
        const field = {
            key, label, open, selected: Boolean(selected),
            containerClass: 'slds-combobox_container' + (selected ? ' slds-has-selection' : ''),
            comboboxClass: 'slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click' + (open ? ' slds-is-open' : ''),
            controlClass: 'slds-combobox__form-element slds-input-has-icon ' +
                (selected ? 'slds-input-has-icon_left-right' : 'slds-input-has-icon_right'),
            inputClass: 'slds-input slds-combobox__input' + (selected ? ' slds-combobox__input-value' : '')
        };
        if (!open) {
            // 選択した値と解除操作のラベルを組み立てる。
            return {
                ...field, clearLabel: label + 'の選択を解除',
                inputValue: selected ? lookupLabel(key, selected, sources) : '',
                selectedIcon: isUserLookup ? 'standard:user' : 'standard:custom'
            };
        }

        // 入力欄と候補一覧を関連付ける。
        const listId = key + '-options';
        // 開いた欄の表示とキーボードの選択状態を組み立てる。
        return {
            ...field, listId, isUserLookup, total: matches.length,
            topStyle: 'height:' + start * rowHeight + 'px',
            bottomStyle: 'height:' + Math.max(0, matches.length - start - LOOKUP_WINDOW) * rowHeight + 'px',
            inputValue: lookupTerm,
            activeId: lookupIndex >= 0 ? listId + '-' + lookupIndex : undefined,
            noMatches: Boolean(sources.filterOptions) && matches.length === 0,
            options: matches.slice(start, start + LOOKUP_WINDOW).map((value, index) => ({
                position: start + index + 1,
                label: lookupLabel(key, value, sources),
                code: key === 'delegateUser' && sources.delegateNames?.[value.toLowerCase()] ? value :
                    (key === 'userId' ? sources.userOptions[value] : ''),
                value,
                id: listId + '-' + (start + index),
                active: start + index === lookupIndex,
                className: 'slds-listbox__option slds-listbox__option_entity slds-media slds-media_small' +
                    (start + index === lookupIndex ? ' slds-has-focus' : '')
            }))
        };
    });
}

// ページ境界をまたぐ集計を同じ軸ごとに統合する。
export function mergeChartPage(totals, buckets) {
    // 同じ走査で元の履歴件数を数え、一覧のページ数にも利用する。
    let count = 0;
    // 今回の集計ページをこれまでの結果に統合する。
    for (const bucket of buckets) {
        count += bucket.count;
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
    return count;
}

// Apexと同じ実行ユーザーの暦日で、代理ログインを分析の集計行に加える。
export function loginBucket(row, actors) {
    const actor = actors?.get(row.Id) ?? row;
    return {
        day: localDay(new Date(row.CreatedDate)), userId: actor.CreatedById, userName: actor.CreatedBy?.Name,
        userType: actor.CreatedBy?.UserType, loginName: actor.CreatedBy?.Username, action: row.Action, section: row.Section,
        namespacePrefix: row.ResponsibleNamespacePrefix, delegateUser: row.DelegateUser, count: 1
    };
}
