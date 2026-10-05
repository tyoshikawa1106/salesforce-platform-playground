// 用途: 最新レコードの対象を固定して取得し、指定順の縦型・横型CSVへ変換する。

const { createPreviewResolver, sampleForField, GENERATED_RECORD_KEY } = require('./preview-values');

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
    if (!Array.isArray(describe?.fields) || !/^[A-Za-z][A-Za-z0-9_]*$/.test(describe.name)) {
        // 検索できない定義では続行しない。
        throw new Error('対象オブジェクトの検索可能なDescribeを取得できませんでした。');
    }
    // 指定順を変えずにAPI名を正規化するための索引を作る。
    const definitions = new Map(describe.fields.map((field) => [field.name.toLowerCase(), field]));
    // 横型は実値を保持し、プレビューだけに生成する値と判定結果を付ける。
    const fields = names.map((name) => {
        // 未確認の項目は型を推測せず、指定位置にエラー行を残す。
        const field = definitions.get(name.toLowerCase()) || { name, label: '', type: '', invalid: true };
        // 生成対象をクエリ組み立て前に確定する。
        const sample = options.mode === 'record-fields-preview' ? sampleForField(field, definitions) : undefined;
        // 元のDescribe定義を変更せず、今回の出力方針だけを付加する。
        return sample ? { ...field, sample } : field;
    });
    // すべて生成可能ならレコード検索に必要な項目・レコードタイプを検証しない。
    if (fields.some((field) => field.sample) && fields.every((field) => field.invalid || field.sample)) return fields;
    // 実値を読む場合だけオブジェクトの検索可否を要求する。
    if (!describe.queryable) throw new Error('対象オブジェクトを検索できません。');
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
    return fields;
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
    async function search(columns, conditions, limit, ordered = true, controls) {
        // 送信前にSOQL本文の上限を確認する。
        const soql = buildQuery(columns, conditions, limit, ordered);
        // 項目またはIDを分割できる呼び出し元へ制限を通知する。
        if (soql.length > 100000) {
            // 生のクエリはエラー本文に含めない。
            throw Object.assign(new Error('SOQLの文字数上限を超えました。'), { code: 'QUERY_LENGTH_LIMIT' });
        }
        // 権限に関係する失敗では、取得対象項目の説明にも確認箇所を表示する。
        let result;
        // 補完は専用の項目別表示があるため、通常取得だけここで進捗を知らせる。
        const label = `値取得：最大${limit}件・${columns.length}列（${columns[0]}〜${columns.at(-1)}）`;
        // 新しい問い合わせの開始を、実値を含めずに表示する。
        if (!controls) writeLine(`検索状況: ${label}`);
        // 通常取得も応答待ちで無表示にならないよう、経過時間を測る。
        const started = performance.now();
        // 補完のタイマーと二重表示しない。
        const timer = controls
            ? undefined
            : setInterval(
                  () =>
                      writeLine(
                          `検索状況: ${label} / 応答待ち：${((performance.now() - started) / 1000).toFixed(0)}秒経過`
                      ),
                  10000
              );
        // 生のAPI本文を表示せず、確認できたエラーコードだけで案内する。
        try {
            // 元のクエリ回数と取得範囲を維持する。
            result = await query(soql, controls);
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
            // 呼び出し元が通常取得の停止と補完スキップを区別する。
            throw error;
        } finally {
            // 正常終了とエラーのどちらでも待機表示を解除する。
            if (timer !== undefined) clearInterval(timer);
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
    // 各項目の最新非NULL値を独立検索し、一項目ずつ結果を確定する。
    async function searchBatch(pending, conditions, controls) {
        // 前回の取得値を途中CSVへ公開してから、次の通信待ちに入る。
        await options.beforeSupplementQuery?.();
        // 一つの条件へORでまとめず、各項目にLIMIT 1を適用する。
        const soqls = pending.map((field) =>
            buildQuery(['Id', field.name], [...conditions, `${field.name} != NULL`], 1, true)
        );
        // 長い名前や条件でもサーバーへ不正な長さを送らない。
        if (soqls.some((soql) => soql.length > 100000))
            throw Object.assign(new Error('SOQLの文字数上限を超えました。'), { code: 'QUERY_LENGTH_LIMIT' });
        // 個別検索の応答を要求順で受け取り、表示・保存の順序を維持する。
        const outcomes = await query.batch(soqls, controls);
        // 欠落した応答を別の項目へ割り当てない。
        if (outcomes.length !== pending.length) throw new Error('補完検索の応答件数が一致しません。');
        // エラーと結果を項目ごとに扱い、一つの失敗で成功した値を捨てない。
        return outcomes.map((outcome, index) => {
            // 通信先が返した安全化済みのエラーは、その項目だけへ渡す。
            if (outcome.error) return outcome;
            // 不完全なレコードも後続項目の結果と混ぜず、該当項目の順番で停止する。
            try {
                // 欠落・重複・取得件数を通常取得と同じ条件で検証する。
                const rows = recordsFrom(outcome.result, ['Id', pending[index].name]);
                // LIMIT 1を無視した応答は採用しない。
                if (rows.length > 1) throw new Error('指定件数を超える補完クエリ応答です。');
                // 呼び出し側はレコード配列から値ありと値なしを確定する。
                return { rows };
            } catch (error) {
                // 前の項目を保存できるよう、例外も要求順で渡す。
                return { error };
            }
        });
    }
    // 生成対象だけなら実レコードの存在確認も行わない。
    const generatedOnly =
        options.mode === 'record-fields-preview' &&
        fields.some((field) => field.sample) &&
        fields.every((field) => field.invalid || field.sample);
    // 最初の対象選択では値を取得せずIDと順序を確定する。
    const limit = options.mode === 'record-fields-preview' ? 1 : options.recordLimit;
    // 選択中の件数を表示する。
    writeLine(generatedOnly ? 'サンプル生成のみ（レコード検索なし）' : `最新レコードを取得中（最大${limit}件）`);
    // 分割再取得でもこの集合を変えない。
    const selected =
        options.resumeSelected ??
        (generatedOnly ? [{ Id: GENERATED_RECORD_KEY }] : await search(['Id', 'CreatedDate'], scope, limit));
    // 初回の対象選択を、値の検索前に再開用データとして確定する。
    await options.onSelected?.(selected);
    // テストや小規模の直接呼び出しだけがメモリ上に結果を保持する。
    const byId = onChunk ? null : new Map(selected.map((row) => [row.Id, {}]));
    // プレビューの取得元を保持する。
    const sources = new Map();
    // 補完を打ち切った結果を実際のNULLと区別し、CSVと再開記録へ渡す。
    const statuses = new Map();
    // 失敗した項目の診断だけを保持し、CSVと再開記録へ同じ内容を渡す。
    const errorDetails = new Map();
    // 初回取得済みで、まだ補完検索していない空欄だけを保持する。
    const supplements = new Map(options.resumeSupplements || []);
    // 成功した範囲を順次保存し、再試行した値を重複させない。
    async function readGroup(ids, group) {
        // 未確認項目をSOQLへ含めず、CSVの位置だけ保持する。
        const readable = group.filter((field) => !field.invalid && !field.sample);
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
                                  .filter((field) => !field.invalid && !field.sample)
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
            // 未確認項目と生成対象には、応答に含まれない値を明示して保存する。
            for (const field of group) {
                // 未確認の型から実値やダミー値を推測しない。
                if (field.invalid) record[field.name] = null;
                // 生成対象の元データはクエリへ含めず、固定値だけを保持する。
                else if (field.sample) {
                    // 住所などのオブジェクトも後続処理では変更しない。
                    record[field.name] = field.sample.value;
                    // 実レコードから取得した値と区別する。
                    statuses.set(field.name, field.sample.status);
                }
            }
            // 生成値と未確認項目には取得元レコードを付けない。
            const chunkSources = new Map(
                group.map((field) => [
                    field.name,
                    field.invalid || field.sample || !hasValue(record[field.name]) ? '' : record.Id
                ])
            );
            // プレビューの初回取得では補完クエリを実行しない。
            if (options.mode === 'record-fields-preview') {
                // 初回取得の結果と補完待ちを同じ取得範囲の断片へまとめる。
                for (const field of group) {
                    // 生成対象は空欄でも補完しない。
                    if (field.invalid || field.sample || hasValue(record[field.name]) || !canFilterNonNull(field))
                        continue;
                    // 未検索と登録レコードなしを区別して保存する。
                    statuses.set(field.name, 'PENDING_SUPPLEMENT');
                    // 空欄には取得元を付けない。
                    chunkSources.set(field.name, '');
                }
                // fsyncと途中CSV更新を項目ごとに繰り返さず、取得範囲で一度だけ保存する。
                if (onChunk) await onChunk(record.Id, group, record, chunkSources, selected[0]?.Id || '', statuses);
                // 保存済みの初回結果を指定順に表示する。
                for (const field of group) {
                    // 初回取得の番号は全指定項目を分母にする。
                    const prefix = `[${fieldPositions.get(field.name)}/${fields.length}項目]\t${field.name}\t`;
                    // 検索可能な空欄は全項目の初回保存後に処理する。
                    if (statuses.get(field.name) === 'PENDING_SUPPLEMENT') {
                        // 実値ではなく空欄だけを後段へ保持する。
                        supplements.set(field.name, { field, value: record[field.name] });
                        // 再び全項目を処理するのではないことを明示する。
                        writeLine(`${prefix}空欄・補完待ち`);
                    } else if (field.sample) {
                        // 候補なしの場合も、実データを検索した結果とは区別する。
                        writeLine(
                            `${prefix}${field.sample.status === 'GENERATED' ? 'サンプル生成' : field.sample.status === 'NO_PICKLIST_VALUE' ? 'サンプル未生成：有効な選択肢なし' : 'サンプル未生成：構成項目に対応する値なし'}`
                        );
                    } else {
                        // 取得成功・未確認・検索不可の結果だけを通知し、検索は行わない。
                        await supplementPreviewField({
                            field,
                            statuses,
                            record,
                            sources: chunkSources,
                            writeLine,
                            fieldPositions,
                            totalFields: fields.length
                        });
                    }
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
    // 全項目の初回取得をCSVへ公開してから補完する。
    if (options.mode === 'record-fields-preview' && selected.length) {
        // 最後の取得範囲の端数も補完の通信前に公開する。
        await options.beforeSupplementQuery?.();
        // 完了した初回取得と、これから処理する空欄を区別する。
        writeLine(`初回取得完了: ${fields.length}項目 / 補完待ち ${supplements.size}項目`);
    }
    // 保存済みの成功・値なし・失敗を再検索せず、未処理の空欄だけを指定順に処理する。
    const pendingFields = fields.filter((field) => supplements.has(field.name));
    // 補完の進捗は補完対象だけを分母にする。
    const supplementPositions = new Map(pendingFields.map((field, index) => [field.name, index + 1]));
    // 対象がある場合だけ補完段階の開始を通知する。
    if (pendingFields.length) writeLine(`空欄補完を開始: ${pendingFields.length}項目`);
    // 補完の作業メモリを小さく保ち、各範囲の中でも一項目ずつ検索・保存する。
    for (let offset = 0; offset < pendingFields.length; offset += 5) {
        // 初回取得の分割境界とは独立して空欄だけをまとめる。
        const group = pendingFields.slice(offset, offset + 5);
        // 保持する補完候補値を最大5項目に制限する。
        const record = {
            Id: selected[0].Id,
            ...Object.fromEntries(group.map((field) => [field.name, supplements.get(field.name).value]))
        };
        // 補完に成功した項目だけ取得元を記録する。
        const chunkSources = new Map();
        // 応答の有無と検索失敗を区別した結果を指定順で取り出す。
        const resolvePreview = createPreviewResolver({
            fields: group,
            record,
            scope,
            searchBatch,
            hasValue,
            canFilterNonNull,
            // エラー診断を表示し、結果行と重複する残件数を付けない。
            report: (_field, message) => writeLine(message)
        });
        // 致命的なエラーでも、この範囲で保存済みの結果は公開する。
        try {
            // 取得した結果を元の項目順で一度だけ反映する。
            for (const field of group) {
                // 未検索の状態を今回の確定結果へ置き換える。
                statuses.delete(field.name);
                // タイムアウトや検索エラーはスキップとして確定する。
                await supplementPreviewField({
                    field,
                    record,
                    sources: chunkSources,
                    resolvePreview,
                    statuses,
                    writeLine,
                    fieldPositions: supplementPositions,
                    totalFields: pendingFields.length,
                    errorDetails
                });
                // CSV上では初回取得済みの同じ行だけを置き換える。
                if (onChunk)
                    await onChunk(
                        record.Id,
                        [field],
                        record,
                        chunkSources,
                        selected[0].Id,
                        statuses,
                        {
                            replace: true
                        },
                        errorDetails
                    );
                // 小規模の直接呼び出しも同じ項目だけを更新する。
                else {
                    // 別項目の実値へ影響させない。
                    byId.get(record.Id)[field.name] = record[field.name];
                    // 補完した実際の取得元を返す。
                    sources.set(field.name, chunkSources.get(field.name));
                }
                // 保存が成功した項目は、値なし・失敗でも今回の処理対象から外す。
                supplements.delete(field.name);
                // 同じ端末行で残件数を更新し、余分な進捗行を積み重ねない。
                updateLine(`進捗（補完）: 残り ${supplements.size}項目`);
            }
        } finally {
            // 公開は最大5項目の反映後にまとめる。
            await options.onSupplementBatch?.();
        }
    }
    // 補完を終えた場合だけ確定した終了行を残す。
    if (pendingFields.length) writeLine('補完完了');
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
        statuses,
        latestId: selected[0]?.Id || '',
        errorDetails,
        ids: selected.map((row) => row.Id),
        recordCount: selected.length,
        generatedOnly
    };
}

// 一項目の空欄を補完し、結果と取得元を確定して次項目の保存へ進める。
async function supplementPreviewField({
    field,
    record,
    sources,
    resolvePreview,
    statuses,
    writeLine,
    fieldPositions,
    totalFields,
    errorDetails
}) {
    // 呼び出し元の処理段階に対応する項目番号と件数を表示する。
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
    // タイムアウトや問い合わせ失敗を「登録レコードなし」に置き換えない。
    if (found?.skipped) {
        // 原因コードをCSVと再開記録の両方へ残す。
        statuses.set(field.name, `SKIPPED_${found.skipped}`);
        // 生本文を含まない診断を、該当する項目のCSV行と一緒に保存する。
        errorDetails.set(field.name, `${found.diagnostic} / 補完経過: ${found.elapsedSeconds}秒`);
        // 次の項目へ進むことと、検索した範囲の打ち切りを明示する。
        writeLine(`${prefix}補完スキップ：${found.skipped} / 検索経過: ${found.elapsedSeconds}秒`);
        // 検索失敗は確定済みとして保存し、自動再試行しない。
        return;
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

// 再開用の内部コードは変えず、途中・完成CSVに共通の日本語を表示する。
function csvStatus(status) {
    // 成功・未処理・検索不可を区別し、端末の結果表示と用語を揃える。
    const labels = {
        NOT_PROCESSED: '未処理',
        LATEST: '取得成功',
        SUPPLEMENTED: '補完成功',
        NO_VALUE_FOUND: '登録レコードなし',
        NOT_FILTERABLE: '補完対象外：非NULL条件で検索不可',
        INVALID_FIELD: '取得不可：API名が存在しない、または項目参照権限がありません',
        PENDING_SUPPLEMENT: '補完待ち',
        GENERATED: 'サンプル生成',
        NO_PICKLIST_VALUE: 'サンプル未生成：有効な選択肢なし',
        NO_SAMPLE_VALUE: 'サンプル未生成：構成項目に対応する値なし'
    };
    // 通常の結果は対応する日本語だけを出力する。
    if (labels[status]) return labels[status];
    // 補完失敗を値なしと混同せず、原因を日本語で示す。
    if (status.startsWith('SKIPPED_')) {
        // 原因コードは障害の切り分けに使えるよう併記する。
        const code = status.slice('SKIPPED_'.length);
        // CLI・通信・検索の失敗箇所を区別する。
        const reasons = {
            QUERY_TIMEOUT: '検索タイムアウト',
            REQUEST_RUNNING_TOO_LONG: '検索タイムアウト',
            CLI_TIMEOUT: 'CLI待機時間超過',
            SUPPLEMENT_TIMEOUT: '補完待機時間超過',
            NETWORK_TIMEOUT: '通信タイムアウト',
            NETWORK_ERROR: '通信エラー',
            CLI_FAILED: 'CLI実行失敗',
            QUERY_FAILED: '検索失敗',
            INVALID_FIELD: 'API名が存在しない、または項目参照権限がありません',
            INSUFFICIENT_ACCESS: '参照権限がありません',
            MALFORMED_QUERY: 'クエリが無効',
            INVALID_QUERY_FILTER_OPERATOR: '検索条件が無効',
            QUERY_LENGTH_LIMIT: 'クエリ長の上限超過',
            QUERY_TOO_COMPLICATED: 'クエリの複雑さの上限超過',
            BUFFER_LIMIT: '受信サイズの上限超過'
        };
        // 未分類でも失敗を隠さず、コードを保持する。
        return `補完スキップ：${reasons[code] || '検索失敗'}（${code}）`;
    }
    // 想定外の状態も成功へ置き換えない。
    return `状態不明（${status}）`;
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
                  const status =
                      result.statuses?.get(field.name) ||
                      (field.invalid
                          ? 'INVALID_FIELD'
                          : !hasValue(result.records[0][field.name])
                            ? canFilterNonNull(field)
                                ? 'NO_VALUE_FOUND'
                                : 'NOT_FILTERABLE'
                            : source === result.latestId
                              ? 'LATEST'
                              : 'SUPPLEMENTED');
                  // 生成値には実在する取得元がないため、取得元IDを空欄にする。
                  const sourceLabel = status === 'GENERATED' ? '' : source;
                  // 指定された項目の順のまま属性と実値を出力する。
                  return [
                      field.name,
                      field.label,
                      field.type,
                      result.records[0][field.name],
                      csvStatus(status),
                      sourceLabel,
                      result.errorDetails?.get(field.name) || ''
                  ]
                      .map(csv)
                      .join(',');
              })
            : [];
        // 縦型の固定列とCRLFを使用する。
        return ['FieldApiName,Label,Type,Value,Status,SourceRecordId,エラー詳細', ...rows, ''].join('\r\n');
    }
    // 横型の列は指定API名だけに限定する。
    const header = result.fields.map((field) => csv(field.name)).join(',');
    // レコード順と空欄を保持し、内部IDは指定された場合だけ出力する。
    const rows = result.records.map((record) => result.fields.map((field) => csv(record[field.name])).join(','));
    // 値が存在しない場合も列定義を出力する。
    return [header, ...rows, ''].join('\r\n');
}

module.exports = { collectRecords, parseFields, toCsv, validateDescribe, hasValue, RECORD_TYPE_ID_PATTERN, csv };
