const path = require('node:path');

/**
 * babel-preset-expo normally hoists into the project's node_modules, but some
 * npm layouts nest it inside the expo package. Resolve both so bundling works
 * either way.
 */
function resolvePreset() {
  try {
    return require.resolve('babel-preset-expo');
  } catch {
    return require.resolve('babel-preset-expo', {
      paths: [path.dirname(require.resolve('expo/package.json'))],
    });
  }
}

module.exports = function (api) {
  api.cache.using(() => process.env.NODE_ENV ?? 'development');
  const production = process.env.NODE_ENV === 'production' || process.env.BABEL_ENV === 'production';
  return {
    presets: [resolvePreset()],
    // Release builds keep errors and drop the rest of the console noise.
    plugins: production ? [['transform-remove-console', { exclude: ['error'] }]] : [],
  };
};
