import {
    createGraph,
    createStructureGraph,
    structurePageNodes,
    managerBrowseCandidates,
    lookupCandidate,
    buildView,
    selectView,
    fieldText,
    memberColumns,
    memberView,
    memberSelectionLabel,
    memberProfileIds,
    userProfileReference,
    memberPageLabel
} from '../orgExplorerLogic';

const node = (id, parent = '') => ({
    key: `USER:${id}`,
    recordId: id,
    kind: 'USER',
    label: `試験${id}`,
    isActive: false,
    parentKey: parent,
    titleState: 'EMPTY',
    departmentState: 'EMPTY'
});
// 複数ページのfixtureを独立した索引として組み立てる。
const mergePages = (previous, response) => ({ ...previous, ...structurePageNodes(response) });
const graphFor = (nodes) =>
    createStructureGraph(Object.fromEntries(nodes.map((item) => [item.key, item])), null, 'USER');

it('構造の継続ページで重複を統合し、旧カード上限で上司を切り捨てない', () => {
    const first = mergePages({}, { nodes: Array.from({ length: 1000 }, (_, index) => node(index)) });
    const nodes = mergePages(first, { nodes: [node(999), node(1000)] });
    const view = buildView(createStructureGraph(nodes, null, 'USER'), 'MANAGER');
    expect(view.rows).toHaveLength(1001);
    expect(new Set(view.rows.map((row) => row.key)).size).toBe(1001);
    expect(first['USER:1000']).toBeUndefined();
});

it('循環入力でも有限回で配置し、同じ深さのカードを重ねない', () => {
    const graph = graphFor([node(1), node(2, 'USER:1'), node(3, 'USER:1')]);
    const view = buildView(graph, 'MANAGER');
    expect(view.countText).toBe('表示上司数：3');
    expect(view.edges).toHaveLength(2);
    expect(new Set(view.rows.map((row) => row.style)).size).toBe(3);
    expect(buildView(graphFor([node(1, 'USER:2'), node(2, 'USER:1')]), 'MANAGER').rows).toHaveLength(2);
});

it('未登録と権限不足を区別する', () => {
    expect(fieldText('秘密', 'UNAVAILABLE')).toBe('参照権限なし');
    expect(fieldText('', 'EMPTY')).toBe('未登録');
});

it('深い部分木と循環をノード順に依存せず一度ずつ探索する', () => {
    const nodes = {};
    for (let index = 9999; index >= 0; index--) {
        nodes[`USER:${index}`] = node(index, index ? `USER:${index - 1}` : 'USER:9999');
    }
    const graph = createStructureGraph(nodes, '0', 'USER');
    expect(Object.keys(graph.nodes)).toHaveLength(10000);
    expect(Object.values(graph.nodes).length).toBe(10000);
    expect(graph.nodes['USER:0'].parentKey).toBe('');
});

it('構造ページの可視ロールだけに人数を対応し、未集計とゼロを区別する', () => {
    const root = { key: 'ROLE:root', recordId: 'root', kind: 'ROLE', label: '会社' };
    const child = { key: 'ROLE:child', recordId: 'child', kind: 'ROLE', label: '営業部', parentKey: root.key };
    const index = mergePages({}, { nodes: [root, child], roleMemberCounts: { root: 3, child: 0, hidden: 8 } });
    const view = buildView(createStructureGraph(index), 'ROLE');
    expect(view.countText).toBe('表示ロール数：2');
    expect(view.rows.map((row) => row.memberCountText)).toEqual(['メンバー 3人', 'メンバー 0人']);
    expect(index['ROLE:hidden']).toBeUndefined();
    expect(root.memberCount).toBeUndefined();
    expect(buildView(createStructureGraph({ [root.key]: root }), 'ROLE').rows[0].memberCountText).toBe('');
});

it('別の深さの空き列を共有し、三段の七人を三列で配置する', () => {
    const nodes = [
        node(0),
        node(1, 'USER:0'),
        node(2, 'USER:0'),
        node(3, 'USER:0'),
        node(4, 'USER:2'),
        node(5, 'USER:2'),
        node(6, 'USER:2')
    ];
    const graph = graphFor(nodes);
    const view = buildView(graph, 'MANAGER');
    expect(view.width).toBeLessThan(1100);
    for (const level of [1, 2]) {
        const positions = view.rows
            .filter((row) => row.depth === level)
            .map((row) => row.layout.x)
            .sort((a, b) => a - b);
        expect(positions[1] - positions[0]).toBeGreaterThanOrEqual(332);
        expect(positions[2] - positions[1]).toBeGreaterThanOrEqual(332);
    }
});

