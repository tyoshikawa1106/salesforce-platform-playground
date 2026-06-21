const { createLdsTestWireAdapter } = require('@salesforce/sfdx-lwc-jest');

module.exports = {
    getLayout: createLdsTestWireAdapter(jest.fn())
};
