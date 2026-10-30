import { createElement } from 'lwc';
import OrgExplorerCanvas from 'c/orgExplorerCanvas';
import * as canvasLogic from '../orgExplorerCanvasLogic';

function mockFrames() {
    const scheduled = new Map();
    let frameId = 0;
    const request = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
        scheduled.set(++frameId, callback);
        return frameId;
    });
    const cancel = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => scheduled.delete(id));
    return {
        scheduled,
        request,
        restore: () => {
            request.mockRestore();
            cancel.mockRestore();
        }
    };
}

async function createDraggableCanvas() {
    const element = createElement('c-org-explorer-canvas', { is: OrgExplorerCanvas });
    document.body.appendChild(element);
    await Promise.resolve();
    const viewport = element.shadowRoot.querySelector('.c-viewport');
    viewport.setPointerCapture = jest.fn();
    return { element, viewport };
}

function pointerEvent(name, x, y) {
    const event = new CustomEvent(name, { bubbles: true, cancelable: true });
    Object.assign(event, { button: 0, pointerId: 1, clientX: x, clientY: y });
    return event;
}

function readPosition(element) {
    const style = element.shadowRoot.querySelector('.c-plane').getAttribute('style');
    const [, x, y, scale] = style.match(/translate\(([-\d.]+)px,([-\d.]+)px\) scale\(([-\d.]+)\)/);
    return { x: Number(x), y: Number(y), scale: Number(scale) };
}

afterEach(() => {
    while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
});
it('拡大と縮小の後も等倍操作で正確に100%へ戻す', async () => {
    const element = createElement('c-org-explorer-canvas', { is: OrgExplorerCanvas });
    document.body.appendChild(element);
    await Promise.resolve();
    expect(element.shadowRoot.querySelector('.c-caption').textContent).toBe('表示ロール数：0 ｜ ズーム 100%');
    element.adjustZoom(0.45);
    await Promise.resolve();
    expect(element.shadowRoot.querySelector('.c-caption').textContent).toContain('145%');
    expect(element.shadowRoot.querySelector('.c-plane').getAttribute('style')).toContain('scale(1.2325)');
    element.resetZoom();
    await Promise.resolve();
    expect(element.shadowRoot.querySelector('.c-caption').textContent).toContain('100%');
    element.adjustZoom(-0.3);
    await Promise.resolve();
    expect(element.shadowRoot.querySelector('.c-caption').textContent).toContain('70%');
    element.resetZoom();
    await Promise.resolve();
    expect(element.shadowRoot.querySelector('.c-caption').textContent).toContain('100%');
    await expect(element).toBeAccessible();
});
it('初期表示は100%で、全体表示は手動だけにしスクロールで切り替えない', async () => {
    const element = createElement('c-org-explorer-canvas', { is: OrgExplorerCanvas });
    document.body.appendChild(element);
    await Promise.resolve();
    element.model = {
        rows: [{ key: 'ROLE:root', kind: 'ROLE', depth: 0, scopes: [], style: 'left:1000px;top:24px;', layout: { x: 1000, y: 24, width: 220 } }],
        edges: [],
        width: 2000,
        height: 800
    };
    await Promise.resolve();
    await Promise.resolve();
    expect(element.shadowRoot.querySelector('.c-plane').getAttribute('style')).toContain('scale(0.85)');
    element.fit();
    await Promise.resolve();
    expect(element.shadowRoot.querySelector('.c-plane').getAttribute('style')).toContain('scale(0.3)');
    const viewport = element.shadowRoot.querySelector('.c-viewport');
    viewport.dispatchEvent(new WheelEvent('wheel', { ctrlKey: true, deltaY: -1, cancelable: true }));
    await Promise.resolve();
    expect(element.shadowRoot.querySelector('.c-plane').getAttribute('style')).toContain('scale(0.385)');
    viewport.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, cancelable: true }));
    await Promise.resolve();
    expect(element.shadowRoot.querySelector('.c-plane').getAttribute('style')).toContain('scale(0.385)');
    await Promise.resolve();
    expect(element.shadowRoot.querySelector('.c-plane').getAttribute('style')).toContain('scale(0.385)');
});
it('子ロールの選択や表示の移動に関係なく等倍で最上位を上部中央へ戻す', async () => {
    const element = createElement('c-org-explorer-canvas', { is: OrgExplorerCanvas });
    element.model = {
        rows: [
            { key: 'ROLE:root', kind: 'ROLE', scopes: [], depth: 0, style: 'left:1000px;top:24px;', layout: { x: 1000, y: 24, width: 220 } },
            { key: 'ROLE:child', kind: 'ROLE', scopes: [], depth: 1, style: 'left:1500px;top:192px;', layout: { x: 1500, y: 192, width: 220 } }
        ],
        edges: [],
        width: 2000,
        height: 800
    };
    document.body.appendChild(element);
    await Promise.resolve();
    element.adjustZoom(0.45);
    element.resetZoom();
    await Promise.resolve();
    const style = element.shadowRoot.querySelector('.c-plane').getAttribute('style');
    const coordinates = style.match(/translate\(([-\d.]+)px,([-\d.]+)px\) scale\(([-\d.]+)\)/);
    expect(Number(coordinates[3])).toBe(0.85);
    expect(Number(coordinates[1]) + 1110 * Number(coordinates[3])).toBeCloseTo(300);
    expect(Number(coordinates[2]) + 24 * Number(coordinates[3])).toBeCloseTo(24);
});

