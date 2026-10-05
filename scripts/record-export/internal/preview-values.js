// 用途: 空欄の補完候補をまとめて取得し、項目順の確定処理へ最新の実値だけを渡す。

const { QUERY_TIMEOUT_CODES } = require('./error-definitions');

// 応答のない一回の検索を制限し、成功が続く補完全体は時間だけで打ち切らない。
const SUPPLEMENT_TIMEOUT_MS = 60000;

// 実レコードを検索しないプレビューの保存位置であり、SOQLや取得元IDには使用しない。
const GENERATED_RECORD_KEY = 'generated-preview';

// 住所全体と構成項目で同じデモ用値を使い、元データを問い合わせない。
const SAMPLE_ADDRESS = Object.freeze({
    street: 'サンプル町1-2-3',
    city: 'サンプル市',
    state: '東京都',
    stateCode: '13',
    country: 'JP',
    countryCode: 'JP',
    postalCode: '000-0000',
    latitude: 35.681236,
    longitude: 139.767125,
    geocodeAccuracy: 'Address'
});

// 項目名の推測ではなく、型と複合項目の所属から生成対象を決める。
function sampleForField(field, definitions) {
    // 指定項目が構成項目だけでも、Describe全体から親を確認する。
    const parent = definitions.get(field.compoundFieldName?.toLowerCase());
    // 住所・位置情報の構成項目を、通常の文字列・数値として検索しない。
    if (parent && ['address', 'location'].includes(parent.type)) {
        // カスタム複合項目は__cを外し、標準住所はAddressを外して構成名を求める。
        const prefix = parent.name.endsWith('__c')
            ? `${parent.name.slice(0, -3)}__`
            : parent.name.replace(/Address$/, '');
        // 標準位置情報は親名を持たないLatitude・Longitudeも構成項目として扱う。
        const component =
            parent.type === 'location' && ['Latitude', 'Longitude'].includes(field.name)
                ? field.name
                : field.name.startsWith(prefix)
                  ? field.name.slice(prefix.length).replace(/__s$/, '')
                  : '';
        // RESTが返すプロパティ名に揃えて固定値を参照する。
        const key = component.charAt(0).toLowerCase() + component.slice(1);
        // 位置情報の親では緯度・経度以外を生成しない。
        const value =
            parent.type === 'address' || ['latitude', 'longitude'].includes(key) ? SAMPLE_ADDRESS[key] : undefined;
        // 未知の構成項目は空欄と理由を残し、問い合わせによる漏れを防ぐ。
        return value === undefined ? { value: null, status: 'NO_SAMPLE_VALUE' } : { value, status: 'GENERATED' };
    }
    // 候補はレコードタイプで絞らず、有効な既定値を優先する。
    if (['picklist', 'multipicklist'].includes(field.type)) {
        // 無効な候補と空文字をデモ用の有効値として扱わない。
        const choices = (field.picklistValues || []).filter(
            (item) => item.active && typeof item.value === 'string' && item.value !== ''
        );
        // 複数選択でも一つの候補だけを採用する。
        const choice = choices.find((item) => item.defaultValue) || choices[0];
        // 有効な候補がなくても実データを補完検索しない。
        return choice ? { value: choice.value, status: 'GENERATED' } : { value: null, status: 'NO_PICKLIST_VALUE' };
    }
    // 一部分の伏字ではなく、元の値に依存しない固定値へ置き換える。
    if (field.type === 'email') return { value: 'demo@example.com', status: 'GENERATED' };
    // 電話とFAXは同じphone型として扱う。
    if (field.type === 'phone') return { value: '000-0000-0000', status: 'GENERATED' };
    // 複合住所はCSVの一セルに格納できるオブジェクトとして生成する。
    if (field.type === 'address') return { value: { ...SAMPLE_ADDRESS }, status: 'GENERATED' };
    // 単独の位置情報も住所内の座標と同じ値を使う。
    if (field.type === 'location')
        return {
            value: { latitude: SAMPLE_ADDRESS.latitude, longitude: SAMPLE_ADDRESS.longitude },
            status: 'GENERATED'
        };
    // それ以外の型だけが実値の取得対象になる。
    return undefined;
}

// 補完だけの失敗は元レコードを保持して続行し、認証・API利用上限などは停止する。
const SKIPPABLE_CODES = new Set([
    ...QUERY_TIMEOUT_CODES,
    'CLI_TIMEOUT',
    'SUPPLEMENT_TIMEOUT',
    'NETWORK_TIMEOUT',
    'NETWORK_ERROR',
    'CLI_FAILED',
    'QUERY_FAILED',
    'INVALID_FIELD',
    'INSUFFICIENT_ACCESS',
    'MALFORMED_QUERY',
    'INVALID_QUERY_FILTER_OPERATOR',
    'QUERY_LENGTH_LIMIT',
    'QUERY_TOO_COMPLICATED',
    'BUFFER_LIMIT'
]);

