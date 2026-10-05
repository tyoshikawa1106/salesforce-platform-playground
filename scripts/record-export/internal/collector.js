// 用途: 最新レコードの対象を固定して取得し、指定順の縦型・横型CSVへ変換する。

const { createPreviewResolver } = require('./preview-values');

// RecordTypeのIDだけを許可し、空文字やSOQL式を受け付けない。
const RECORD_TYPE_ID_PATTERN = /^012(?:[A-Za-z0-9]{12}|[A-Za-z0-9]{15})$/;

// 項目指定ファイルを検証し、初出の順序を保って重複を除去する。
function parseFields(text) {
    // 空行、BOM、コメント行を入力項目から除く。
    const names = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
    // 関連項目パスやSOQL式を許さず、直下のAPI名だけを受け付ける。
    if (!names.length || names.some((name) => !/^[A-Za-z][A-Za-z0-9_]*$/.test(name))) {
        // 不正な入力は組織への問い合わせ前に停止する。
        throw new Error('項目ファイルには1行1項目のAPI名を指定してください。関連項目パスや式は使えません。');
    }
    // 大文字小文字を同一視した既出名を保持し、配列の繰り返し検索を避ける。
    const seen = new Set();
    // 最初の表記と指定順を維持したまま、重複だけを除く。
    return names.filter((name) => {
        // 比較用の名前と出力する元の表記を分ける。
        const key = name.toLowerCase();
        // 既出の項目を再度検索対象へ含めない。
        if (seen.has(key)) {
            // 重複した指定を除外する。
            return false;
        }
        // 後続の指定との重複判定に使用する。
        seen.add(key);
        // 初出の項目を元の位置に残す。
        return true;
    });
}

// false・0を実値として保持し、空の複合値も補完対象にする。
function hasValue(value) {
    // NULLと空文字だけを空欄として扱う。
    if (value === null || value === undefined || value === '') {
        // 未入力であることを返す。
        return false;
    }
    // 住所などはREST補助属性を除いた構成要素で判定する。
    if (typeof value === 'object') {
        // 実値を含む構成要素が1つでもあれば採用する。
        return Object.entries(value).some(([key, part]) => key !== 'attributes' && hasValue(part));
    }
    // チェックなしやゼロを失わない。
    return true;
}

// filterableでも距離条件専用の複合項目は非NULL比較の対象にしない。
function canFilterNonNull(field) {
    // 住所・位置情報の構成項目は通常の型なので、それぞれの定義に従う。
    return field.filterable && field.type !== 'address' && field.type !== 'location';
}

// 指定項目と、最新順・IDによる分割取得の成立条件を確認する。
function validateDescribe(describe, names, options) {
    // 未確認のオブジェクト名をSOQLへ含めない。
    if (!describe?.queryable || !Array.isArray(describe.fields) || !/^[A-Za-z][A-Za-z0-9_]*$/.test(describe.name)) {
        // 検索できない定義では続行しない。
        throw new Error('対象オブジェクトの検索可能なDescribeを取得できませんでした。');
    }
    // 指定順を変えずにAPI名を正規化するための索引を作る。
    const definitions = new Map(describe.fields.map((field) => [field.name.toLowerCase(), field]));
    // 最新順の選択とIDによる照合に必須の項目を確認する。
    if (
        !definitions.get('createddate')?.sortable ||
        !definitions.get('id')?.sortable ||
        !definitions.get('id')?.filterable
    ) {
        // 任意順へのフォールバックで「最新」と誤認させない。
        throw new Error('最新順の取得にはソート可能なCreatedDate・Idと検索可能なIdが必要です。');
    }
    // 作成日指定時は境界形式とWHERE条件の対応可否を検証する。
    if (
        options.createdBefore !== undefined &&
        (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(options.createdBefore) ||
            !Number.isFinite(Date.parse(options.createdBefore)) ||
            !definitions.get('createddate')?.filterable)
    )
        throw new Error('作成日の絞り込みには正しい日時と検索可能なCreatedDateが必要です。');
    // レコードタイプ指定時だけ、項目の検索可否とオブジェクトへの所属を確認する。
    if (options.recordTypeId !== undefined) {
        // 呼び出し元に依存せず、SOQLへ渡すIDの形式を検証する。
        if (!RECORD_TYPE_ID_PATTERN.test(options.recordTypeId)) {
            // 不正な識別子では検索を開始しない。
            throw new Error('レコードタイプIDの形式が不正です。');
        }
        // レコードタイプ非対応のオブジェクトにWHERE条件を付けない。
        if (!definitions.get('recordtypeid')?.filterable) {
            // 条件を外して続行せず停止する。
            throw new Error('対象オブジェクトに検索可能なRecordTypeIdがありません。');
        }
        // Describeが返す対象オブジェクトのレコードタイプだけを受け付ける。
        const recordType = describe.recordTypeInfos?.find(
            (info) =>
                typeof info.recordTypeId === 'string' &&
                (info.recordTypeId === options.recordTypeId ||
                    (options.recordTypeId.length === 15 && info.recordTypeId.slice(0, 15) === options.recordTypeId))
        );
        // 別オブジェクト・別組織のIDや確認できないIDを使用しない。
        if (!recordType) {
            // 不存在とアクセス制限を断定せず、Describeで確認できないと案内する。
            throw new Error('指定したレコードタイプIDを対象オブジェクトのDescribeで確認できません。');
        }
    }
    // 未確認項目も位置を保持し、検索対象外であることを明示して返す。
    return names.map((name) => definitions.get(name.toLowerCase()) || { name, label: '', type: '', invalid: true });
}

