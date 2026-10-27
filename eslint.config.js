// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
    rules: {
      // Allow Three.js / React Three Fiber custom JSX props (position, args, intensity, etc.)
      'react/no-unknown-property': 'off',
    },
  },
]);
