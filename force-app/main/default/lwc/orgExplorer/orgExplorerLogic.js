// 新しいモード・表示条件で独立した表示集合を開始する。
export function createGraph() {
    // 個人情報を永続領域へ保存しない状態を返す。
    return { nodes: {}, selectedKey: '' };
}

// 一ページのノードと人数を新しい索引へ変換する。
export function structurePageNodes(response) {
    // 過去の全ノードをコピーせず現在のページだけを変換する。
    const nodes = {};
    response.nodes.forEach((node) => {
        // 未集計の人数をゼロと推定しない。
        const memberCount = response.memberCounts?.[node.recordId];
        // 同じページで可視確認した所属ロールだけをカードへ対応させる。
        const role = response.cardRoles?.[node.recordId];
        // 構造以外の応答へカード専用の関連先を混入させない。
        nodes[node.key] = { ...node, memberCount, role };
    });
    // 元の応答や取得済み索引を変更しない。
    return nodes;
}

// 起点があれば部分木、未指定なら取得した構造全体を組み立てる。
export function createStructureGraph(index, rootId, kind = 'ROLE') {
    // 未指定の起点で複数の最上位ロールとその親子関係を保持する。
    if (!rootId) return { ...createGraph(), nodes: { ...index } };
    // 起点が削除・非可視なら別の枝へ切り替えない。
    const root = index[`${kind}:${rootId}`];
    if (!root) return null;
    // 親の列挙を一度で終え、深さに比例した再検索を避ける。
    const children = new Map();
    Object.values(index).forEach((node) => {
        const siblings = children.get(node.parentKey) || [];
        siblings.push(node.key);
        children.set(node.parentKey, siblings);
    });
    // 他の枝の名前や人数は表示用キャッシュへ残さない。
    const nodes = {};
    const queue = [root.key];
    const seen = new Set(queue);
    for (let position = 0; position < queue.length; position += 1) {
        const key = queue[position];
        nodes[key] = key === root.key ? { ...root, parentKey: '' } : index[key];
        // 循環した入力でも有限回で完了する。
        (children.get(key) || []).forEach((childKey) => {
            if (!seen.has(childKey)) {
                seen.add(childKey);
                queue.push(childKey);
            }
        });
    }
    // 組織図の表示対象を部分木へ限定する。
    return { ...createGraph(), nodes };
}

// ロール・上司の共通ノードをルックアップ候補へ変換する。
export function lookupCandidate(node) {
    // 非公開値が入力へ混在しても参照状態を優先する。
    const department = node.departmentState === 'VALUE' ? node.department : '';
    // 未登録や参照不能の役職を補足表示へ変換しない。
    const title = node.titleState === 'VALUE' ? node.title : '';
    // 未入力候補と氏名検索で同じ表示契約を使用する。
    return { targetId: node.recordId, label: node.label, description: [department, title].filter(Boolean).join(' • ') };
}

// 取得済みの全上司構造から階層順の未入力候補を作る。
export function managerBrowseCandidates(index) {
    // 同じ階層では氏名とIDで順序を固定する。
    const compareNodes = (left, right) =>
        left.label.localeCompare(right.label, 'ja') || left.key.localeCompare(right.key);
    // 構造へ混在したロールを上司候補として扱わない。
    const nodes = Object.values(index).filter((node) => node.kind === 'USER');
    // 参照できない親は現在の表示条件における最上位として扱う。
    const keys = new Set(nodes.map((node) => node.key));
    // 階層ごとの候補を一度の走査で組み立てる。
    const children = new Map();
    // 最上位から幅優先で候補を列挙する。
    const queue = [];
    nodes.forEach((node) => {
        // 自己参照も上位候補の探索を妨げないよう独立させる。
        if (!keys.has(node.parentKey) || node.parentKey === node.key) {
            queue.push(node);
        } else {
            // 同じ上司の配下を氏名順のまま保持する。
            const siblings = children.get(node.parentKey) || [];
            siblings.push(node);
            children.set(node.parentKey, siblings);
        }
    });
    // 上限超過の有無だけを判定できる件数まで取り出す。
    const candidates = [];
    let level = queue.sort(compareNodes);
    // 深さにかかわらず候補上限で探索を止める。
    while (level.length && candidates.length < 21) {
        // 次の階層は親をまたいで氏名順に並べる。
        const next = [];
        for (const node of level) {
            // 現在階層を下位の上司より先に候補へ追加する。
            candidates.push(lookupCandidate(node));
            // 上限超過を確認できたら余分な子孫を探索しない。
            if (candidates.length === 21) break;
            // 各ユーザーは一つの親に属するため重複追加しない。
            next.push(...(children.get(node.key) || []));
        }
        // 次の階層も氏名とIDで表示順を固定する。
        level = next.sort(compareNodes);
    }
    // 画面へ保持する候補数を制限し、続きは氏名入力で検索する。
    return { results: candidates.slice(0, 20), hasMore: candidates.length > 20 };
}