// 部分取得や必要項目の欠落を空欄と誤認しない。
function recordsFrom(result, fields) {
    // CLIのページ取得打ち切りも全体失敗にする。
    if (
        !Array.isArray(result?.records) ||
        result.done === false ||
        (typeof result.totalSize === 'number' && result.totalSize !== result.records.length) ||
        result.records.some((record) => !record || fields.some((field) => !Object.hasOwn(record, field)))
    ) {
        // 生の応答はエラーへ含めない。
        throw new Error('クエリ応答が不完全です。CSVの出力を中止しました。');
    }
    // 照合やSOQLで使うIDは正しい文字種と長さに限定する。
    if (
        result.records.some((record) => !/^(?:[A-Za-z0-9]{15}|[A-Za-z0-9]{18})$/.test(record.Id)) ||
        new Set(result.records.map((record) => record.Id)).size !== result.records.length
    ) {
        // 不正IDや重複行を別レコードの値として採用しない。
        throw new Error('クエリ応答のレコードIDが不正または重複しています。');
    }
    // 検証したレコードだけを後段へ渡す。
    return result.records;
}

// 対象IDを固定し、成功した範囲だけを保存先へ渡して取得値を蓄積しない。
async function collectRecords(
    describe,
    fields,
    options,
    query,
    writeLine = console.log,
    onChunk,
    updateLine = () => {}
) {
    // 分割後も指定ファイル内の項目番号を維持する。
    const fieldPositions = new Map(fields.map((field, index) => [field.name, index + 1]));
    // レコードタイプ指定を選択・取得・補完で共有する。
    const scope = [
        ...(options.recordTypeId ? [`RecordTypeId = '${options.recordTypeId}'`] : []),
        ...(options.createdBefore ? [`CreatedDate < ${options.createdBefore}`] : [])
    ];
    // 同日時の場合も順序を固定する。
    const order = ' ORDER BY CreatedDate DESC NULLS LAST, Id DESC';
    // 実際のSOQL全体を使って文字数を計算する。
    function buildQuery(columns, conditions, limit, ordered) {
        // 条件がある場合だけWHEREを付ける。
        return `SELECT ${columns.join(',')} FROM ${describe.name}${conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''}${ordered ? order : ''} LIMIT ${limit}`;
    }
    // 不完全な応答を正常な取得として保存しない。
    async function search(columns, conditions, limit, ordered = true) {
        // 送信前にSOQL本文の上限を確認する。
        const soql = buildQuery(columns, conditions, limit, ordered);
        // 項目またはIDを分割できる呼び出し元へ制限を通知する。
        if (soql.length > 100000) {
            // 生のクエリはエラー本文に含めない。
            throw Object.assign(new Error('SOQLの文字数上限を超えました。'), { code: 'QUERY_LENGTH_LIMIT' });
        }
        // 権限に関係する失敗では、取得対象項目の説明にも確認箇所を表示する。
        let result;
        // 生のAPI本文を表示せず、確認できたエラーコードだけで案内する。
        try {
            // 元のクエリ回数と取得範囲を維持する。
            result = await query(soql);
        } catch (error) {
            // 項目名の誤りと権限不足を断定せず、APIが示す原因候補を案内する。
            if (error.code === 'INVALID_FIELD' || error.code === 'INSUFFICIENT_ACCESS') {
                // 一括検索では失敗した単一項目を特定できないため対象全体と明示する。
                for (const name of columns.filter((name) => fieldPositions.has(name))) {
                    // 項目番号を先頭に置き、補完状況と同じ説明形式に揃える。
                    writeLine(
                        `[${fieldPositions.get(name)}/${fields.length}項目]\t${name}\t検索失敗の対象：項目参照権限を確認してください。${error.code === 'INVALID_FIELD' ? 'API名が存在しない可能性もあります。' : 'オブジェクトの参照権限も確認してください。'}`
                    );
                }
            }
            // 権限不足を空欄として保存せず、従来どおり停止する。
            throw error;
        }
        // API応答の完全性とIDの一意性を検証する。
        const records = recordsFrom(result, columns);
        // 指定件数を超える応答は受け付けない。
        if (records.length > limit) {
            // 条件違反を切り捨てて隠さない。
            throw new Error('指定件数を超えるクエリ応答です。');
        }
        // 検証した結果だけを利用する。
        return records;
    }
    // 最初の対象選択では値を取得せずIDと順序を確定する。
    const limit = options.mode === 'record-fields-preview' ? 1 : options.recordLimit;
    // 選択中の件数を表示する。
    writeLine(`最新レコードを取得中（最大${limit}件）`);
    // 分割再取得でもこの集合を変えない。
    const selected = options.resumeSelected ?? (await search(['Id', 'CreatedDate'], scope, limit));
    // 初回の対象選択を、値の検索前に再開用データとして確定する。
    await options.onSelected?.(selected);
    // テストや小規模の直接呼び出しだけがメモリ上に結果を保持する。
    const byId = onChunk ? null : new Map(selected.map((row) => [row.Id, {}]));
    // プレビューの取得元を保持する。
    const sources = new Map();
    // 成功した範囲を順次保存し、再試行した値を重複させない。
    async function readGroup(ids, group) {
        // 未確認項目をSOQLへ含めず、CSVの位置だけ保持する。
        const readable = group.filter((field) => !field.invalid);
        // 照合用IDを必ず取得する。
        const columns = [...new Set(['Id', ...readable.map((field) => field.name)])];
        // 1件なら等価条件、複数件なら固定したID集合を指定する。
        const conditions = [
            ...scope,
            ids.length === 1 ? `Id = '${ids[0]}'` : `Id IN (${ids.map((id) => `'${id}'`).join(',')})`
        ];
        // 長さが原因なら、送信せず上限に収まる最大範囲を計算する。
        if (readable.length && buildQuery(columns, conditions, ids.length, false).length > 100000) {
            // 項目が1レコードでも収まらない場合だけ、まず項目を分割する。
            const splitFields = buildQuery(columns, [...scope, `Id = '${ids[0]}'`], 1, false).length > 100000;
            // 二分探索で上限内の最大件数または項目数を求める。
            let low = 0;
            // 少なくとも片方の軸を縮める。
            let high = splitFields ? group.length : ids.length;
            // 固定件数ではなく、実際に送る文字列の長さで判定する。
            while (low < high) {
                // 同じ境界で停滞しないよう切り上げる。
                const middle = Math.ceil((low + high) / 2);
                // 項目分割時は照合用Idを含める。
                const trialColumns = splitFields
                    ? [
                          ...new Set([
                              'Id',
                              ...group
                                  .slice(0, middle)
                                  .filter((field) => !field.invalid)
                                  .map((field) => field.name)
                          ])
                      ]
                    : columns;
                // 項目側の長さ計算は1ID、レコード側は候補ID集合で行う。
                const trialIds = splitFields ? ids.slice(0, 1) : ids.slice(0, middle);
                // WHERE・LIMIT・空白も含めて計算する。
                const trialConditions = [
                    ...scope,
                    trialIds.length === 1
                        ? `Id = '${trialIds[0]}'`
                        : `Id IN (${trialIds.map((id) => `'${id}'`).join(',')})`
                ];
                // 上限内ならさらに多くまとめられるか確認する。
                if (buildQuery(trialColumns, trialConditions, trialIds.length, false).length <= 100000) low = middle;
                // 上限超過なら候補を縮める。
                else high = middle - 1;
            }
            // 1項目・1レコードでも送れない場合は停止する。
            if (!low)
                throw Object.assign(new Error('最小単位でもSOQLの文字数上限を超えます。'), {
                    code: 'QUERY_LENGTH_LIMIT'
                });
            // 事前分割と失敗後の再分割を区別して表示する。
            writeLine(`事前分割: SOQL文字数上限・${splitFields ? '項目' : 'レコード'}を最大${low}ずつ取得`);
            // 計算した最大範囲ごとに処理し、不要な細分化を避ける。
            for (let offset = 0; offset < (splitFields ? group.length : ids.length); offset += low) {
                // 両方の軸が長い場合も、再帰先で再計算する。
                await readGroup(
                    splitFields ? ids : ids.slice(offset, offset + low),
                    splitFields ? group.slice(offset, offset + low) : group
                );
            }
            // 上限超過の元クエリは送信しない。
            return;
        }
        // 再分割の対象にするのはクエリ実行の失敗だけに限定する。
        let records;
        // ディスク書き込みや補完の失敗を再分割で隠さない。
        try {
            // SOQL長と応答サイズの検証は共通の入口で行う。
            records = readable.length
                ? await search(columns, conditions, ids.length, false)
                : ids.map((Id) => ({ Id }));
        } catch (error) {
            // サイズと複雑さ以外は再試行せず停止する。
            const sizeError = error.code === 'BUFFER_LIMIT';
            // 文字数超過と数式展開は項目を優先して分割する。
            const queryError = error.code === 'QUERY_TOO_COMPLICATED';
            // 各再試行は必ず対象を縮小し、最小単位で終了する。
            if (sizeError && ids.length > 1) {
                // 応答量を減らす場合はレコード集合を二分する。
                const middle = Math.ceil(ids.length / 2);
                // 値を含めず再分割理由を表示する。
                writeLine(`再分割: ${error.code}・レコード数を縮小`);
                // 前半の成功を保存してから後半へ進む。
                await readGroup(ids.slice(0, middle), group);
                // 元のID集合を過不足なく取得する。
                await readGroup(ids.slice(middle), group);
                // 元の失敗範囲を重ねて保存しない。
                return;
            }
            // 1レコードでも大きい場合、またはクエリが複雑な場合は項目を二分する。
            if ((sizeError || queryError) && group.length > 1) {
                // 各レコードについて指定項目順を維持する。
                const middle = Math.ceil(group.length / 2);
                // 再分割は自動で行い、引数の再調整を求めない。
                writeLine(`再分割: ${error.code}・項目数を縮小`);
                // 前半の項目を取得する。
                await readGroup(ids, group.slice(0, middle));
                // 後半も同じID集合で照合する。
                await readGroup(ids, group.slice(middle));
                // 元の失敗範囲を保存しない。
                return;
            }
            // これ以上分割できない制限は、利用者へ理由を示して停止する。
            if (sizeError || queryError) {
                // 組織データを含めず、対象項目名と制限コードだけを知らせる。
                throw Object.assign(
                    new Error(`取得範囲を縮小しても ${group[0].name} を取得できません (${error.code})。`),
                    { code: error.code }
                );
            }
            // 認証・権限などは分割せず元の安全な診断を返す。
            throw error;
        }
        // 指定IDの欠落や混入を検知する。
        const expected = new Set(ids);
        // 応答順に依存せず、全IDが一度ずつ返ることを確認する。
        if (records.length !== ids.length || records.some((row) => !expected.has(row.Id))) {
            // 途中で消失したレコードを空欄へ置き換えない。
            throw new Error('取得中に対象レコードが変化したか、応答に欠落があります。再実行してください。');
        }
        // 1応答分だけを保持し、項目グループ間では一時ファイルを使う。
        for (const record of records) {
            // 未確認項目だけを明示的な空欄とし、取得成功した項目の欠落は許容しない。
            for (const field of group.filter((field) => field.invalid)) {
                // 指定位置の空セルを保存処理へ渡す。
                record[field.name] = null;
            }
            // 未確認項目には取得元レコードを付けない。
            const chunkSources = new Map(group.map((field) => [field.name, field.invalid ? '' : record.Id]));
            // プレビューの空欄だけを補完する。
            if (options.mode === 'record-fields-preview') {
                // 先読み候補を共有し、出力と保存だけは各項目の順番で行う。
                const resolvePreview = createPreviewResolver({
                    fields: group,
                    record,
                    scope,
                    search,
                    hasValue,
                    canFilterNonNull
                });
                // 一項目の補完が終わるごとに再開位置を確定する。
                for (const field of group) {
                    // WHERE不可の項目には追加検索を行わない。
                    await supplementPreviewField({
                        field,
                        resolvePreview,
                        record,
                        sources: chunkSources,
                        writeLine,
                        updateLine,
                        fieldPositions,
                        totalFields: fields.length
                    });
                    // 次項目で失敗しても、完了した値を失わない。
                    if (onChunk) await onChunk(record.Id, [field], record, chunkSources, selected[0]?.Id || '');
                }
            }
            // 実行入口はこの保存先を使って値を順次退避する。
            if (onChunk && options.mode !== 'record-fields-preview') {
                // 保存完了を待ち、バックプレッシャーを維持する。
                await onChunk(record.Id, group, record, chunkSources, selected[0]?.Id || '');
            } else if (!onChunk) {
                // 小規模テストでも同じ取得・検証処理を使う。
                for (const field of group) {
                    // 内部照合用のIDは指定されている場合だけ含める。
                    byId.get(record.Id)[field.name] = record[field.name];
                    // プレビューの出自を記録する。
                    sources.set(field.name, chunkSources.get(field.name));
                }
            }
        }
    }
    // 手動指定がある場合だけ項目数の上限を使う。
    const groupSize = options.fieldsPerQuery || fields.length;
    // 保存済みの項目数が同じレコードをまとめ、完了範囲を再取得しない。
    const pending = new Map();
    // 初回は全レコードが先頭項目から始まる。
    for (const row of selected) {
        // 保存が完了した項目境界からのみ再開する。
        const start = options.resumeOffsets?.get(row.Id) || 0;
        // 全項目完了のレコードは追加検索しない。
        if (start >= fields.length) continue;
        // 同じ開始位置のIDをまとめる。
        if (!pending.has(start)) pending.set(start, []);
        // 選択時の順序を維持して追加する。
        pending.get(start).push(row.Id);
    }
    // 再開時も固定件数で細分化せず、未完了範囲をまとめて検索する。
    for (const [start, ids] of pending) {
        // 手動上限と適応分割は初回と同じ処理を使う。
        for (let offset = start; offset < fields.length; offset += groupSize) {
            // 保存済み列へ戻らず連続した未完了範囲だけを渡す。
            await readGroup(ids, fields.slice(offset, offset + groupSize));
        }
    }
    // 横型は全レコードの取得後に、対象なしの場合も指定順で結果を通知する。
    if (options.mode !== 'record-fields-preview' || !selected.length) {
        // 分割回数やレコード数によって同じ項目を繰り返し列挙しない。
        for (const field of fields) {
            // 未確認項目と、対象なし・取得成功を分けて表示する。
            const explanation = field.invalid
                ? '取得不可：API名が存在しない、または項目参照権限がありません'
                : selected.length
                  ? '取得成功・補完なし'
                  : '対象レコードなし';
            // 項目番号は指定ファイル全体に対する番号を維持する。
            writeLine(`[${fieldPositions.get(field.name)}/${fields.length}項目]\t${field.name}\t${explanation}`);
        }
    }
    // 本番経路ではIDと件数だけを返し、値を再び読み込まない。
    return {
        fields,
        records: byId ? selected.map((row) => byId.get(row.Id)) : [],
        sources,
        latestId: selected[0]?.Id || '',
        ids: selected.map((row) => row.Id),
        recordCount: selected.length
    };
}

