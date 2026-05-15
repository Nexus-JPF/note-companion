import { ClerkProvider as ClerkProviderExpo } from "@clerk/clerk-expo";
import { ClerkProvider as ClerkProviderWeb } from "@clerk/clerk-react";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { Platform, Text, View } from "react-native";

// Enhanced token cache with longer expiration and error logging
const tokenCache = {
  async getToken(key: string) {
    try {
      console.log(`[TokenCache] Retrieving token for key: ${key}`);
      const token = await SecureStore.getItemAsync(key);
      console.log(`[TokenCache] Token ${token ? 'found' : 'not found'} for key: ${key}`);
      return token;
    } catch (err) {
      console.error(`[TokenCache] Error retrieving token for key ${key}:`, err);
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      console.log(`[TokenCache] Saving token for key: ${key}`);
      // Setting tokens with no expiration to improve persistence
      return SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.ALWAYS
      });
    } catch (err) {
      console.error(`[TokenCache] Error saving token for key ${key}:`, err);
      return;
    }
  },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Prefer env: Metro inlines EXPO_PUBLIC_* into the JS bundle (reliable on web).
  // `extra` from app.config is fine on native but can be missing or stale in some dev paths.
  const publishableKey = (
    process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ??
    (Constants.expoConfig?.extra?.clerkPublishableKey as string | undefined)
  )?.trim();

  if (!publishableKey) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingVertical: 32,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 12 }}>
          Clerk is not configured
        </Text>
        <Text style={{ fontSize: 15, lineHeight: 22, marginBottom: 16 }}>
          Set{" "}
          <Text style={{ fontFamily: "monospace" }}>
            EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
          </Text>{" "}
          in{" "}
          <Text style={{ fontFamily: "monospace" }}>packages/mobile/.env</Text>,
          then restart Expo (stop the dev server and run{" "}
          <Text style={{ fontFamily: "monospace" }}>pnpm start</Text> again).
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 20, opacity: 0.8 }}>
          For a physical device, if the QR code does not open the app, try the
          same Wi‑Fi as this computer or run{" "}
          <Text style={{ fontFamily: "monospace" }}>pnpm start:tunnel</Text>.
        </Text>
      </View>
    );
  }

  // Expo web: @clerk/clerk-expo's headless client forces _is_native=1 + credentials:"omit" on every
  // request (singleton.js), which breaks browser fetches to Clerk (Failed to fetch / CORS symptoms).
  // Native keeps SecureStore-backed token cache via ClerkProviderExpo.
  if (Platform.OS === "web") {
    return (
      <ClerkProviderWeb publishableKey={publishableKey}>
        {children}
      </ClerkProviderWeb>
    );
  }

  return (
    <ClerkProviderExpo publishableKey={publishableKey} tokenCache={tokenCache}>
      {children}
    </ClerkProviderExpo>
  );
} 