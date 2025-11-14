import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fauna.mobile',
  appName: 'Fauna Mobile',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    }
  },
  android: {
    path: 'android'
  },
  ios: {
    path: 'ios'
  }
};

export default config;