it('構造索引を到着順に依存せず結合し、起点以外の枝をキャッシュへ残さない', () => {
    const child = { key: 'ROLE:child', recordId: 'child', kind: 'ROLE', label: '部門', parentKey: 'ROLE:root' };
    const first = mergePages({}, { nodes: [child], roleMemberCounts: { child: 0 } });
    const index = mergePages(first, {
        nodes: [
            { key: 'ROLE:root', recordId: 'root', kind: 'ROLE', label: '会社', parentKey: 'ROLE:outside' },
            { key: 'ROLE:outside', recordId: 'outside', kind: 'ROLE', label: '別の枝' }
        ],
        roleMemberCounts: { root: 9 }
    });
    const graph = createStructureGraph(index, 'root');
    expect(Object.keys(graph.nodes)).toEqual(['ROLE:root', 'ROLE:child']);
    expect(Object.keys(graph.nodes)).toHaveLength(2);
    expect(graph.nodes['ROLE:root'].parentKey).toBe('');
    expect(graph.nodes['ROLE:root'].memberCount).toBe(9);
    expect(graph.nodes['ROLE:child'].memberCount).toBe(0);
    expect(index['ROLE:outside'].memberCount).toBeUndefined();
    expect(first['ROLE:root']).toBeUndefined();
    expect(createStructureGraph(index, 'missing')).toBeNull();
});
it('構造に循環があっても起点を重複させず終了する', () => {
    const graph = createStructureGraph(
        {
            'ROLE:a': { key: 'ROLE:a', recordId: 'a', parentKey: 'ROLE:b' },
            'ROLE:b': { key: 'ROLE:b', recordId: 'b', parentKey: 'ROLE:a' }
        },
        'a'
    );
    expect(Object.keys(graph.nodes)).toEqual(['ROLE:a', 'ROLE:b']);
    expect(graph.nodes['ROLE:a'].parentKey).toBe('');
});

it('起点未指定では別々のルートと子の接続を保持し、空の索引も許可する', () => {
    const index = {
        'ROLE:a': { key: 'ROLE:a', recordId: 'a', kind: 'ROLE', label: '会社A', parentKey: '' },
        'ROLE:b': { key: 'ROLE:b', recordId: 'b', kind: 'ROLE', label: '会社B', parentKey: '' },
        'ROLE:c': { key: 'ROLE:c', recordId: 'c', kind: 'ROLE', label: '部門', parentKey: 'ROLE:a' }
    };
    const graph = createStructureGraph(index, null);
    expect(Object.keys(graph.nodes)).toEqual(Object.keys(index));
    expect(graph.nodes['ROLE:c'].parentKey).toBe('ROLE:a');
    expect(Object.keys(createStructureGraph({}, null).nodes)).toEqual([]);
    expect(buildView(graph, 'ROLE').rows).toHaveLength(3);
});

const memberLabels = {
    label: '氏名',
    email: 'メールアドレス',
    department: '部署',
    title: '役職',
    managerName: 'マネージャー',
    employeeNumber: '従業員番号',
    profileName: 'プロファイル'
};

describe('所属ユーザー一覧の表示契約', () => {
    it('許可された列だけを定義順で表示し未知の項目を採用しない', () => {
        const columns = memberColumns(['profileName', 'label', 'UnknownField', 'department'], memberLabels);
        expect(columns.map((column) => column.label)).toEqual(['氏名', '部署', 'プロファイル']);
        expect(columns.every((column) => !Object.hasOwn(column, 'editable'))).toBe(true);
        expect(memberColumns()).toEqual([]);
    });
    it('氏名順で返されたユーザーの並びを保ちロールを一覧へ含めない', () => {
        const first = node('first');
        const second = node('second');
        expect(memberView([first, { kind: 'ROLE', recordId: 'role' }, second]).map((row) => row.recordId)).toEqual([
            first.recordId,
            second.recordId
        ]);
    });
});

