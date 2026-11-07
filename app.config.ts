import type { ExpoConfig } from 'expo/config';

/**
 * Development builds talk to Metro over the local network.
 * Production and preview builds do not declare that permission.
 */
export default ({ config }: { config: ExpoConfig }): ExpoConfig => {
  if (process.env.APP_VARIANT !== 'development') return config;
  return {
    ...config,
    ios: {
      ...config.ios,
      infoPlist: {
        ...config.ios?.infoPlist,
        NSLocalNetworkUsageDescription:
          'Zikaron3D connects to the Metro development server on your Wi-Fi network while you build and test the app.',
        NSBonjourServices: ['_expo._tcp'],
      },
    },
  };
};
