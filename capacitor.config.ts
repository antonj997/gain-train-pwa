import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.7791df493b2949b9b630a86b448e7304',
  appName: 'gain-train-pwa',
  webDir: 'dist',
  server: {
    url: 'https://7791df49-3b29-49b9-b630-a86b448e7304.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    StatusBar: {
      style: 'DEFAULT',
      backgroundColor: '#ffffff'
    }
  }
};

export default config;