// 一項目の空欄を補完し、結果と取得元を確定して次項目の保存へ進める。
async function supplementPreviewField({
    field,
    record,
    sources,
    resolvePreview,
    writeLine,
    updateLine,
    fieldPositions,
    totalFields
}) {
    // 分割内の番号ではなく指定ファイル全体での番号を表示する。
    const prefix = `[${fieldPositions.get(field.name)}/${totalFields}項目]\t${field.name}\t`;
    // 未確認項目も指定順の位置で表示し、正常項目の進捗を先回りしない。
    if (field.invalid) {
        // エラー項目は検索せず空欄のまま保存する。
        writeLine(`${prefix}取得不可：API名が存在しない、または項目参照権限がありません`);
        // 補完不要・補完完了とは表示しない。
        return;
    }
    // falseと0を含め、基準レコードにある実値は保持する。
    if (hasValue(record[field.name])) {
        // 値そのものを含めず、補完不要だったことを示す。
        writeLine(`${prefix}取得成功`);
        // 非NULL検索を追加しない。
        return;
    }
    // 値がない項目に取得元を表示しない。
    sources.set(field.name, '');
    // WHEREで絞り込めない項目は全件探索せず、元の値を保持する。
    if (!canFilterNonNull(field)) {
        // 未検索と値なしを区別できるよう、スキップ理由を表示する。
        writeLine(`${prefix}補完対象外：非NULL条件で検索不可・最新レコードの値を保持`);
        // この項目への補完クエリは実行しない。
        return;
    }
    // 実値をログへ出さず、処理中の項目を知らせる。
    updateLine(`${prefix}補完中`);
    // 補完検索にかかった実時間を失敗した項目とともに残す。
    const started = performance.now();
    // 取得失敗を値なしとして処理しない。
    let found;
    // 非対話端末でも停止した項目を特定できるようにする。
    try {
        // まとめ取得済みなら追加検索せず、必要な残項目だけ検索する。
        found = await resolvePreview(field);
    } catch (error) {
        // 実値や生本文を表示せず、固定形式のコードだけを案内する。
        const code =
            typeof error.code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(error.code) ? error.code : 'QUERY_FAILED';
        // 一時表示が消えても項目番号と原因を残す。
        writeLine(`${prefix}補完失敗：${code} / 経過: ${((performance.now() - started) / 1000).toFixed(1)}秒`);
        // 保存済み項目を保持する既存の停止・再開処理へ渡す。
        throw error;
    }
    // 空の複合値などを補完成功と扱わず、実値だけ採用する。
    if (found) {
        // 空欄だった項目だけを補完する。
        record[field.name] = found.value;
        // CSVに表示する実際の取得元を保持する。
        sources.set(field.name, found.source);
        // 補完の完了を値を含めずに通知する。
        writeLine(`${prefix}補完成功`);
    } else {
        // 未取得を補完成功と誤認させない。
        writeLine(`${prefix}登録レコードなし`);
    }
}