it('全体表示の上限と下限も標準サイズに対する100%と25%で扱う', async () => {
    const element = createElement('c-org-explorer-canvas', { is: OrgExplorerCanvas });
    document.body.appendChild(element);
    element.fit();
    await Promise.resolve();
    expect(element.shadowRoot.querySelector('.c-caption').textContent).toContain('100%');
    expect(element.shadowRoot.querySelector('.c-plane').getAttribute('style')).toContain('scale(0.85)');
    element.model = { rows: [], edges: [], width: 10000, height: 10000, countText: '表示ロール数：0' };
    element.fit();
    await Promise.resolve();
    expect(element.shadowRoot.querySelector('.c-caption').textContent).toContain('25%');
    expect(element.shadowRoot.querySelector('.c-plane').getAttribute('style')).toContain('scale(0.2125)');
});

it('広い図でも初期位置から小さく動かせて、25%で右下の末端まで移動できる', async () => {
    const frames = mockFrames();
    try {
        const { element, viewport } = await createDraggableCanvas();
        const edge = { x: 1259800, y: 600000, width: 220 };
        element.model = {
            rows: [
                { key: 'ROLE:root', kind: 'ROLE', depth: 0, layout: { x: 630000, y: 24, width: 220 } },
                { key: 'ROLE:edge', kind: 'ROLE', depth: 1, layout: edge }
            ],
            edges: [],
            width: 1260048,
            height: 600200
        };
        await Promise.resolve();
        await Promise.resolve();
        const before = readPosition(element);
        viewport.dispatchEvent(pointerEvent('pointerdown', 10, 10));
        viewport.dispatchEvent(pointerEvent('pointermove', 20, 25));
        viewport.dispatchEvent(pointerEvent('pointerup', 20, 25));
        await Promise.resolve();
        expect(readPosition(element)).toEqual({ ...before, x: before.x + 10, y: before.y + 15 });

        element.fit();
        await Promise.resolve();
        const fitted = readPosition(element);
        expect(fitted.scale).toBeCloseTo(0.2125);
        viewport.dispatchEvent(pointerEvent('pointerdown', 0, 0));
        viewport.dispatchEvent(pointerEvent('pointermove', 24 - edge.x * fitted.scale - fitted.x, 24 - edge.y * fitted.scale));
        viewport.dispatchEvent(pointerEvent('pointerup', 0, 0));
        await Promise.resolve();
        const after = readPosition(element);
        expect(after.x + edge.x * after.scale).toBeCloseTo(24);
        expect(after.y + edge.y * after.scale).toBeCloseTo(24);

        viewport.dispatchEvent(pointerEvent('pointerdown', 0, 0));
        viewport.dispatchEvent(pointerEvent('pointermove', Infinity, NaN));
        viewport.dispatchEvent(pointerEvent('pointerup', 0, 0));
        await Promise.resolve();
        expect(readPosition(element)).toEqual(after);
    } finally {
        document.body.replaceChildren();
        frames.restore();
    }
});