// 未公開の値や未登録を画面上で区別する。
export function fieldText(value, state) {
    // 権限不足を未登録と同一視しない。
    if (state === 'UNAVAILABLE') {
        // 参照不能の固定表示を返す。
        return '参照権限なし';
    }
    // 空値だけを未登録として扱う。
    return state === 'VALUE' && value ? value : '未登録';
}

// 選択の見た目と読み上げ情報を同じ状態から生成する。
function cardSelection(row, selected) {
    // 座標や所属情報を含めず、選択に依存する値だけを返す。
    return {
        selected,
        cardClass: selected ? 'c-card c-selected' : 'c-card',
        ariaLabel: `${row.label} ${row.status}${row.memberCountText ? ` ${row.memberCountText}` : ''}${selected ? ' 選択中' : ''}`
    };
}

// 選択だけの変更では部分木の配置と接続線を再計算しない。
export function selectView(model, selectedKey) {
    // 同じ選択では表示モデル自体も再利用する。
    let changed = false;
    // 新旧の選択カードだけを更新し、他のカードの参照を維持する。
    const rows = model.rows.map((row) => {
        // 選択の対象は現在表示されているカードに限定する。
        const selected = row.key === selectedKey;
        // 選択状態が変わらない行は子部品へ渡す値を作り直さない。
        if (row.selected === selected) return row;
        // 再描画が必要な行があることを記録する。
        changed = true;
        // 配置済みの座標と情報はそのまま引き継ぐ。
        return { ...row, ...cardSelection(row, selected) };
    });
    // 線・寸法・件数は構造の更新時だけ変わる。
    return changed ? { ...model, rows } : model;
}