it('従業員番号をプロファイルの直前へ表示し、非参照時は列を生成しない', () => {
    expect(memberColumns(['profileName', 'employeeNumber'], memberLabels)).toEqual([
        { label: '従業員番号', fieldName: 'employeeNumber', type: 'text' },
        { label: 'プロファイル', fieldName: 'profileName', type: 'text' }
    ]);
    const rows = memberView([{ ...node('a'), employeeNumber: '000007' }]);
    expect(rows[0].employeeNumber).toBe('000007');
    expect(memberColumns(['profileName'], memberLabels).map((column) => column.fieldName)).toEqual(['profileName']);
    expect(memberColumns(['employeeNumber'], {})).toEqual([]);
});

it('氏名と上司のリンクを別タブにし、非参照の上司列は生成しない', () => {
    const columns = memberColumns(['label', 'managerName'], memberLabels);
    expect(columns.map((column) => column.fieldName)).toEqual(['userUrl', 'managerUrl']);
    expect(columns.map((column) => column.typeAttributes)).toEqual([
        { label: { fieldName: 'label' }, target: '_blank' },
        { label: { fieldName: 'managerName' }, target: '_blank' }
    ]);
    expect(memberColumns(['label'], memberLabels).some((column) => column.fieldName === 'managerUrl')).toBe(false);
});
it('未確認のマネージャーへリンクを作らず参照先を重複排除する', () => {
    const nodes = [
        { ...node('a'), managerId: 'boss' },
        { ...node('b'), managerId: 'boss' },
        { kind: 'ROLE', recordId: 'role' }
    ];
    expect(memberProfileIds(nodes)).toEqual(['a', 'boss', 'b']);
    const rows = memberView(nodes, { a: '/profile/a', b: '/profile/b', boss: '/profile/boss' });
    expect(rows[0].managerUrl).toBe('/profile/boss');
    expect(memberView([node('unassigned')], {})[0].managerUrl).toBeUndefined();
    expect(userProfileReference('boss')).toEqual({
        type: 'standard__recordPage',
        attributes: { recordId: 'boss', objectApiName: 'User', actionName: 'view' }
    });
});

it.each([
    [0, 0, false, '1 / 1'],
    [0, 6, false, '1 / 1'],
    [0, 50, false, '1 / 1'],
    [0, 51, true, '1 / 2'],
    [1, 51, false, '2 / 2'],
    [0, 100, true, '1 / 2'],
    [1, 101, true, '2 / 3'],
    [2, 101, false, '3 / 3'],
    [0, 100001, true, '1 / 2000'],
    [0, undefined, true, '1 / —'],
    [0, undefined, false, '1 / 1']
])('人数を表示せず50件単位のページ数を表す: %i, %s', (index, count, next, expected) => {
    expect(memberPageLabel(index, count, next)).toBe(expected);
});

it('メールは専用セルへ元の値を渡し、独自URLや非参照列を作らない', () => {
    const column = memberColumns(['email'], memberLabels)[0];
    expect(column).toEqual({
        label: 'メールアドレス',
        fieldName: 'email',
        type: 'readOnlyEmail'
    });
    const rows = memberView([{ ...node('a'), email: 'demo+sales@example.com' }, node('b')]);
    expect(rows[0].email).toBe('demo+sales@example.com');
    expect(rows[1].email).toBeUndefined();
    expect(rows.every((row) => !Object.hasOwn(row, 'emailUrl'))).toBe(true);
    expect(memberColumns(['label'], memberLabels).some((item) => item.fieldName === 'email')).toBe(false);
});

it('列見出しへ応答のラベルを使い、項目情報のない列や非参照列は出さない', () => {
    const labels = {
        label: 'Full Name',
        email: 'Work Email',
        department: 'Organization',
        title: 'Job Title',
        employeeNumber: 'Employee No.',
        managerName: 'Reports To',
        profileName: 'User Profile'
    };
    expect(memberColumns(Object.keys(labels), labels).map((column) => column.label)).toEqual([
        'Full Name',
        'Work Email',
        'Organization',
        'Job Title',
        'マネージャー',
        'Employee No.',
        'プロファイル'
    ]);
    expect(
        memberColumns(['label', 'email'], { label: '氏名の変更後ラベル' }).map((column) => column.label)
    ).toEqual(['氏名の変更後ラベル']);
    expect(memberColumns(['label'])).toEqual([]);
    expect(memberColumns(['label'], { label: 'Name', email: 'Email' }).map((column) => column.label)).toEqual([
        'Name'
    ]);
});

