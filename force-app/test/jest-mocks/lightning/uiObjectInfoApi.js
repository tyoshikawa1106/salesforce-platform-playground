const { createLdsTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');

module.exports = {
    getObjectInfo: createLdsTestWireAdapter(jest.fn())
};