// 親子関係と選択を画面部品へ渡す表示モデルに変換する。
export function buildView(graph, mode, fieldLabels = {}) {
    // 上司カードは所属情報を収め、ロールカードの寸法は維持する。
    const cardHeight = mode === 'MANAGER' ? 144 : 104;
    // 上司カードは部署・役職・ロール名を読みやすい横幅にする。
    const cardWidth = mode === 'MANAGER' ? 300 : 220;
    // 横幅を広げても隣接するカードとの余白を維持する。
    const columnStep = cardWidth + 32;
    // カードが高くなっても親子間の余白を維持する。
    const levelStep = cardHeight + 64;
    // 部分木へ絞り込んだ索引を表示対象の唯一の情報源にする。
    const keys = Object.keys(graph.nodes);
    // 非表示の親への線は描かない。
    const visible = new Set(keys);
    // 子一覧を一度だけ組み立てる。
    const children = new Map(keys.map((key) => [key, []]));
    // 木の起点を保持する。
    const roots = [];
    // 可視集合内にある親子だけを接続する。
    keys.forEach((key) => {
        // サーバーで可視確認した親キーを使用する。
        const parent = graph.nodes[key].parentKey;
        // 自己参照を親子線として描かない。
        if (parent !== key && visible.has(parent)) {
            // 同じ親の子を取得順に追加する。
            children.get(parent).push(key);
        } else {
            // 省略区間や不可視境界を越えて直結しない。
            roots.push(key);
        }
    });
    // 各深さの左右端を使って、空いた列を別の枝で共有する。
    const layouts = new Map();
    // 循環した枝を再び展開しない。
    const measuring = new Set();
    // 同じ深さのカード同士だけに必要な間隔を確保する。
    function measureReady(key) {
        // 計算済みの部分木を再利用する。
        if (layouts.has(key)) return layouts.get(key);
        // 子部分木を並べた輪郭を保持する。
        const leftContour = [];
        // 深さごとの右端を保持する。
        const rightContour = [];
        // 各子の親からの横位置を保持する。
        const shifts = new Map();
        // 子部分木を取得順で配置する。
        children.get(key).forEach((child) => {
            // 子の各深さの範囲を取得する。
            const layout = layouts.get(child) || { left: [0], right: [0] };
            // 最初の子は原点から配置する。
            let shift = 0;
            // 存在する深さ同士の重なりだけを避ける。
            layout.left.forEach((edge, depth) => {
                // 同じ深さに既存のカードがある場合だけ間隔を取る。
                if (rightContour[depth] !== undefined) shift = Math.max(shift, rightContour[depth] + columnStep - edge);
            });
            // 子の位置を保存する。
            shifts.set(child, shift);
            // 輪郭を今回の部分木へ更新する。
            layout.left.forEach((edge, depth) => {
                // 既存の左端と新しい左端を統合する。
                leftContour[depth] = Math.min(leftContour[depth] ?? Infinity, edge + shift);
                // 右端も同じ位置補正で統合する。
                rightContour[depth] = Math.max(rightContour[depth] ?? -Infinity, layout.right[depth] + shift);
            });
        });
        // 親を最初と最後の子の中央へ置く。
        const offsets = [...shifts.values()];
        // 葉では自分自身を原点にする。
        const center = offsets.length ? (offsets[0] + offsets[offsets.length - 1]) / 2 : 0;
        // 子の位置を親の原点からの相対座標へ揃える。
        for (const [child, shift] of shifts) shifts.set(child, shift - center);
        // 根を深さゼロに加えた左輪郭を作る。
        const leftEdges = [0, ...leftContour.map((edge) => edge - center)];
        // 同じ原点から右輪郭を作る。
        const rightEdges = [0, ...rightContour.map((edge) => edge - center)];
        // 外側の範囲は複数ルートの間隔に使う。
        const min = leftEdges.reduce((edge, value) => Math.min(edge, value), 0);
        // 部分木の必要な幅を確定する。
        const layout = {
            left: leftEdges,
            right: rightEdges,
            min,
            width: rightEdges.reduce((edge, value) => Math.max(edge, value), 0) - min + columnStep,
            shifts
        };
        // 計算結果を保存する。
        layouts.set(key, layout);
        // 輪郭は親への統合後に不要となるため、深い階層で保持し続けない。
        for (const child of children.get(key)) {
            // 循環中の未確定ノードには触れない。
            const childLayout = layouts.get(child);
            // 配置に必要な幅と相対位置だけを残す。
            if (childLayout) {
                // 各深さの輪郭は親側へ統合済み。
                childLayout.left = [];
                // 右輪郭も同時に解放する。
                childLayout.right = [];
            }
        }
        // 相対位置と輪郭を返す。
        return layout;
    }
    // 再帰を使わず、子の測定が完了してから親の輪郭を合成する。
    function measure(key) {
        // 配置時は確定済みの相対位置を再利用する。
        if (layouts.has(key)) return layouts.get(key);
        // 次の子を示す走査位置を明示的なスタックで保持する。
        const stack = [{ key, index: 0 }];
        // 最初のノードを現在の測定経路に加える。
        measuring.add(key);
        // 階層の深さに比例した関数呼び出しを発生させない。
        while (stack.length) {
            // 子の測定が終わるまで親のフレームを保持する。
            const frame = stack[stack.length - 1];
            // 次に測定する子を取得する。
            const child = children.get(frame.key)[frame.index];
            // 子が残っていれば先に測定する。
            if (child !== undefined) {
                // 同じ子を繰り返し訪問しない。
                frame.index += 1;
                // 循環する辺では子を葉として扱い、再訪問しない。
                if (!layouts.has(child) && !measuring.has(child)) {
                    // 子の測定位置を保持する。
                    stack.push({ key: child, index: 0 });
                    // 現在の経路へ追加して循環を検知する。
                    measuring.add(child);
                }
            } else {
                // すべての子の測定後に従来と同じ配置計算を行う。
                measureReady(frame.key);
                // 親へ制御を戻す。
                stack.pop();
                // 確定したノードを測定中の経路から除く。
                measuring.delete(frame.key);
            }
        }
        // 確定した幅と相対位置を返す。
        return layouts.get(key);
    }
    // カードの順序と配置を同じ走査で生成する。
    const rows = [];
    // 配置と同時に高さを確定し、全行の再走査と巨大な引数配列を避ける。
    let height = 420;
    // 同じノードを重複描画しない。
    const placed = new Set();
    // SVGの端点を計算する座標を保持する。
    const positions = new Map();
    // 可視な森を親から子の順に配置する。
    function place(rootKey, rootLeft, rootDepth) {
        // 親から子の表示順序を明示的なスタックへ保持する。
        const stack = [{ key: rootKey, left: rootLeft, depth: rootDepth }];
        // 深い上司階層でも関数呼び出しを積み重ねない。
        while (stack.length) {
            // 次のカードの絶対座標を取り出す。
            const { key, left, depth } = stack.pop();
            // 循環と重複を切り離す。
            if (placed.has(key)) continue;
            // 配置済みとして記録する。
            placed.add(key);
            // 元のDTOを変更しない。
            const node = graph.nodes[key];
            // 固定寸法のカードを部分木の中央に配置する。
            const x = left + 16;
            // 階層間の間隔を固定する。
            const y = 24 + depth * levelStep;
            // 最下段のカードと下余白までを描画領域へ含める。
            height = Math.max(height, y + cardHeight + 24);
            // 線とカードで同じ座標を共有する。
            positions.set(key, { x, y });
            // 選択を色だけで表現しない。
            const selected = graph.selectedKey === key;
            // 有効状態は取得済みノードの値をそのまま読み上げる。
            const status = node.kind === 'USER' ? (node.isActive ? '有効' : '無効') : 'ロール';
            // 子部品が描画だけを担当できるモデルを作成する。
            // 人数を読み上げにも含め、未集計とゼロ件を区別する。
            const memberCountText = Number.isInteger(node.memberCount)
                ? `メンバー ${node.memberCount}人`
                : '';
            rows.push({
                ...node,
                ...cardSelection({ label: node.label, status, memberCountText }, selected),
                managerCard: mode === 'MANAGER' && node.kind === 'USER',
                status,
                memberCountText,
                depth,
                initials: node.label.slice(0, 1),
                titleText: node.kind === 'USER' ? fieldText(node.title, node.titleState) : status,
                showDepartment:
                    mode === 'MANAGER' && node.kind === 'USER' && ['VALUE', 'EMPTY'].includes(node.departmentState),
                showTitle: mode === 'MANAGER' && node.kind === 'USER' && ['VALUE', 'EMPTY'].includes(node.titleState),
                showRole: mode === 'MANAGER' && node.kind === 'USER' && ['VALUE', 'EMPTY'].includes(node.role?.state),
                roleText:
                    mode === 'MANAGER' && node.kind === 'USER' ? fieldText(node.role?.name, node.role?.state) : '',
                // ラベルはサーバーで参照が許可された項目定義から受け取る。
                departmentLabel: fieldLabels.department || '',
                titleLabel: fieldLabels.title || '',
                roleLabel: fieldLabels.role || '',
                departmentText: node.kind === 'USER' ? fieldText(node.department, node.departmentState) : '',
                // 等倍復帰ではCSS文字列を解析せず配置済みの数値を使う。
                layout: { x, y, width: cardWidth, height: cardHeight },
                style: `left:${x}px;top:${y}px;width:${cardWidth}px;height:${cardHeight}px;`
            });
            // 親の測定済み相対位置を再利用する。
            const layout = measure(key);
            // 逆順に積み、元の取得順で親子を描画する。
            for (let index = children.get(key).length - 1; index >= 0; index -= 1) {
                // 同じ深さのカードが重ならない相対座標を適用する。
                const child = children.get(key)[index];
                // 子を次の深さへ配置する。
                stack.push({ key: child, left: left + (layout.shifts.get(child) || 0), depth: depth + 1 });
            }
        }
    }
    // 複数ルートも一つの森として配置する。
    let left = 24;
    // 可視な起点から走査する。
    roots.forEach((key) => {
        // このルートの部分木を配置する。
        place(key, left - (measure(key).min || 0), 0);
        // 隣のルートへ進める。
        left += measure(key).width;
    });
    // 純粋な循環だけの入力も有限の独立カードとして表示する。
    keys.filter((key) => !placed.has(key)).forEach((key) => {
        // 既訪問判定で循環を切る。
        place(key, left - (measure(key).min || 0), 0);
        // 別ルートとの重なりを避ける。
        left += measure(key).width;
    });
    // SVGの接続線を数値座標だけから生成する。
    const edges = rows
        .filter((row) => positions.has(row.parentKey) && row.key !== row.parentKey)
        .map((row) => {
            // 両端の配置済み座標を取得する。
            const parent = positions.get(row.parentKey);
            // 子の座標を取得する。
            const child = positions.get(row.key);
            // 上下の中間で直交線を曲げる。
            const middle = (parent.y + cardHeight + child.y) / 2;
            // サーバー文字列をSVGへ挿入しない。
            return {
                key: row.key,
                d: `M${parent.x + cardWidth / 2},${parent.y + cardHeight} V${middle} H${child.x + cardWidth / 2} V${child.y}`
            };
        });
    // 可視な範囲だけの大きさを返す。
    return {
        rows,
        edges,
        width: Math.max(600, left + 24),
        height,
        countText: `${mode === 'ROLE' ? '表示ロール数' : '表示上司数'}：${rows.length}`
    };
}