it('有効状態を読み取り専用のチェックボックス列へ渡し、許可されたときだけ表示する', () => {
    const rows = memberView([
        { ...node('a'), isActive: true },
        { ...node('b'), isActive: false }
    ]);
    expect(rows.map((row) => row.isActive)).toEqual([true, false]);
    expect(memberColumns(['isActive'], { isActive: '有効' })).toEqual([
        { fieldName: 'isActive', type: 'readOnlyCheckbox', typeAttributes: { label: '有効' }, label: '有効' }
    ]);
    expect(memberColumns([], { isActive: '有効' })).toEqual([]);
    expect(memberColumns(['managerName', 'profileName'])).toEqual([
        {
            label: 'マネージャー',
            fieldName: 'managerUrl',
            type: 'url',
            typeAttributes: { label: { fieldName: 'managerName' }, target: '_blank' }
        },
        { label: 'プロファイル', fieldName: 'profileName', type: 'text' }
    ]);
});

it('マネージャー氏名を補足なしで表示し、リンクを維持する', () => {
    const rows = memberView(
        [
            { ...node('a'), managerId: 'boss', managerName: '鈴木 美咲' },
            { ...node('b'), managerName: '鈴木 美咲' },
            { ...node('c'), managerName: '' }
        ],
        { boss: '/profile/boss' }
    );
    expect(rows.map((row) => row.managerName)).toEqual(['鈴木 美咲', '鈴木 美咲', '']);
    expect(rows[0].managerUrl).toBe('/profile/boss');
});

it('上司の起点で部分木を作り、別の上司の枝や一般メンバーを混ぜない', () => {
    const index = {
        'USER:a': { kind: 'USER', key: 'USER:a', recordId: 'a', parentKey: '', managerCard: true, memberCount: 4 },
        'USER:b': {
            kind: 'USER',
            key: 'USER:b',
            recordId: 'b',
            label: '上司B',
            parentKey: 'USER:a',
            managerCard: true,
            memberCount: 2
        },
        'USER:c': { kind: 'USER', key: 'USER:c', recordId: 'c', parentKey: '', managerCard: true, memberCount: 1 }
    };
    const graph = createStructureGraph(index, 'b', 'USER');
    expect(Object.keys(graph.nodes)).toEqual(['USER:b']);
    expect(graph.nodes['USER:b'].parentKey).toBe('');
    const view = buildView(graph, 'MANAGER');
    expect(view.rows[0].memberCountText).toBe('メンバー 2人');
});

it('上司カードの情報行を収める高さと接続線を同じ寸法で配置する', () => {
    const first = { kind: 'USER', key: 'USER:a', recordId: 'a', label: '上司', managerCard: true, parentKey: '' };
    const second = { ...first, key: 'USER:b', recordId: 'b', parentKey: 'USER:a' };
    const graph = {
        ...createGraph(),
        nodes: { [first.key]: first, [second.key]: second }
    };
    const view = buildView(graph, 'MANAGER');
    expect(view.rows[0].style).toContain('height:144px');
    expect(view.rows[1].style).toContain('top:232px');
    expect(view.edges[0].d).toMatch(/^M[\d.]+,168 V200 H[\d.]+ V232$/);
});

it('上司カードの所属ロールを同じ応答の可視ノードへ対応させる', () => {
    const user = { kind: 'USER', key: 'USER:manager', recordId: 'manager', label: '試験上司' };
    const result = mergePages(
        {},
        { nodes: [user], roleMemberCounts: {}, cardRoles: { manager: { name: '営業ロール', state: 'VALUE' } } }
    );
    expect(result[user.key].role).toEqual({ name: '営業ロール', state: 'VALUE' });
    const withoutRole = mergePages(result, { nodes: [user], roleMemberCounts: {} });
    expect(withoutRole[user.key].role).toBeUndefined();
});