it('ドラッグ途中で切断しても再接続後のポインタ移動で図が動かない', async () => {
    const frames = mockFrames();
    const { scheduled, request } = frames;
    try {
        const { element, viewport } = await createDraggableCanvas();
        viewport.dispatchEvent(pointerEvent('pointerdown', 10, 10));
        viewport.dispatchEvent(pointerEvent('pointermove', 30, 40));
        expect(scheduled.size).toBe(1);
        document.body.removeChild(element);
        expect(scheduled.size).toBe(0);
        document.body.appendChild(element);
        await Promise.resolve();
        const before = element.shadowRoot.querySelector('.c-plane').getAttribute('style');
        viewport.dispatchEvent(pointerEvent('pointermove', 90, 100));
        expect(request).toHaveBeenCalledTimes(1);
        expect(element.shadowRoot.querySelector('.c-plane').getAttribute('style')).toBe(before);
        viewport.dispatchEvent(pointerEvent('pointerdown', 90, 100));
        viewport.dispatchEvent(pointerEvent('pointermove', 110, 120));
        expect(request).toHaveBeenCalledTimes(2);
        for (const callback of scheduled.values()) callback();
        await Promise.resolve();
        expect(element.shadowRoot.querySelector('.c-plane').getAttribute('style')).not.toBe(before);
        document.body.removeChild(element);
    } finally {
        frames.restore();
    }
});

it.each(['reset', 'fit', 'zoom', 'wheel'])('描画待ちのドラッグを終了し%s操作の位置を維持する', async (action) => {
    const frames = mockFrames();
    const { scheduled } = frames;
    try {
        const { element, viewport } = await createDraggableCanvas();
        viewport.dispatchEvent(pointerEvent('pointerdown', 10, 10));
        viewport.dispatchEvent(pointerEvent('pointermove', 110, 110));
        expect(scheduled.size).toBe(1);
        viewport.dispatchEvent(pointerEvent('pointerup', 110, 110));
        await Promise.resolve();
        expect(element.shadowRoot.querySelector('.c-plane').getAttribute('style')).toContain('translate(100px,100px)');
        viewport.dispatchEvent(pointerEvent('pointerdown', 110, 110));
        viewport.dispatchEvent(pointerEvent('pointermove', 210, 210));
        expect(scheduled.size).toBe(1);
        if (action === 'reset') element.resetZoom();
        else if (action === 'fit') element.fit();
        else if (action === 'zoom') element.adjustZoom(0.15);
        else viewport.dispatchEvent(new WheelEvent('wheel', { ctrlKey: true, deltaY: -1, cancelable: true }));
        expect(scheduled.size).toBe(0);
        await Promise.resolve();
        const settled = element.shadowRoot.querySelector('.c-plane').getAttribute('style');
        for (const callback of scheduled.values()) callback();
        viewport.dispatchEvent(pointerEvent('pointermove', 210, 210));
        await Promise.resolve();
        expect(scheduled.size).toBe(0);
        expect(element.shadowRoot.querySelector('.c-plane').getAttribute('style')).toBe(settled);
    } finally {
        document.body.replaceChildren();
        frames.restore();
    }
});

