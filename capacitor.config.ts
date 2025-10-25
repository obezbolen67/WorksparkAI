import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fexo.app',
  appName: 'Fexo',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https'
    // If you load content from your own domain(s), you can allow navigation like:
    // allowNavigation: ['your-domain.com', 'api.your-domain.com']
  }
};

export default config;