it('未入力の上司候補は全構造から階層順・同階層氏名順に最大20人を返す', () => {
    const root = { ...node('root'), label: 'Z本社' };
    const children = Array.from({ length: 22 }, (_, i) => ({
        ...node(`child${i}`, root.key),
        label: `部門${String(i).padStart(2, '0')}`
    }));
    const grandchild = { ...node('grandchild', children[0].key), label: 'A課' };
    const index = Object.fromEntries([grandchild, ...children.slice().reverse(), root].map((item) => [item.key, item]));
    const result = managerBrowseCandidates(index);
    expect(result.results.map((item) => item.roleId)).toEqual([
        'root',
        ...children.slice(0, 19).map((item) => item.recordId)
    ]);
    expect(result.hasMore).toBe(true);
    expect(Object.keys(index)).toHaveLength(24);
});

it('上司候補は親をまたいで同じ階層を氏名順にし、不可視の親を飛び越えない', () => {
    const records = [
        { ...node('a'), label: 'A' },
        { ...node('b'), label: 'B' },
        { ...node('z', 'USER:a'), label: 'Z' },
        { ...node('c', 'USER:b'), label: 'C' },
        { ...node('d', 'USER:unavailable'), label: 'D' },
        { ...node('role'), kind: 'ROLE' }
    ];
    const result = managerBrowseCandidates(Object.fromEntries(records.map((item) => [item.key, item])));
    expect(result.results.map((item) => item.roleId)).toEqual(['a', 'b', 'd', 'c', 'z']);
    const reversed = Object.fromEntries([...records].reverse().map((item) => [item.key, item]));
    expect(managerBrowseCandidates(reversed)).toEqual(result);
    expect(result.hasMore).toBe(false);
    expect(managerBrowseCandidates({})).toEqual({ results: [], hasMore: false });
});

it('循環して最上位を持たない上司を候補探索で無限に辿らない', () => {
    const records = [node('a', 'USER:b'), node('b', 'USER:a')];
    expect(managerBrowseCandidates(Object.fromEntries(records.map((item) => [item.key, item])))).toEqual({
        results: [],
        hasMore: false
    });
});

it('上司候補の補足行は参照可能な部署と役職だけを結合する', () => {
    const manager = {
        ...node('boss'),
        department: '営業部',
        departmentState: 'VALUE',
        title: '部長',
        titleState: 'VALUE'
    };
    expect(lookupCandidate(manager).description).toBe('営業部 • 部長');
    expect(lookupCandidate({ ...manager, departmentState: 'UNAVAILABLE' }).description).toBe('部長');
    expect(lookupCandidate({ ...manager, titleState: 'UNAVAILABLE' }).description).toBe('営業部');
    expect(
        lookupCandidate({ ...manager, titleState: 'EMPTY', departmentState: 'UNAVAILABLE' }).description
    ).toBe('');
    expect(managerBrowseCandidates({ [manager.key]: manager }).results[0].description).toBe('営業部 • 部長');
});

it.each(['ROLE', 'MANAGER'])(
    '選択変更は座標・接続線・非選択行を再利用し、新旧の強調と読み上げだけを更新する: %s',
    (mode) => {
        const graph = graphFor([node(0), node(1, 'USER:0'), node(2, 'USER:0')]);
        graph.selectedKey = 'USER:0';
        const before = buildView(graph, mode);
        const after = selectView(before, 'USER:1');
        expect(after).toEqual(buildView({ ...graph, selectedKey: 'USER:1' }, mode));
        expect(after.edges).toBe(before.edges);
        expect(after.rows[2]).toBe(before.rows[2]);
        expect(after.rows[0].selected).toBe(false);
        expect(after.rows[0].ariaLabel).not.toContain('選択中');
        expect(after.rows[1].selected).toBe(true);
        expect(after.rows[1].ariaLabel).toContain('選択中');
        expect(before.rows[0].selected).toBe(true);
        expect(before.rows[1].selected).toBe(false);
        expect(selectView(after, 'USER:1')).toBe(after);
        expect(selectView(after, '').rows.every((row) => !row.selected)).toBe(true);
    }
);
it('多数の表示カードでも選択で置換するのは新旧の二行だけに限る', () => {
    const graph = graphFor(Array.from({ length: 5000 }, (_, index) => node(index)));
    const before = selectView(buildView(graph, 'MANAGER'), 'USER:0');
    const after = selectView(before, 'USER:4999');
    expect(after.rows.filter((row, index) => row !== before.rows[index])).toHaveLength(2);
    expect(after.edges).toBe(before.edges);
    expect(after.rows.map((row) => row.style)).toEqual(before.rows.map((row) => row.style));
    expect(selectView(buildView(createGraph(), 'ROLE'), 'missing').rows).toEqual([]);
});

