// カード配置の座標に対する標準表示サイズを定義する。
export const BASE_SCALE = 0.85;

// 倍率を表示可能な範囲に収める。
export function clamp(value, minimum, maximum) {
    // 有限値だけを許可する。
    return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : 0));
}

// 図の大きさで移動距離を制限せず、不正な座標だけ直前の位置に戻す。
export function panTo(viewport, point) {
    // ドラッグとズームで同じ有限値の確認を使用する。
    return {
        x: Number.isFinite(point.x) ? point.x : viewport.x,
        y: Number.isFinite(point.y) ? point.y : viewport.y
    };
}

// 画面上の注目点を固定したまま拡大縮小する。
export function zoomAt(viewport, scale, point) {
    // 固定された倍率範囲に収める。
    const nextScale = clamp(scale, BASE_SCALE * 0.25, BASE_SCALE * 2);
    // 拡大前のワールド座標を計算する。
    const worldX = (point.x - viewport.x) / viewport.scale;
    // 同じ基準で縦位置を計算する。
    const worldY = (point.y - viewport.y) / viewport.scale;
    // ポインタ位置から同じワールド位置が動かない平行移動量を返す。
    return {
        scale: nextScale,
        ...panTo(viewport, { x: point.x - worldX * nextScale, y: point.y - worldY * nextScale })
    };
}

// 最上位カードの中央を横中央、上端を表示領域の上部へ合わせる。
export function alignRoot(node, bounds) {
    // 描画に使用した数値と同じ位置・幅から中央を求める。
    const layout = node?.layout;
    // 未描画や不正な座標では等倍の原点へ戻す。
    if (!layout || ![layout.x, layout.y, layout.width].every(Number.isFinite) || layout.width <= 0)
        return { x: 0, y: 0, scale: BASE_SCALE };
    // カードの半幅を考慮し、上端には余白を確保する。
    return {
        scale: BASE_SCALE,
        x: bounds.width / 2 - (layout.x + layout.width / 2) * BASE_SCALE,
        y: 24 - layout.y * BASE_SCALE
    };
}