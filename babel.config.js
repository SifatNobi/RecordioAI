module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Reanimated 4.x includes worklets - using reanimated plugin only
      'react-native-reanimated/plugin',
    ],
  };
};