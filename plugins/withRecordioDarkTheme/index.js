/**
 * withRecordioDarkTheme
 *
 * RecordioAI is dark-theme only. Two native defaults fight that:
 *   1. AppTheme inherits Theme.AppCompat.DayNight, so on devices in light
 *      mode the window background (and any unpainted surface, overscroll, or
 *      route-transition frame) renders white.
 *   2. There is no explicit android:windowBackground, so cold start can flash
 *      white before the JS bundle paints.
 *
 * This plugin forces a dark base theme and a dark window background using
 * the supported config-plugins XML merge APIs (idempotent, survives regen).
 */
const {
  withAndroidStyles,
  withAndroidColors,
} = require('@expo/config-plugins');

const WINDOW_BG = '#080B12';

function ensureStyleItem(style, name, value) {
  style.item = style.item || [];
  const existing = style.item.find((entry) => entry.$ && entry.$.name === name);
  if (existing) {
    existing._ = value;
    return;
  }
  style.item.push({ $: { name }, _: value });
}

const withRecordioDarkThemeStyles = (config) =>
  withAndroidStyles(config, (config) => {
    const styles = config.modResults.resources.style || [];
    const appTheme = styles.find(
      (entry) => entry.$ && entry.$.name === 'AppTheme'
    );
    if (!appTheme) return config;
    // Force dark regardless of the device light/dark setting.
    appTheme.$.parent = 'Theme.AppCompat.NoActionBar';
    ensureStyleItem(appTheme, 'android:windowBackground', '@color/windowBackground');
    ensureStyleItem(appTheme, 'android:forceDarkAllowed', 'false');
    return config;
  });

const withRecordioDarkThemeColors = (config) =>
  withAndroidColors(config, (config) => {
    const colors = config.modResults.resources.color || [];
    const exists = colors.some(
      (entry) => entry.$ && entry.$.name === 'windowBackground'
    );
    if (!exists) {
      colors.push({ $: { name: 'windowBackground' }, _: WINDOW_BG });
      config.modResults.resources.color = colors;
    }
    return config;
  });

const withRecordioDarkTheme = (config) => {
  config = withRecordioDarkThemeStyles(config);
  config = withRecordioDarkThemeColors(config);
  return config;
};

module.exports = withRecordioDarkTheme;
