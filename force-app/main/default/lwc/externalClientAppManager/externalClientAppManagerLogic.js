// 未選択を明示し、表示名とAPI名から対象を識別する
export function applicationOptions(applications = []) {
    // 空値の選択肢は対象を自動選択しないために先頭へ置く
    return [
        { label: '-- なし --', value: '' },
        ...applications.map((app) => ({ label: `${app.label} (${app.name})`, value: app.id }))
    ];
}

// Apexが公開した案内だけを画面へ表示する
export function errorMessage(error) {
    // JavaScript例外や生の通信本文は公開しない
    return error?.body?.message || '処理結果を確認できません。再実行せず、現在の状態を確認してください。';
}

// ステージの公開属性と状態に応じた説明だけを表示する
export function stageRows(stages) {
    // 応答欠落を空一覧とみなして更新ボタンを有効にしない
    if (!Array.isArray(stages)) {
        // 呼出元が公開用案内へ変換し、未取得状態を維持する
        throw new Error('ステージ一覧の応答が不正です。');
    }
    // 認証情報が混入しても画面の状態へ保持しない
    return stages.map(({ id, state, expirationDate }) => ({
        id,
        state,
        expirationDate,
        canDelete: ['active', 'rotated', 'expired'].includes(state?.toLowerCase()),
        stateLabel:
            { active: '未適用', rotated: '適用済み', expired: '期限切れ' }[state?.toLowerCase()] ||
            '不明'
    }));
}

// 本人が確認する操作内容と送信値を一つの表示モデルにまとめる
export function stageOperation(action, application, stage, confirmationId) {
    // 公開された参照・更新操作だけをサーバーへ送る
    if (!['stages', 'generate', 'apply', 'deleteStage'].includes(action)) throw new Error('操作が不正です。');
    // 適用と削除では同じ確認済みの行をサーバーへ照合させる
    const input = {
        action,
        appId: application.id,
        confirmation: application.name,
        confirmationId,
        ...(stage ? { stageId: stage.id, stageState: stage.state } : {})
    };
    // 削除確認は資格情報の状態に合わせて対象と確認事項を示す
    if (action === 'deleteStage') {
        // 未適用と期限切れを旧コンシューマ鍵と秘密の切り替え確認と混同しない
        const credentialLabel = {
            active: '未適用のコンシューマ鍵と秘密',
            rotated: '旧コンシューマ鍵と秘密',
            expired: '期限切れのコンシューマ鍵と秘密'
        }[stage.state?.toLowerCase()] || 'コンシューマ鍵と秘密';
        // 旧コンシューマ鍵と秘密を削除する前だけ連携先の切り替え確認を促す
        const notice = stage.state?.toLowerCase() === 'rotated'
            ? '連携先が新しい鍵と秘密に切り替わっていることを確認してください。'
            : '削除した鍵と秘密は利用できなくなります。';
        // API名とステージIDの列挙を避け、削除対象を簡潔に伝える
        return {
            input,
            message: `「${application.label}」の${credentialLabel}を削除します。${notice}削除してよろしいですか？`
        };
    }
    // 参照・生成・適用では表示しない確認文を組み立てない
    return { input };
}

// 15桁をチェックサム付き18桁へ揃え、大文字小文字の異なるIDを混同しない
export function normalizedApplicationId(value) {
    // 入力前後の空白だけを除く
    const id = (value || '').trim();
    // 外部クライアントアプリの正式な長さと文字だけを受け付ける
    if (!/^0xI[a-zA-Z0-9]{12}([a-zA-Z0-9]{3})?$/.test(id)) return '';
    // 15桁部分の大文字位置からSalesforceのチェックサムを計算する
    const suffix = [0, 5, 10]
        .map((offset) => {
            // 各5文字の大文字位置をビットへ変換する
            const bits = [...id.slice(offset, offset + 5)].reduce(
                (mask, char, index) => mask + (/[A-Z]/.test(char) ? 1 << index : 0),
                0
            );
            // Salesforce IDの符号表で一文字へ変換する
            return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ012345'[bits];
        })
        .join('');
    // 18桁の場合は入力チェックサムも照合する
    return id.length === 18 && id.slice(15) !== suffix ? '' : id.slice(0, 15) + suffix;
}

// 自動更新は今回生成した一件だけを次工程へ引き継ぐ
export function automationStage(stages, stageId, expectedState) {
    // 今回のIDと期待する状態に一致する行だけを候補にする
    const matches = stages.filter(
        (row) => row.id && (!stageId || row.id === stageId) && row.state?.toLowerCase() === expectedState
    );
    // 旧コンシューマ鍵と秘密の共存を許容し、対象の欠落と重複は拒否する
    if (matches.length !== 1) {
        // 公開案内は呼出元で工程名と合わせる
        throw new Error('自動更新の対象を確認できません。');
    }
    // 検証済みの同一ステージだけを返す
    return matches[0];
}