it('3000段の階層でも再帰上限に達せず親子の座標を確定する', () => {
    const nodes = Array.from({ length: 3000 }, (_, index) => node(index, index ? `USER:${index - 1}` : ''));
    const view = buildView(graphFor(nodes), 'MANAGER');
    expect(view.rows).toHaveLength(3000);
    expect(view.edges).toHaveLength(2999);
    expect(view.rows[2999].depth).toBe(2999);
    expect(view.rows[2999].style).toBe(`left:40px;top:${24 + 2999 * 208}px;width:300px;height:144px;`);
    expect(view.rows.every((row) => !/NaN|Infinity/.test(row.style))).toBe(true);
});

it('上司カードだけ幅を広げ、接続線をカード中央へ合わせる', () => {
    const graph = graphFor([node(0), node(1, 'USER:0'), node(2, 'USER:0')]);
    const managers = buildView(graph, 'MANAGER');
    const roles = buildView(graph, 'ROLE');
    expect(managers.rows.every((row) => row.style.includes('width:300px;'))).toBe(true);
    expect(roles.rows.every((row) => row.style.includes('width:220px;'))).toBe(true);
    const parentX = managers.rows[0].layout.x;
    const childX = managers.rows[1].layout.x;
    expect(managers.edges[0].d).toContain(`M${parentX + 150},`);
    expect(managers.edges[0].d).toContain(`H${childX + 150} `);
});

it.each([
    ['MANAGER', 'VALUE', '部長', '試験上司・部長'],
    ['MANAGER', 'EMPTY', '', '試験上司'],
    ['MANAGER', 'UNAVAILABLE', '非参照役職', '試験上司'],
    ['MANAGER', 'VALUE', '   ', '試験上司'],
    ['ROLE', 'VALUE', '部長', '試験上司']
])('選択対象の見出しは上司の参照可能な役職だけを補足する: %s %s', (mode, titleState, title, expected) => {
    expect(memberSelectionLabel({ label: '試験上司', titleState, title }, mode)).toBe(expected);
    expect(memberSelectionLabel(null, mode)).toBe('');
});

it('構造ページの変換は現在ページだけを返し、元のノードと応答を変更しない', () => {
    const current = Object.freeze({ ...node('current'), memberCount: 99 });
    const response = Object.freeze({ nodes: Object.freeze([current]), roleMemberCounts: Object.freeze({ current: 2 }) });
    const result = structurePageNodes(response);
    expect(Object.keys(result)).toEqual(['USER:current']);
    expect(result['USER:current'].memberCount).toBe(2);
    expect(current.memberCount).toBe(99);
    expect(result['USER:current']).not.toBe(current);
});

it('配置の数値と描画スタイルは同じ座標を使用する', () => {
    const view = buildView(graphFor([node('root'), node('child', 'USER:root')]), 'MANAGER');
    for (const row of view.rows) {
        const { x, y, width, height } = row.layout;
        expect(row.style).toBe(`left:${x}px;top:${y}px;width:${width}px;height:${height}px;`);
    }
});

it('ロールの共通ノードをルックアップ候補へ変換し、親情報を含めない', () => {
    expect(lookupCandidate({ recordId: 'role', label: '営業部', kind: 'ROLE', parentKey: 'ROLE:company' })).toEqual({
        roleId: 'role', label: '営業部', description: ''
    });
});

it('参照可能なロール名をプロファイルの右側へリンクなしで表示する', () => {
    const labels = { label: '氏名', isActive: '有効' };
    const columns = memberColumns(['label', 'profileName', 'roleName', 'isActive'], labels);
    expect(columns.map((column) => column.fieldName)).toEqual(['userUrl', 'profileName', 'roleName', 'isActive']);
    expect(columns[2]).toEqual({ label: 'ロール', fieldName: 'roleName', type: 'text' });
    expect(memberColumns(['label', 'profileName'], labels).some((column) => column.fieldName === 'roleName')).toBe(false);
    expect(memberColumns(['roleName'], {})).toEqual([{ label: 'ロール', fieldName: 'roleName', type: 'text' }]);
});
