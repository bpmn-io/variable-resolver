import bpmnIoPlugin from 'eslint-plugin-bpmn-io';

export default [
  {
    ignores: [
      'dist',
      '.nyc_output',
      'coverage'
    ]
  },
  ...bpmnIoPlugin.configs.browser,
  ...bpmnIoPlugin.configs.mocha.map(config => {
    return {
      ...config,
      files: [
        '**/test/**/*.js'
      ]
    };
  }),
  {
    languageOptions: {
      globals: {
        sinon: true
      },
      files: [
        '**/test/**/*.js'
      ]
    }
  }
];