it('非同期フレームの例外は本文なしの診断で親へ通知し、予約を解放する', async () => {
    const frames = mockFrames();
    const { element, viewport } = await createDraggableCanvas();
    const failure = jest.fn();
    element.addEventListener('clienterror', failure);
    const position = new Proxy({}, { ownKeys() { throw new TypeError('private-value'); } });
    const pan = jest.spyOn(canvasLogic, 'panTo').mockReturnValue(position);
    try {
        viewport.dispatchEvent(pointerEvent('pointerdown', 10, 10));
        viewport.dispatchEvent(pointerEvent('pointermove', 20, 20));
        expect(() => [...frames.scheduled.values()][0]()).not.toThrow();
        expect(failure).toHaveBeenCalledTimes(1);
        expect(failure.mock.calls[0][0].detail.location).toBe('orgExplorerCanvas.js / handlePointerMove / animation-frame');
        expect(JSON.stringify(failure.mock.calls[0][0].detail)).not.toContain('private-value');
    } finally {
        pan.mockRestore();
        frames.restore();
    }
});


it('pointer捕捉とフレーム予約が使えなくてもドラッグを継続し、領域外で終了する', async () => {
    const frames = mockFrames();
    frames.request.mockImplementation(() => { throw new TypeError('unsupported'); });
    try {
        const { element, viewport } = await createDraggableCanvas();
        viewport.setPointerCapture = undefined;
        viewport.dispatchEvent(pointerEvent('pointerdown', 10, 20));
        viewport.dispatchEvent(pointerEvent('pointermove', 30, 50));
        await Promise.resolve();
        expect(readPosition(element)).toEqual({ x: 20, y: 30, scale: canvasLogic.BASE_SCALE });
        viewport.dispatchEvent(pointerEvent('pointerleave', 30, 50));
        viewport.dispatchEvent(pointerEvent('pointermove', 60, 80));
        await Promise.resolve();
        expect(readPosition(element)).toEqual({ x: 20, y: 30, scale: canvasLogic.BASE_SCALE });
        await expect(element).toBeAccessible();
    } finally {
        frames.restore();
    }
});

it('pointer捕捉がTypeErrorを投げても操作を終了できる', async () => {
    const frames = mockFrames();
    try {
        const { element, viewport } = await createDraggableCanvas();
        viewport.setPointerCapture = () => { throw new TypeError('unsupported'); };
        viewport.dispatchEvent(pointerEvent('pointerdown', 5, 10));
        viewport.dispatchEvent(pointerEvent('pointermove', 15, 30));
        viewport.dispatchEvent(pointerEvent('pointerup', 15, 30));
        await Promise.resolve();
        expect(readPosition(element)).toEqual({ x: 10, y: 20, scale: canvasLogic.BASE_SCALE });
        expect(frames.scheduled.size).toBe(0);
    } finally {
        frames.restore();
    }
});

it('フレーム取消が使えなくても古い予約でズーム後の位置を上書きしない', async () => {
    const frames = mockFrames();
    const cancel = window.cancelAnimationFrame;
    try {
        window.cancelAnimationFrame = undefined;
        const { element, viewport } = await createDraggableCanvas();
        viewport.dispatchEvent(pointerEvent('pointerdown', 0, 0));
        viewport.dispatchEvent(pointerEvent('pointermove', 30, 40));
        element.resetZoom();
        const callbacks = [...frames.scheduled.values()];
        callbacks.forEach((callback) => callback());
        await Promise.resolve();
        expect(readPosition(element)).toEqual({ x: 0, y: 0, scale: canvasLogic.BASE_SCALE });
    } finally {
        window.cancelAnimationFrame = cancel;
        frames.restore();
    }
});


it('操作対象の機能がない場合は例外本文でなく固定の具体的な理由コードを返す', async () => {
    const { element, viewport } = await createDraggableCanvas();
    const listener = jest.fn();
    element.addEventListener('clienterror', listener);
    viewport.closest = undefined;
    viewport.dispatchEvent(pointerEvent('pointerdown', 0, 0));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail.code).toBe('ORG-JS-DOM-TARGET');
});
