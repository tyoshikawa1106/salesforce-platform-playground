import { zoomAt, alignRoot, clamp } from '../orgExplorerCanvasLogic';
describe('表示座標', () => {
    it('大きな図でも拡大縮小の注目点が移動制限でずれない', () => {
        const before = { x: -534820.4, y: -250000, scale: 0.85 };
        const point = { x: 700, y: 300 };
        const after = zoomAt(before, 0.935, point);
        expect((point.x - after.x) / after.scale).toBeCloseTo((point.x - before.x) / before.scale);
        expect((point.y - after.y) / after.scale).toBeCloseTo((point.y - before.y) / before.scale);
    });
    it('不正な注目点では直前の有限な位置を維持する', () => {
        const before = { x: -534820.4, y: -250000, scale: 0.85 };
        expect(zoomAt(before, 0.935, { x: Infinity, y: NaN })).toEqual({ ...before, scale: 0.935 });
    });
    it('ズームしてもポインタのワールド座標を保つ', () => {
        const before = { x: 20, y: 30, scale: 1 };
        const point = { x: 200, y: 150 };
        const after = zoomAt(before, 2, point);
        expect((point.x - after.x) / after.scale).toBe((point.x - before.x) / before.scale);
        expect((point.y - after.y) / after.scale).toBe((point.y - before.y) / before.scale);
        expect(zoomAt(before, 10, point).scale).toBe(1.7);
        expect(zoomAt(before, 0, point).scale).toBeCloseTo(0.2125);
        expect(clamp(Infinity, 0.25, 2)).toBe(0.25);
    });
    it('最上位カードを等倍で横中央・縦上部へ合わせる', () => {
        const position = alignRoot({ layout: { x: 1024, y: 124, width: 220 } }, { width: 600, height: 480 });
        expect(position.scale).toBe(0.85);
        expect(position.x + (1024 + 110) * position.scale).toBe(300);
        expect(position.y + 124 * position.scale).toBe(24);
        expect(alignRoot(undefined, { width: 600, height: 480 })).toEqual({ x: 0, y: 0, scale: 0.85 });
        expect(alignRoot({ layout: { x: NaN, y: 0, width: 220 } }, {})).toEqual({ x: 0, y: 0, scale: 0.85 });
    });
});

it('横幅を広げた上司カードも等倍で中央に配置する', () => {
    const position = alignRoot({ layout: { x: 1024, y: 24, width: 300 }, style: 'CSSの書式には依存しない' }, { width: 800 });
    expect(position.x + (1024 + 150) * position.scale).toBe(400);
    expect(position.y + 24 * position.scale).toBe(24);
});

it.each([
    { x: 0, y: Infinity, width: 220 },
    { x: 0, y: 0, width: 0 },
    { x: 0, y: 0, width: -1 }
])('不正な配置では有限の等倍位置へ戻す: %o', (layout) => {
    expect(alignRoot({ layout }, { width: 800 })).toEqual({ x: 0, y: 0, scale: 0.85 });
});
