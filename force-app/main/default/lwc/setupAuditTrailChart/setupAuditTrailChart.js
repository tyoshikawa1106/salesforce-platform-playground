import { api, LightningElement } from 'lwc';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const NUMBER_FORMAT = new Intl.NumberFormat('ja-JP');

function accumulate(groups, key, label, filter, count) {
    // 空欄の件数も保持し、実際に「-」という値がある場合は区別する。
    const hasValue = Boolean(key?.trim() && label?.trim());
    const groupKey = hasValue ? key : null;
    const group = groups.get(groupKey);
    if (group) {
        group.count += count;
    } else {
        groups.set(groupKey, {
            key: groupKey,
            label: hasValue ? label : '-',
            filter: hasValue ? filter : null,
            count
        });
    }
}

function rank(groups) {
    return [...groups.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export default class SetupAuditTrailChart extends LightningElement {
    charts = [];
    selections = new Map();
    values = [];

    @api
    get buckets() {
        return this.values;
    }

    set buckets(values) {
        this.values = values || [];
        this.updateCharts();
    }

    updateCharts() {
        const users = new Map();
        const loginNames = new Map();
        const actions = new Map();
        const sections = new Map();
        const dates = new Map();
        const namespaces = new Map();
        const delegates = new Map();
        this.selections = new Map();
        for (const bucket of this.values) {
            const { userId, userName, loginName, action, section, day, count, namespacePrefix, delegateUser } = bucket;
            if (userId && loginName) {
                loginNames.set(userId, loginName);
            }
            accumulate(users, userId, userName, { userId }, count);
            accumulate(actions, action, action, { action }, count);
            accumulate(sections, section, section, null, count);
            accumulate(dates, day, day, { day }, count);
            // 名前空間と代理ユーザーは値がある履歴だけを集計する。
            if (namespacePrefix?.trim()) {
                accumulate(namespaces, namespacePrefix, namespacePrefix, null, count);
            }
            if (delegateUser?.trim()) {
                accumulate(delegates, delegateUser, delegateUser, null, count);
            }
        }
        const makeChart = (key, title, rows, describeRow = () => ({})) => {
            // 最大件数を覆うように整数の間隔で目盛りを作る。
            const peak = rows.reduce((value, row) => Math.max(value, row.count), 0);
            const step = Math.max(1, Math.ceil(peak / 4));
            const max = step * 4;
            return {
                key,
                title,
                hasRows: rows.length > 0,
                ticks: Array.from({ length: 5 }, (_, index) => ({
                    key: index,
                    label: NUMBER_FORMAT.format(index * step)
                })),
                rows: rows.map((row, index) => {
                    const id = key + '-' + index;
                    const formattedCount = NUMBER_FORMAT.format(row.count);
                    if (row.filter) {
                        this.selections.set(id, row.filter);
                    }
                    return {
                        label: row.label,
                        tooltip: row.label,
                        ...describeRow(row),
                        id,
                        formattedCount,
                        buttonLabel: row.label + ' ' + formattedCount + '件',
                        style: 'width:' + (100 * row.count / max) + '%',
                        disabled: !row.filter
                    };
                })
            };
        };
        const days = [...dates.values()].sort((a, b) => b.label.localeCompare(a.label));
        this.charts = [
            makeChart('users', 'ユーザー', rank(users), row => ({ tooltip: loginNames.get(row.key) || row.label })),
            makeChart('namespaces', '名前空間プレフィックス', rank(namespaces)),
            makeChart('actions', 'アクション', rank(actions)),
            makeChart('sections', 'セクション', rank(sections)),
            makeChart('days', '日付', days, row => {
                // 集計日の曜日がブラウザーのタイムゾーンで変わらないようにする。
                const weekday = new Date(row.label + 'T00:00:00Z').getUTCDay();
                return {
                    weekday: WEEKDAYS[weekday],
                    weekdayClass: weekday === 6 ? 'c-saturday' : weekday === 0 ? 'c-sunday' : ''
                };
            }),
            makeChart('delegates', '代理ユーザー', rank(delegates))
        ];
    }

    // 選択した棒の条件を履歴一覧へ渡す。
    selectSegment(event) {
        const filter = this.selections.get(event.currentTarget.dataset.id);
        this.dispatchEvent(new CustomEvent('selectfilter', { detail: filter }));
    }
}