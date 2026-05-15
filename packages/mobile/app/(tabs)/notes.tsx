import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { fetchFiles, UploadedFile } from "@/utils/api";
import { useAuth } from "@clerk/clerk-react";
import { FileList } from "@/components/FileList";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSemanticColor } from "@/hooks/useThemeColor";
import * as FileSystem from "expo-file-system/legacy";
import * as DocumentPicker from "expo-document-picker";
import { Asset } from "expo-asset";

export default function NotesScreen() {
  const { getToken } = useAuth();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const insets = useSafeAreaInsets();
  const primaryColor = useSemanticColor("primary");

  const loadFiles = useCallback(
    async (showSpinner = true) => {
      if (showSpinner) setLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) {
          setError("Authentication required");
          setLoading(false);
          setRefreshing(false);
          return;
        }

        const filesData = await fetchFiles(token, { page: 1, limit: 10 });
        setFiles(filesData.files || []);

        setShowOnboarding(
          filesData.files.length === 0 && !filesData.pagination?.totalPages
        );
      } catch (err) {
        console.error("Error loading files:", err);
        setError("Failed to load your notes. Please try again.");
      } finally {
        if (showSpinner) setLoading(false);
        setRefreshing(false);
      }
    },
    [getToken]
  );

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  useFocusEffect(
    useCallback(() => {
      console.log("Notes screen focused, reloading files...");
      loadFiles(false);
    }, [loadFiles])
  );

  // ── auto-refresh until everything leaves "pending/processing" ─────────────────
  useEffect(() => {
    if (loading) return;                         // wait for first load
    const stillProcessing = files.some(
      (f) => f.processingStatus === "pending" || f.processingStatus === "processing"
    );

    let id: ReturnType<typeof setInterval> | null = null;
    if (stillProcessing) {
      id = setInterval(() => {
        console.log("auto-refreshing notes list…");
        loadFiles(false);                        // silent refresh
      }, 5000);
    }
    return () => { if (id) clearInterval(id); };
  }, [files, loading, loadFiles]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadFiles(false);
  }, [loadFiles]);

  // Define the header rendering function
  const renderHeader = () => (
    <ThemedView
      variant="elevated"
      style={[styles.header, { paddingTop: Math.max(20, insets.top) }]}
    >
      <View style={styles.titleContainer}>
        <MaterialIcons
          name="notes"
          size={28}
          color={primaryColor}
          style={styles.icon}
        />
        <ThemedText type="heading" style={styles.headerTitle}>
          My Notes
        </ThemedText>
      </View>
    </ThemedView>
  );

  const renderOnboarding = () => (
    <ScrollView style={styles.container}>
      <View style={styles.onboardingContainer}>
        <ThemedText type="heading" style={styles.onboardingTitle}>
          Welcome to Note Companion
        </ThemedText>

        <ThemedText style={styles.onboardingDescription}>
          You don't have any documents yet. Let's add your first document to get
          started with OCR text extraction!
        </ThemedText>

        <ThemedText style={styles.demoDescription}>
          Try our OCR capabilities with this historical document from Albert
          Einstein's archives:
        </ThemedText>
      </View>
    </ScrollView>
  );

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={primaryColor} />
        <ThemedText style={styles.loadingText}>
          Loading your notes...
        </ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <MaterialIcons name="error-outline" size={48} color="#E53E3E" />
        <ThemedText style={styles.errorText}>{error}</ThemedText>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => loadFiles()}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {renderHeader()}
      {showOnboarding ? (
        renderOnboarding()
      ) : (
        <FileList
          files={files}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          onFileDeleted={() => loadFiles(false)}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  header: {
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 2,
        marginBottom: 0,
      },
      android: {
        elevation: 2,
        marginBottom: 4,
      },
    }),
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  icon: {
    marginRight: 8,
  },
  headerTitle: {
    fontWeight: "700",
  },
  headerActions: {
    flexDirection: "row",
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#8a65ed",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: "center",
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: "center",
    color: "#E53E3E",
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: "#8a65ed",
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  onboardingContainer: {
    padding: 20,
    alignItems: "center",
  },
  onboardingTitle: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 12,
  },
  onboardingDescription: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  demoCard: {
    width: "100%",
    backgroundColor: "#f8f8f8",
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  demoTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  demoDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  demoImageContainer: {
    width: "100%",
    height: 400,
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 16,
    position: "relative",
    backgroundColor: "#eee",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  demoImage: {
    width: "100%",
    height: "100%",
  },
  uploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  uploadingText: {
    color: "#fff",
    marginTop: 12,
    fontSize: 16,
    fontWeight: "600",
  },
  demoButton: {
    backgroundColor: "#8a65ed",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  demoButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
    marginLeft: 8,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#ddd",
  },
  dividerText: {
    marginHorizontal: 10,
    color: "#888",
    fontSize: 14,
  },
  uploadButton: {
    backgroundColor: "#f2f2f2",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  uploadButtonText: {
    fontWeight: "600",
    fontSize: 16,
    marginLeft: 8,
  },
});
