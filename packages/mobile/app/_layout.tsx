import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useRootNavigationState, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform, ActivityIndicator, StyleSheet, View } from 'react-native';
import * as Linking from 'expo-linking';
import { processSharedFile, cleanupSharedFile } from '@/utils/share-handler';
import * as FileSystem from 'expo-file-system/legacy';

// Remove direct ClerkProvider import and use our custom AuthProvider
import { AuthProvider } from '@/providers/auth';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

/**
 * Expo web forwards normal document + in-app URLs through Linking (/, /sign-in, …).
 * Only local http(s) URLs that use the `share` path or share-style query should run
 * deep-link handling; everything else is Expo Router / Clerk navigation.
 */
function isIgnorableLocalHttpUrl(url: string): boolean {
  if (!url.startsWith("http://") && !url.startsWith("https://")) return false;
  try {
    const parsed = new URL(url);
    const local =
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname.endsWith(".local");
    if (!local) return false;
    const { path, queryParams } = Linking.parse(url);
    const p = (path ?? "").replace(/^\/+|\/+$/g, "") || "";
    const q = queryParams ?? {};
    if (q.uri || q.text) return false;
    if (p === "share") return false;
    return true;
  } catch {
    return false;
  }
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const router = useRouter();
  const rootNavigation = useRootNavigationState();
  const navigationReady = Boolean(rootNavigation?.key);
  const [isProcessingShare, setIsProcessingShare] = useState(false);
  const [initialUrl, setInitialUrl] = useState<string | null>(null);
  const isMounted = useRef(false);
  const pendingNavRef = useRef<{
    pathname: string;
    params?: Record<string, unknown>;
  } | null>(null);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    if (!navigationReady || !pendingNavRef.current) return;
    const next = pendingNavRef.current;
    pendingNavRef.current = null;
    router.replace(
      (next.params
        ? { pathname: next.pathname, params: next.params }
        : next.pathname) as Href
    );
  }, [navigationReady, router]);

  const safeNavigate = (pathname: string, params?: Record<string, unknown>) => {
    if (!isMounted.current) return;
    if (!navigationReady) {
      pendingNavRef.current = { pathname, params };
      return;
    }
    router.replace((params ? { pathname, params } : pathname) as Href);
  };

  const handleIncomingURL = async (url: string | null) => {
    console.log('\n[RootLayout] ===== Starting URL Processing =====');
    console.log('[RootLayout] Raw incoming URL:', url);
    if (!url) {
      console.log('[RootLayout] No URL provided');
      return;
    }

    if (isIgnorableLocalHttpUrl(url)) {
      return;
    }

    // Set share processing state to show loading indicator instead of not-found
    setIsProcessingShare(true);

    try {
      // Handle direct file URLs
      if (url.startsWith('file://')) {
        console.log('\n[RootLayout] === Processing File URL ===');
        console.log('[RootLayout] Original URL:', url);
        
        try {
          // First decode the URL to handle double-encoded spaces
          const decodedUrl = decodeURIComponent(decodeURIComponent(url));
          console.log('[RootLayout] After double decode:', decodedUrl);
          
          // Split URL into components for filename only
          const urlParts = decodedUrl.split('/');
          const fileName = urlParts.pop() || 'shared-file';
          console.log('[RootLayout] Extracted filename:', fileName);
  
          // Create shared file object with original URL
          const sharedFile = {
            uri: url,  // Use original URL
            mimeType: decodedUrl.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
            name: fileName,
          };
          console.log('\n[RootLayout] Created shared file object:', JSON.stringify(sharedFile, null, 2));
  
          // Check if file exists before processing
          console.log('\n[RootLayout] === Checking File Existence ===');
          const fileInfo = await FileSystem.getInfoAsync(url);  // Check original URL
          console.log('[RootLayout] File info result:', JSON.stringify(fileInfo, null, 2));
  
          if (!fileInfo.exists) {
            // Try alternative paths
            console.log('\n[RootLayout] === Trying Alternative Paths ===');
            const alternativePaths = [
              url.replace('file://', ''),
              decodedUrl,
              url.replace(/%2520/g, '%20')
            ];
  
            let foundPath = null;
            for (const path of alternativePaths) {
              console.log('[RootLayout] Trying path:', path);
              const altFileInfo = await FileSystem.getInfoAsync(path);
              console.log('[RootLayout] Result for path:', { path, exists: altFileInfo.exists });
              if (altFileInfo.exists) {
                console.log('[RootLayout] Found file at alternative path:', path);
                sharedFile.uri = path;
                foundPath = path;
                break;
              }
            }
  
            if (!foundPath) {
              throw new Error(`File not found at path: ${url}\nTried alternative paths: ${alternativePaths.join('\n')}`);
            }
          }
  
          console.log('\n[RootLayout] === Processing File ===');
          const fileData = await processSharedFile(sharedFile);
          console.log('[RootLayout] Processed file data:', JSON.stringify(fileData, null, 2));
          
          console.log('\n[RootLayout] === Navigation ===');
          console.log('[RootLayout] Passing shared file to tabs screen');
          
          // Navigate to the main tabs screen, passing the file data as a parameter
          safeNavigate('/(tabs)', { sharedFile: JSON.stringify(fileData) });

        } catch (innerError) {
          // If anything fails with file processing, still go to home page
          console.error('[RootLayout] Error processing shared file:', innerError);
          
          // Navigate to the home tab instead of showing not found
          console.log('[RootLayout] Navigating to home due to error');
          safeNavigate('/(tabs)');
        } finally {
          // Always set processing to false when done
          setIsProcessingShare(false);
        }

        return;
      }

      // Handle share scheme URLs
      const { path, queryParams } = Linking.parse(url);
      console.log('[RootLayout] Parsed URL:', { path, queryParams });

      if (path === 'share') {
        console.log('[RootLayout] Processing share path');
        try {
          if (queryParams?.uri) {
            console.log('[RootLayout] Processing shared file with URI');
            const sharedFile = {
              uri: decodeURIComponent(queryParams.uri as string),
              mimeType: queryParams.type as string,
              name: queryParams.name as string,
            };
            console.log('[RootLayout] Shared file data:', sharedFile);
  
            const fileData = await processSharedFile(sharedFile);
            console.log('[RootLayout] Processed file data:', fileData);
            
            console.log('[RootLayout] Navigating to share screen');
            safeNavigate('/(tabs)/share', { sharedFile: JSON.stringify(fileData) });
  
            // Clean up temporary files after processing
            if (Platform.OS === 'android') {
              console.log('[RootLayout] Cleaning up Android temporary files');
              await cleanupSharedFile(sharedFile.uri);
            }
          } else if (queryParams?.text) {
            console.log('[RootLayout] Processing shared text');
            const textData = {
              text: decodeURIComponent(queryParams.text as string),
              mimeType: 'text/plain',
              name: 'shared-text.txt'
            };
            console.log('[RootLayout] Text data:', textData);
  
            console.log('[RootLayout] Navigating to share screen with text');
            // Navigate to the main tabs screen for text as well
            safeNavigate('/(tabs)', { sharedFile: JSON.stringify(textData) });
          } else {
            // No valid parameters found, go to home
            console.log('[RootLayout] No valid parameters found, going to home');
            safeNavigate('/(tabs)');
          }
        } catch (innerError) {
          // If anything fails, still go to home page
          console.error('[RootLayout] Error processing share path:', innerError);
          console.log('[RootLayout] Navigating to home due to error');
          safeNavigate('/(tabs)');
        } finally {
          // Always set processing to false when done
          setIsProcessingShare(false);
        }
      } else {
        // Unknown path, go to home
        console.log('[RootLayout] Unknown path, going to home');
        safeNavigate('/(tabs)');
        setIsProcessingShare(false);
      }
    } catch (error) {
      console.error('[RootLayout] Error handling shared content:', error);
      // For any unhandled error, redirect to home
      console.log('[RootLayout] Navigating to home due to unhandled error');
      safeNavigate('/(tabs)');
      setIsProcessingShare(false);
    }
  };

  // Setup component mounted state FIRST - this must run before URL handling
  useEffect(() => {
    console.log('[RootLayout] Setting isMounted flag to true');
    isMounted.current = true;
    
    return () => {
      console.log('[RootLayout] Setting isMounted flag to false');
      isMounted.current = false;
    };
  }, []);

  // Handle delayed navigation / deep links after the root navigator exists.
  useEffect(() => {
    if (!isMounted.current || !navigationReady) return;

    if (initialUrl) {
      try {
        if (initialUrl.startsWith('{')) {
          const navData = JSON.parse(initialUrl);
          router.replace(
            navData.params
              ? { pathname: navData.pathname, params: navData.params }
              : navData.pathname
          );
        } else {
          handleIncomingURL(initialUrl);
        }
      } catch (e) {
        console.error('[RootLayout] Error handling stored URL data:', e);
        router.replace('/(tabs)');
      }
      setInitialUrl(null);
    }
  }, [initialUrl, navigationReady]);

  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (isIgnorableLocalHttpUrl(url)) return;
      if (isMounted.current && navigationReady) {
        handleIncomingURL(url);
      } else {
        setInitialUrl(url);
      }
    });

    Linking.getInitialURL().then((url) => {
      if (url && !isIgnorableLocalHttpUrl(url)) setInitialUrl(url);
    });

    return () => sub.remove();
  }, [navigationReady]);

  if (!loaded) {
    return null;
  }

  return (
    <View style={{ flex: 1 }}>
      <AuthProvider>
        <SafeAreaProvider>
          <ThemeProvider value={DefaultTheme}>
            <Stack
              screenOptions={{
                headerStyle: {
                  backgroundColor: '#f5f5f5',
                },
                headerTintColor: '#000',
                headerTitleStyle: {
                  fontWeight: '600',
                },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            </Stack>
            {isProcessingShare ? (
              <View
                pointerEvents="auto"
                style={[
                  StyleSheet.absoluteFillObject,
                  {
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.85)',
                  },
                ]}
              >
                <ActivityIndicator size="large" color="#0000ff" />
              </View>
            ) : null}
            <StatusBar style="dark" />
          </ThemeProvider>
        </SafeAreaProvider>
      </AuthProvider>
    </View>
  );
}
