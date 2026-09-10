/* global jest */

import { createElement } from 'lwc';
import ObjectRecordFormModal from 'c/objectRecordFormModal';

// 本物のフォームを別のDOMへ描画し、標準モーダルのPromise契約だけを代替する。
export function mockModalOpen() {
    return jest.spyOn(ObjectRecordFormModal, 'open').mockImplementation((options) => {
        const modal = createElement('c-object-record-form-modal', { is: ObjectRecordFormModal });
        const { size, ...properties } = options;
        Object.assign(modal, properties);
        modal.dataset.size = size;
        return new Promise((resolve) => {
            modal.closeHandler = jest.fn((result) => {
                modal.remove();
                resolve(result);
            });
            document.body.appendChild(modal);
        });
    });
}

export function getModal() {
    return document.body.querySelector('c-object-record-form-modal');
}

export function getModalRoot() {
    return getModal()?.shadowRoot;
}