// 取得した値と、利用者へ結果を確定する順序を分離する。
function createPreviewResolver({ fields, record, scope, searchBatch, hasValue, canFilterNonNull, report = () => {} }) {
    // 補完しない項目や元から値のある項目を追加検索へ含めない。
    const missing = fields.filter(
        (field) => !field.invalid && !hasValue(record[field.name]) && canFilterNonNull(field)
    );
    // 項目名ごとに最初に見つかった最新値だけを保持する。
    const resolved = new Map();
    // 確定済み項目には再問い合わせせず、最大5項目の結果を共有する。
    return async function resolve(field) {
        // 保留・値なし・値ありのいずれも確定後はキャッシュから返す。
        if (!resolved.has(field.name)) {
            // 未確定の対象だけを指定順で最大5項目に絞る。
            const pending = missing.filter((candidate) => !resolved.has(candidate.name)).slice(0, 5);
            // 対象範囲外の呼び出しを値なしと誤認しない。
            if (!pending.some((candidate) => candidate.name === field.name))
                throw new Error('補完対象の項目範囲が一致しません。');
            // 応答のない通信を待ち続けず、時間超過は失敗として記録する。
            const started = performance.now();
            // 同じ通信に含まれる最大5検索の待ち時間を制限する。
            const deadline = started + SUPPLEMENT_TIMEOUT_MS;
            // 実行位置はサーバーから通知されないため、送信した対象項目を正確に表示する。
            const label = `補完検索中: ${pending.map((item) => item.name).join(', ')}`;
            // 一項目だけを取得中と誤解させず、今回の送信対象を通知する。
            report(field, label);
            // 通信待ち中も経過時間を表示し、処理停止との区別を可能にする。
            const timer = setInterval(
                () =>
                    report(
                        field,
                        `${label} / 応答待ち：${((performance.now() - started) / 1000).toFixed(0)}秒経過・残り上限${Math.max(0, Math.ceil((deadline - performance.now()) / 1000))}秒`
                    ),
                10000
            );
            // 通信全体の失敗と、各検索が返した失敗を同じ項目別処理へ渡す。
            let outcomes;
            // 応答の取得が終わるまで次のグループを送らない。
            try {
                // SOQLは独立させたまま、通信とCLI起動だけをまとめる。
                outcomes = await searchBatch(pending, scope, { deadline });
            } catch (error) {
                // 通信失敗ではどの検索が完了したか不明なので、値なしと確定しない。
                outcomes = pending.map(() => ({ error }));
            } finally {
                // 成功・失敗のどちらでも待機表示を終了する。
                clearInterval(timer);
            }
            // 診断済みの同一エラーを最大5回繰り返し表示しない。
            const reported = new Set();
            // 他項目の成功・失敗を混ぜず、項目名をキーに確定結果を保存する。
            pending.forEach((candidate, index) => {
                // 各応答は収集側で件数・ID・項目の完全性を検証済み。
                const outcome = outcomes[index];
                // 個別エラーがあっても正常な他項目の値を保持する。
                if (outcome.error) {
                    // 認証・保存・不正応答などの致命的な失敗は該当項目の順番で停止する。
                    if (!SKIPPABLE_CODES.has(outcome.error.code)) {
                        // 項目順で保存済みの結果までを再開可能な状態へ残す。
                        resolved.set(candidate.name, { error: outcome.error });
                        // スキップ可能な失敗へ変換しない。
                        return;
                    }
                    // 生の本文を含めず、安全化された診断だけを表示する。
                    if (outcome.error.diagnostic && !reported.has(outcome.error)) {
                        // 詳細は一通信について一度だけ表示する。
                        report(
                            candidate,
                            `検索エラー: ${candidate.name} / ${outcome.error.code} / ${outcome.error.diagnostic}`
                        );
                        // 同じ通信エラーが後続項目に出ても重複表示しない。
                        reported.add(outcome.error);
                    }
                    // 検索失敗は確定して保存し、同じ項目を自動再試行しない。
                    resolved.set(candidate.name, {
                        skipped: outcome.error.code,
                        diagnostic: outcome.error.diagnostic || `分類コード: ${outcome.error.code} / 詳細情報なし`,
                        elapsedSeconds: ((performance.now() - started) / 1000).toFixed(1)
                    });
                    // エラーを正常な値なしに置き換えない。
                    return;
                }
                // 非NULL条件に一致した先頭レコードだけを採用する。
                const row = outcome.rows[0];
                // レコードがあるのに値がない応答を正常扱いしない。
                if (row && !hasValue(row[candidate.name])) {
                    // 矛盾した応答は再問い合わせせず、再開情報を残して停止する。
                    resolved.set(candidate.name, { error: new Error('非NULL検索の応答に補完可能な値がありません。') });
                    // 未確認の値をCSVへ入れない。
                    return;
                }
                // ゼロ件の検索結果だけを値なしとして確定し、次回の対象から外す。
                resolved.set(candidate.name, row ? { value: row[candidate.name], source: row.Id } : null);
            });
        }
        // 項目の指定順で失敗を通知し、それ以前の確定結果を保存できるようにする。
        const result = resolved.get(field.name);
        // 全体停止が必要な失敗をスキップで隠さない。
        if (result?.error) throw result.error;
        // 空欄はnull、実値があれば値と取得元IDを返す。
        return result;
    };
}

module.exports = { createPreviewResolver, sampleForField, GENERATED_RECORD_KEY, SUPPLEMENT_TIMEOUT_MS };
