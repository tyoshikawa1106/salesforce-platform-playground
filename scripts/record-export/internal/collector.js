// 用途: 最新レコードの対象を固定して取得し、指定順の縦型・横型CSVへ変換する。

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
    // 複数の無効項目を一度に案内する。
    const invalid = names.filter((name) => !definitions.has(name.toLowerCase()));
    // 無効項目を欠落列として出力せず、検索前に止める。
    if (invalid.length) {
        // 指定されたAPI名だけを案内する。
        throw new Error(`Describeで確認できない項目があります: ${invalid.join(', ')}`);
    }
    // 最新順の選択とIDによる照合に必須の項目を確認する。
    if (
        !definitions.get('createddate')?.sortable ||
        !definitions.get('id')?.sortable ||
        !definitions.get('id')?.filterable
    ) {
        // 任意順へのフォールバックで「最新」と誤認させない。
        throw new Error('最新順の取得にはソート可能なCreatedDate・Idと検索可能なIdが必要です。');
    }
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
    // 正規API名と属性を指定ファイルと同じ順で返す。
    return names.map((name) => definitions.get(name.toLowerCase()));
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
async function collectRecords(describe, fields, options, query, writeLine = console.log, onChunk) {
    // レコードタイプ指定を選択・取得・補完で共有する。
    const scope = options.recordTypeId ? [`RecordTypeId = '${options.recordTypeId}'`] : [];
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
        // API応答の完全性とIDの一意性を検証する。
        const records = recordsFrom(await query(soql), columns);
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
    writeLine(`対象選択: 最新から最大${limit}件`);
    // 分割再取得でもこの集合を変えない。
    const selected = await search(['Id', 'CreatedDate'], scope, limit);
    // テストや小規模の直接呼び出しだけがメモリ上に結果を保持する。
    const byId = onChunk ? null : new Map(selected.map((row) => [row.Id, {}]));
    // プレビューの取得元を保持する。
    const sources = new Map();
    // 成功した範囲を順次保存し、再試行した値を重複させない。
    async function readGroup(ids, group) {
        // 照合用IDを必ず取得する。
        const columns = [...new Set(['Id', ...group.map((field) => field.name)])];
        // 1件なら等価条件、複数件なら固定したID集合を指定する。
        const conditions = [
            ...scope,
            ids.length === 1 ? `Id = '${ids[0]}'` : `Id IN (${ids.map((id) => `'${id}'`).join(',')})`
        ];
        // 長さが原因なら、送信せず上限に収まる最大範囲を計算する。
        if (buildQuery(columns, conditions, ids.length, false).length > 100000) {
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
                    ? [...new Set(['Id', ...group.slice(0, middle).map((field) => field.name)])]
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
            // 固定の100項目・200件分割をせず、指定された範囲を取得する。
            writeLine(`値取得: ${ids.length}レコード・${group.length}項目`);
            // SOQL長と応答サイズの検証は共通の入口で行う。
            records = await search(columns, conditions, ids.length, false);
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
            // この範囲の取得元を基準レコードで初期化する。
            const chunkSources = new Map(group.map((field) => [field.name, record.Id]));
            // プレビューの空欄だけを補完する。
            if (options.mode === 'record-fields-preview') {
                // WHERE不可の項目には追加検索を行わない。
                await supplementPreview({ fields: group, record, sources: chunkSources, scope, search, writeLine });
            }
            // 実行入口はこの保存先を使って値を順次退避する。
            if (onChunk) {
                // 保存完了を待ち、バックプレッシャーを維持する。
                await onChunk(record.Id, group, record, chunkSources, selected[0]?.Id || '');
            } else {
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
    // レコードがない場合はクエリを追加しない。
    if (selected.length) {
        // 指定順に連続した項目範囲を渡す。
        for (let offset = 0; offset < fields.length; offset += groupSize) {
            // すべての対象IDを最初はまとめて取得する。
            await readGroup(
                selected.map((row) => row.Id),
                fields.slice(offset, offset + groupSize)
            );
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

// 最新1件の空欄だけを補完し、項目ごとの取得元を記録する。
async function supplementPreview({ fields, record, sources, scope, search, writeLine }) {
    // 最新レコードに実値がある項目は補完しない。
    const missing = fields.filter((field) => !hasValue(record[field.name]));
    // 空欄の各項目について、検索可能な場合だけ最新の非NULL値を取得する。
    for (const field of missing) {
        // 値がない項目に取得元を表示しない。
        sources.set(field.name, '');
        // WHEREで絞り込めない項目は全件探索せず、元の値を保持する。
        if (!canFilterNonNull(field)) {
            // 未検索と値なしを区別できるよう、スキップ理由を表示する。
            writeLine(`補完対象外: ${field.name}（非NULL条件で検索不可・最新レコードの値を保持）`);
            // この項目への補完クエリは実行しない。
            continue;
        }
        // 実値をログへ出さず、処理中の項目を知らせる。
        writeLine(`空欄補完: ${field.name}（最新の非NULL値を検索）`);
        // レコードタイプ指定を維持し、日時の境界なしで最新1件を検索する。
        const found = await search([...new Set(['Id', field.name])], [...scope, `${field.name} != NULL`], 1);
        // 空の複合値などを補完成功と扱わず、実値だけ採用する。
        if (found.length && hasValue(found[0][field.name])) {
            // 空欄だった項目だけを補完する。
            record[field.name] = found[0][field.name];
            // CSVに表示する実際の取得元を保持する。
            sources.set(field.name, found[0].Id);
        }
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
                  const status = !hasValue(result.records[0][field.name])
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
