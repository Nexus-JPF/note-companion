import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useAuth } from "@clerk/clerk-react";
import { MaterialIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useShareIntent } from "expo-share-intent";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ProcessingStatus } from "@/components/processing-status";
import {
  SharedFile,
  UploadStatus,
  UploadResult,
  handleFileProcess,
} from "@/utils/file-handler";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useSemanticColor } from "@/hooks/useThemeColor";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function HomeScreen() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [uploadResults, setUploadResults] = useState<(UploadResult | null)[]>(
    []
  );
  const [status, setStatus] = useState<UploadStatus>("idle");
  const params = useLocalSearchParams<{
    sharedFile?: string;
    capturedPhoto?: string;
  }>();
  const { shareIntent } = useShareIntent();
  const primaryColor = useSemanticColor("primary");
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Handle shared content
    const handleSharedContent = async () => {
      if (shareIntent) {
        try {
          if (shareIntent.files && shareIntent.files.length > 0) {
            // Handle shared files
            const file = shareIntent.files[0];

            // Improved mime type detection for images
            let mimeType = file.mimeType;
            const fileExt = file.path.split(".").pop()?.toLowerCase();

            // Fix missing or incorrect mime types from device
            if (fileExt && (!mimeType || !mimeType.startsWith("image/"))) {
              if (["jpg", "jpeg"].includes(fileExt)) {
                mimeType = "image/jpeg";
              } else if (fileExt === "png") {
                mimeType = "image/png";
              } else if (fileExt === "heic") {
                mimeType = "image/heic";
              } else if (fileExt === "webp") {
                mimeType = "image/webp";
              } else if (fileExt === "gif") {
                mimeType = "image/gif";
              }
            }

            console.log(
              `ShareIntent: Processing file with path=${file.path}, mimeType=${mimeType}, fileName=${file.fileName}`
            );

            await uploadFiles([
              {
                uri: file.path,
                mimeType: mimeType,
                name: file.fileName,
              },
            ]);
          } else if (shareIntent.text) {
            // Handle shared text (could save as markdown or process differently)
            const textFile = {
              uri: `${FileSystem.cacheDirectory}shared-text-${Date.now()}.md`,
              mimeType: "text/markdown",
              name: "shared-text.md",
              text: shareIntent.text,
            };

            await uploadFiles([textFile]);
          }
        } catch (error) {
          console.error("Error handling shared content:", error);
          setUploadResults([
            {
              status: "error",
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to process shared content",
            },
          ]);
          setStatus("error");
        }
      }
    };

    handleSharedContent();
  }, [shareIntent]);

  useEffect(() => {
    // Handle shared file if present
    const handleSharedFile = async () => {
      if (params.sharedFile) {
        try {
          console.log("Handling shared file:", params.sharedFile);
          const fileData = JSON.parse(params.sharedFile);
          await uploadFiles([fileData]);
          // Clear the param after processing
          // router.setParams({ sharedFile: undefined });
        } catch (error) {
          console.error("Error handling shared file:", error);
          setUploadResults([
            {
              status: "error",
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to process shared file",
              fileName: undefined,
              mimeType: undefined,
              text: undefined,
              fileUrl: undefined,
            },
          ]);
          setStatus("error");
        }
      }
    };

    handleSharedFile();
  }, [params.sharedFile]);

  // NEW useEffect to handle captured photo
  useEffect(() => {
    const handleCapturedPhoto = async () => {
      if (params.capturedPhoto) {
        try {
          console.log("Handling captured photo:", params.capturedPhoto);
          const fileData = JSON.parse(params.capturedPhoto);
          await uploadFiles([fileData]);
          // Clear the param after processing
          // router.setParams({ capturedPhoto: undefined });
        } catch (error) {
          console.error("Error handling captured photo:", error);
          setUploadResults([
            {
              status: "error",
              error:
                error instanceof Error
                  ? error.message
                  : "Failed to process captured photo",
              fileName: undefined,
              mimeType: undefined,
              text: undefined,
              fileUrl: undefined,
            },
          ]);
          setStatus("error");
        }
      }
    };

    handleCapturedPhoto();
  }, [params.capturedPhoto]); // Add dependency on capturedPhoto

  const uploadFiles = async (files: SharedFile[]) => {
    setStatus("uploading");
    setUploadResults(
      files.map((file) => ({
        fileName: file.name,
        mimeType: file.mimeType,
        status: "uploading",
        text: undefined,
        fileUrl: undefined,
        error: undefined,
      }))
    );

    const token = await getToken();
    if (!token) {
      setStatus("error");
      setUploadResults(
        files.map((file) => ({
          fileName: file.name,
          mimeType: file.mimeType,
          status: "error",
          error: "Authentication required",
          text: undefined,
          fileUrl: undefined,
        }))
      );
      console.error("Authentication required");
      return;
    }

    let processedCount = 0;
    let errorCount = 0;
    const totalFiles = files.length;

    files.forEach((file, index) => {
      handleFileProcess(file, token, (s) => {
        // Optional: Update individual file status if needed in uploadResults
        // console.log(`Intermediate status for ${file.name}: ${s}`);
      })
        .then((result) => {
          processedCount++;
          console.log(`Processing finished for ${file.name}:`, result.status);
          // Update the specific file's result in state
          setUploadResults((prev) =>
            prev.map((r, i) =>
              i === index ? { ...r, ...result, status: result.status } : r
            )
          );

          // Check if all files are done
          if (processedCount + errorCount === totalFiles) {
            // Add auto-jump logic for magic diagrams
            // If all processed successfully (errorCount is still 0), set completed
            if (errorCount === 0) {
              setStatus("completed");
            } else {
              // Otherwise, some failed, set error
              setStatus("error");
            }
          }
        })
        .catch((error) => {
          errorCount++;
          console.error(`Error processing file ${file.name}:`, error);
          setUploadResults((prev) =>
            prev.map((r, i) =>
              i === index
                ? {
                    ...r,
                    status: "error",
                    error:
                      error instanceof Error
                        ? error.message
                        : "Failed to process file",
                  }
                : r
            )
          );

          // Check if all files are done (even if this one failed)
          if (processedCount + errorCount === totalFiles) {
            setStatus("error"); // Set final status to error
          }
          // Note: We don't set the *overall* status to error immediately on first failure,
          // we wait for all promises to settle. Individual files will show their error state.
        });
    });
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*"],
        multiple: true,
      });

      if (result.canceled) return;
      if (result.assets && result.assets.length > 0) {
        await uploadFiles(result.assets);
      }
    } catch (error) {
      console.error("Error picking document:", error);
      setStatus("error");
      setUploadResults([
        {
          status: "error",
          error:
            error instanceof Error ? error.message : "Failed to pick document",
          fileName: undefined,
          mimeType: undefined,
          text: undefined,
          fileUrl: undefined,
        },
      ]);
    }
  };

  const pickPhotos = async () => {
    try {
      const { status: permissionStatus } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionStatus !== "granted") {
        setStatus("error");
        setUploadResults([
          {
            status: "error",
            error: "Gallery permission denied",
            fileName: undefined,
            mimeType: undefined,
            text: undefined,
            fileUrl: undefined,
          },
        ]);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (result.canceled) return;

      if (result.assets && result.assets.length > 0) {
        await uploadFiles(result.assets);
      }
    } catch (error) {
      console.error("Error picking photos:", error);
      setStatus("error");
      setUploadResults([
        {
          status: "error",
          error:
            error instanceof Error ? error.message : "Failed to pick photos",
          fileName: undefined,
          mimeType: undefined,
          text: undefined,
          fileUrl: undefined,
        },
      ]);
    }
  };

  // New function for Magic Diagram
  const takeMagicDiagramPhoto = async () => {
    try {
      const { status: cameraStatus } =
        await ImagePicker.requestCameraPermissionsAsync();
      if (cameraStatus !== "granted") {
        setStatus("error");
        setUploadResults([
          {
            status: "error",
            error: "Camera permission denied",
            fileName: undefined,
            mimeType: undefined,
            text: undefined,
            fileUrl: undefined,
          },
        ]);
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (result.canceled) return;
      if (result.assets && result.assets.length > 0) {
        // Mark each asset with a processType property to indicate it's for magic diagram processing
        const magicDiagramAssets = result.assets.map((asset) => ({
          ...asset,
          processType: "magic-diagram", // Add this property to signal the special processing
        }));

        await uploadFiles(magicDiagramAssets);
      }
    } catch (error) {
      console.error("Error taking magic diagram photo:", error);
      setStatus("error");
      setUploadResults([
        {
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "Failed to take magic diagram photo",
          fileName: undefined,
          mimeType: undefined,
          text: undefined,
          fileUrl: undefined,
        },
      ]);
    }
  };

  const renderHeader = () => (
    <ThemedView
      variant="elevated"
      style={[styles.header, { paddingTop: Math.max(20, insets.top) }]}
    >
      <View style={styles.titleContainer}>
        <MaterialIcons
          name="home"
          size={28}
          color={primaryColor}
          style={styles.icon}
        />
        <ThemedText type="heading" style={styles.headerTitle}>
          Home
        </ThemedText>
      </View>
      <ThemedText
        colorName="textSecondary"
        type="label"
        style={styles.headerSubtitle}
      >
        Extract text from your images
      </ThemedText>
    </ThemedView>
  );

  const renderExplanation = () => (
    <View style={styles.explanationCard}>
      <MaterialIcons name="auto-awesome" size={24} color={primaryColor} />
      <Text style={styles.explanationTitle}>Get OCR from any image</Text>
      <Text style={styles.explanationText}>
        Upload any image and get the text extracted. You can also use the share
        sheet to upload from other apps.
      </Text>
    </View>
  );

  const renderUploadButtons = () => (
    <View style={styles.uploadButtons}>
      <View style={styles.uploadButtonRow}>
        <TouchableOpacity
          style={[
            styles.uploadButtonWrapper,
            status === "uploading" && styles.uploadButtonDisabled,
          ]}
          onPress={pickDocument}
          disabled={status === "uploading"}
        >
          <View style={styles.uploadButtonGradient}></View>
          <View style={styles.uploadButtonContent}>
            <MaterialIcons name="file-upload" size={32} color={primaryColor} />
            <Text style={styles.uploadButtonText}>Upload Files</Text>
            <Text style={styles.uploadButtonSubtext}>Images</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.uploadButtonWrapper,
            status === "uploading" && styles.uploadButtonDisabled,
          ]}
          onPress={pickPhotos}
          disabled={status === "uploading"}
        >
          <View style={styles.uploadButtonGradient}></View>
          <View style={styles.uploadButtonContent}>
            <MaterialIcons
              name="photo-library"
              size={32}
              color={primaryColor}
            />
            <Text style={styles.uploadButtonText}>Photo Library</Text>
            <Text style={styles.uploadButtonSubtext}>Choose Photos</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Add a second row with the Magic Diagram button */}
      <View style={styles.uploadButtonRow}>
        <TouchableOpacity
          style={[
            styles.uploadButtonWrapper,
            styles.magicDiagramButton, // New style for distinction
            status === "uploading" && styles.uploadButtonDisabled,
          ]}
          onPress={takeMagicDiagramPhoto}
          disabled={status === "uploading"}
        >
          <View style={styles.uploadButtonGradient}></View>
          <View style={styles.uploadButtonContent}>
            <MaterialIcons name="auto-awesome" size={32} color={primaryColor} />
            <Text style={styles.uploadButtonText}>Magic Diagram</Text>
            <Text style={styles.uploadButtonSubtext}>Convert Sketches</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      {renderHeader()}
      <ScrollView style={styles.scrollView}>
        <View style={styles.mainSection}>
          {/* if not processing show explanation card  if not show processing status*/}
          {status === "uploading" ? (
            <ProcessingStatus
              status={status}
              result={uploadResults[0]?.text as any} // Keep existing 'any' for now
              fileUrl={uploadResults[0]?.url}
              mimeType={uploadResults[0]?.mimeType}
            />
          ) : (
            <>
              <View style={styles.explanationCard}>
                <MaterialIcons
                  name="auto-awesome"
                  size={24}
                  color={primaryColor}
                />
                <Text style={styles.explanationTitle}>
                  Get OCR from any image
                </Text>
                <Text style={styles.explanationText}>
                  Upload any image and get the text extracted. You can also use
                  the share sheet to upload from other apps.
                </Text>
              </View>
            </>
          )}
          {renderUploadButtons()}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderRadius: 0,
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
    marginBottom: 8,
  },
  icon: {
    marginRight: 8,
  },
  headerTitle: {
    fontWeight: "700",
  },
  headerSubtitle: {
    marginBottom: 8,
  },
  mainSection: {
    padding: 20,
  },
  explanationCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e1e1e1",
  },
  explanationTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginVertical: 12,
    color: "#1a1a1a",
  },
  explanationText: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  uploadButtons: {
    flexDirection: "column",
    marginBottom: 24,
  },
  uploadButtonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  uploadButtonWrapper: {
    width: "48%",
    minHeight: 140,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
  },
  uploadButtonGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 16,
  },
  uploadButtonContent: {
    flex: 1,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: "transparent",
    margin: 2,
    borderRadius: 14,
    height: "100%",
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  uploadButtonText: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a1a",
    textAlign: "center",
  },
  uploadButtonSubtext: {
    marginTop: 4,
    fontSize: 13,
    color: "#666",
    textAlign: "center",
  },
  helpLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    padding: 12,
  },
  helpLinkText: {
    fontSize: 14,
    color: "#007AFF",
    marginLeft: 6,
    fontWeight: "500",
  },
  magicDiagramButton: {
    width: "100%", // Full width for the Magic Diagram button
    backgroundColor: "rgba(138, 101, 237, 0.05)", // Subtle background tint
  },
});
