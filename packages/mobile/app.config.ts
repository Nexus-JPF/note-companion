import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Note Companion AI',
  slug: 'note-companion',
  scheme: 'notecompanion',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/big-logo.png',
  userInterfaceStyle: 'automatic',
  assetBundlePatterns: ['**/*'],
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
    dark: {
      image: './assets/splash-white.png',
      resizeMode: 'contain',
      backgroundColor: '#000000',
    },
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.notecompanion.app',
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
      ],
    },
    usesIcloudStorage: false,
    usesAppleSignIn: true,
    config: {
      usesNonExemptEncryption: false,
    },
    infoPlist: {
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
      },
      CFBundleAllowMixedLocalizations: true,
      NSPhotoLibraryUsageDescription:
        "Allow access so you can attach receipt photos to an expense. Example: tap 'Add receipt', pick a photo, and we save it with the transaction.",
      NSCameraUsageDescription:
        'Note Companion uses the camera to capture documents or diagrams that are then converted into text and saved as notes (e.g., snap a whiteboard to create a meeting note).',
      LSApplicationQueriesSchemes: ['obsidian'],
      UIFileSharingEnabled: true,
      LSSupportsOpeningDocumentsInPlace: true,
      UISupportsDocumentBrowser: true,
      CFBundleDocumentTypes: [
        {
          CFBundleTypeName: 'All Files',
          LSHandlerRank: 'Alternate',
          LSItemContentTypes: [
            'public.content',
            'public.data',
            'public.image',
            'public.pdf',
            'public.text',
            'public.audio',
            'public.movie',
            'com.adobe.pdf',
            'com.microsoft.word.doc',
            'org.openxmlformats.wordprocessingml.document',
            'public.plain-text',
            'public.html',
          ],
        },
      ],
    },
    associatedDomains: [],
  },
  android: {
    icon: './assets/big-logo.png',
    package: 'com.notecompanion.app',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
      dark: {
        image: './assets/splash.png',
        resizeMode: 'contain',
        backgroundColor: '#000000',
      },
    },
    intentFilters: [
      {
        action: 'android.intent.action.SEND',
        category: ['android.intent.category.DEFAULT'],
        data: [
          { mimeType: 'text/*' },
          { mimeType: 'image/*' },
          { mimeType: 'application/pdf' },
          { mimeType: 'application/msword' },
          {
            mimeType:
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          },
        ],
      },
      {
        action: 'android.intent.action.SEND_MULTIPLE',
        category: ['android.intent.category.DEFAULT'],
        data: [
          { mimeType: 'text/*' },
          { mimeType: 'image/*' },
          { mimeType: 'application/pdf' },
          { mimeType: 'application/msword' },
          {
            mimeType:
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          },
        ],
      },
    ],
  },
  web: {
    favicon: './assets/images/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-apple-authentication',
    'expo-router',
    'expo-font',
    'expo-localization',
    'expo-web-browser',
    'expo-secure-store',
    'expo-file-system',
    'expo-asset',
    'expo-share-intent',
    [
      'expo-document-picker',
      {
        iCloudContainerEnvironment: 'Production',
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          usesCleartextTraffic: true,
        },
        ios: {
          useFrameworks: 'static',
          syncPlugins: false,
        },
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/big-logo.png',
        color: '#ffffff',
      },
    ],
  ],
  extra: {
    clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
    storefront: 'us',
    router: {
      origin: false,
    },
    eas: {
      projectId: 'b9d83b7e-03c0-46b9-82af-cf9ac6e40235',
    },
  },
});