// 選択対象の名称に、参照可能な上司の役職だけを補足する。
export function memberSelectionLabel(node, mode) {
    // 未選択では見出しの対象名称を空にする。
    if (!node) return '';
    // 上司モードで登録済みの役職だけを補足へ使用する。
    const title = mode === 'MANAGER' && node.titleState === 'VALUE' ? node.title?.trim() : '';
    // 未登録・非参照の役職で区切りだけを表示しない。
    return [node.label, title].filter(Boolean).join('・');
}

// 直接所属ユーザーの一ページを一覧表示値へ変換する。
export function memberView(nodes = [], urls = {}) {
    // 可視なユーザーだけを、生成済みリンクと同じ行へ対応させる。
    return nodes
        .filter((node) => node.kind === 'USER')
        .map((node) => ({
            ...node,
            userUrl: urls[node.recordId],
            managerUrl: urls[node.managerId]
        }));
}

// 同じマネージャーのURLを一ページ内で重複生成しない。
export function memberProfileIds(nodes = []) {
    // ロールや未設定の関連先をリンク候補へ含めない。
    return [
        ...new Set(
            nodes
                .filter((node) => node.kind === 'USER')
                .flatMap((node) => [node.recordId, node.managerId])
                .filter(Boolean)
        )
    ];
}