// 引用符・改行・複合値を保持し、空欄とfalse・0を区別する。
function csv(value) {
    // 複合値は1セルにJSONで保存する。
    const text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    // CSVの引用符を二重化する。
    return `"${text.replace(/"/g, '""')}"`;
}

// 項目順を変えず、縦型または横型のCSVに変換する。
function toCsv(result, mode) {
    // 縦型は各項目の値・定義・補完元を1行にする。
    if (mode === 'record-fields-preview') {
        // 対象なしはヘッダーだけにし、空の基準レコードを作らない。
        const rows = result.records.length
            ? result.fields.map((field) => {
                  // 値の有無と補完元の違いを区別する。
                  const source = result.sources.get(field.name);
                  // 基準と補完をStatusで明示し、別レコードの値を同じレコードの実値と誤認させない。
                  const status = field.invalid
                      ? 'INVALID_FIELD'
                      : !hasValue(result.records[0][field.name])
                        ? canFilterNonNull(field)
                            ? 'NO_VALUE_FOUND'
                            : 'NOT_FILTERABLE'
                        : source === result.latestId
                          ? 'LATEST'
                          : 'SUPPLEMENTED';
                  // 指定された項目の順のまま属性と実値を出力する。
                  return [field.name, field.label, field.type, result.records[0][field.name], status, source]
                      .map(csv)
                      .join(',');
              })
            : [];
        // 縦型の固定列とCRLFを使用する。
        return ['FieldApiName,Label,Type,Value,Status,SourceRecordId', ...rows, ''].join('\r\n');
    }
    // 横型の列は指定API名だけに限定する。
    const header = result.fields.map((field) => csv(field.name)).join(',');
    // レコード順と空欄を保持し、内部IDは指定された場合だけ出力する。
    const rows = result.records.map((record) => result.fields.map((field) => csv(record[field.name])).join(','));
    // 値が存在しない場合も列定義を出力する。
    return [header, ...rows, ''].join('\r\n');
}

module.exports = { collectRecords, parseFields, toCsv, validateDescribe, hasValue, RECORD_TYPE_ID_PATTERN, csv };
