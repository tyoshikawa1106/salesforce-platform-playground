const { jestConfig } = require('@salesforce/sfdx-lwc-jest/config');

module.exports = {
    ...jestConfig,
    moduleNameMapper: {
        ...(jestConfig.moduleNameMapper || {}),
        '^lightning/uiLayoutApi$':
            '<rootDir>/force-app/test/jest-mocks/lightning/uiLayoutApi.js',
        '^lightning/uiObjectInfoApi$':
            '<rootDir>/force-app/test/jest-mocks/lightning/uiObjectInfoApi.js'
    },
    collectCoverageFrom: [
        'force-app/main/default/lwc/**/*.js',
        '!force-app/main/default/lwc/**/__tests__/**',
        '!force-app/main/default/lwc/**/__mocks__/**'
    ],
    coverageProvider: 'v8',
    modulePathIgnorePatterns: ['<rootDir>/.localdevserver'],
    setupFilesAfterEnv: [
        ...(jestConfig.setupFilesAfterEnv || []),
        '<rootDir>/jest-sa11y-setup.js'
    ]
};