// URL形式の固定を避け、標準のUserページをナビゲーションへ依頼する。
export function userProfileReference(recordId) {
    // ユーザー設定画面ではなく標準のユーザープロフィールを対象にする。
    return { type: 'standard__recordPage', attributes: { recordId, objectApiName: 'User', actionName: 'view' } };
}

// 列の順序と表示形式は固定し、サーバーから許可された項目だけを採用する。
export function memberColumns(fields = [], labels = {}) {
    // 任意のクライアント入力を項目定義として使わない。
    const definitions = [
        {
            fieldName: 'userUrl',
            type: 'url',
            typeAttributes: { label: { fieldName: 'label' }, target: '_blank' }
        },
        {
            fieldName: 'email',
            type: 'readOnlyEmail'
        },
        { fieldName: 'department', type: 'text' },
        { fieldName: 'title', type: 'text' },
        {
            label: 'マネージャー',
            fieldName: 'managerUrl',
            type: 'url',
            typeAttributes: { label: { fieldName: 'managerName' }, target: '_blank' }
        },
        { fieldName: 'employeeNumber', type: 'text' },
        { label: 'プロファイル', fieldName: 'profileName', type: 'text' },
        { label: 'ロール', fieldName: 'roleName', type: 'text' },
        { fieldName: 'isActive', type: 'readOnlyCheckbox', typeAttributes: { label: labels.isActive } }
    ];
    // 許可された列だけに同じ応答の項目ラベルを対応させる。
    return definitions.flatMap((column) => {
        // リンク列も表示元のUser項目で権限とラベルを照合する。
        const field = column.typeAttributes?.label?.fieldName || column.fieldName;
        // 参照列だけ固定見出しを優先し、その他は項目情報に従う。
        const label = column.label || labels[field];
        // 権限のない列や空の見出しを表示しない。
        return fields.includes(field) && label ? [{ ...column, label }] : [];
    });
}

// 一覧カーソルの対象件数から総ページ数を算出する。
export function memberPageLabel(index, memberCount, hasNext) {
    // 表示番号は成功した取得位置に対応する。
    const current = index + 1;
    // 未集計を0件と推定せず、分かっているページ位置だけを表示する。
    if (!Number.isInteger(memberCount) || memberCount < 0) return `${current} / ${hasNext ? '—' : current}`;
    // 人数は表示せず、空一覧も先頭の1ページとして扱う。
    const pages = Math.max(1, current + (hasNext ? 1 : 0), Math.ceil(Math.min(memberCount, 100000) / 50));
    // 全ユーザーの追加取得や件数照会を行わない。
    return `${current} / ${pages}`;
}
