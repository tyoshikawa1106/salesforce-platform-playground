// 呼び出し元が確定した例外種別と固定の処理位置を記録用情報へ整形
export function createLogDetails({ source, operation, phase, errorType, stack }) {
    // 例外本文や接続先を残さずJSファイル名と行・列だけを抽出
    const frames = typeof stack === 'string'
        ? [...new Set(stack.split('\n').slice(1).flatMap((line) => line.match(/[A-Za-z0-9_$.-]+\.m?js:\d+:\d+/g) || []))].slice(0, 8)
        : [];
    // 画面の状態やErrorオブジェクトを保持せず記録用の値だけ返す
    return { location: `${source} / ${operation} / ${phase}`, errorType, frames, frame: frames[0] || '' };
}

// 同じ記録の連続出力を抑止し、呼び出し元へ新規記録の有無を返す
export function recordLog(previous, details, prefix = 'LWC') {
    // 固定位置・種類・コード・公開案内・フレームが変わった記録だけ出力
    const duplicate = previous?.location === details.location
        && previous.errorType === details.errorType
        && previous.frames.join('|') === details.frames.join('|')
        && previous.code === details.code
        && previous.message === details.message;
    // 表示中の状態は呼び出し元に残し、重複では出力だけ省略
    if (duplicate) return false;
    // 自由文・応答本文・入力値をログへ渡さず、許可した診断属性だけ出力
    console.error(`${prefix}: 画面処理でエラーが発生しました。`, {
        location: details.location,
        errorType: details.errorType,
        code: details.code,
        frames: details.frames
    });
    // 記録後に表示状態を更新するかは画面側で決定
    return true;
}
