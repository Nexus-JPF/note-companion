import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { UploadStatus } from "@/utils/file-handler";
import { FilePreview } from "./file-preview";
import { TextDocumentViewer } from "./text-document-viewer";
import { useRouter } from "expo-router";

interface ProcessingStatusProps {
  status: UploadStatus;
  result?: string | null | { extractedText?: string; visualElements?: any };
  fileUrl?: string;
  mimeType?: string;
  fileName?: string;
  processType?: string;
  onRetry?: () => void;
  onBackToHome?: () => void;
  showDetails?: boolean;
}

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({
  status,
  result,
  fileUrl,
  mimeType,
  fileName,
  processType,
  onRetry,
  onBackToHome,
  showDetails = true,
}) => {
  const router = useRouter();
  if (status === "idle") {
    return null;
  }

  return (
    <View style={styles.container}>
      {status === "uploading" && (
        <View style={styles.statusContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.statusText}>
            Uploading your file...
          </Text>
          {showDetails && (
            <Text style={styles.statusSubtext}>
              This will just take a moment
            </Text>
          )}
        </View>
      )}

      {status === "pending" && (
        <View style={styles.resultContainer}>
          <View style={styles.resultHeader}>
            <MaterialIcons name="cloud-upload" size={24} color="#4CAF50" />
            <Text style={styles.successText}>
              File uploaded – processing in background
            </Text>
            {processType === 'magic-diagram' && (
              <Text style={styles.statusSubtext}>
                opening diagram preview…
              </Text>
            )}
          </View>

          {/* Quick link to notes */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.viewNotesButton]}
              onPress={() => router.push("/notes")}
            >
              <View style={styles.buttonContent}>
                <MaterialIcons name="folder" size={18} color="#fff" />
                <Text style={styles.buttonText}>View All Notes</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {status === "completed" && (
        <View style={styles.resultContainer}>
          <View style={styles.resultHeader}>
            <MaterialIcons name="check-circle" size={24} color="#4CAF50" />
            <Text style={styles.successText}>File processed successfully</Text>
          </View>

          {/* Display file preview when completed */}
          {fileUrl && (
            <View style={styles.previewContainer}>
              <FilePreview
                fileUrl={fileUrl}
                mimeType={mimeType}
                fileName={fileName}
                textContent={
                  result &&
                  typeof result === "object" &&
                  "extractedText" in result
                    ? result.extractedText
                    : undefined
                }
              />
            </View>
          )}

          {/* Display extracted text content if available and not already shown in preview */}
          {result &&
            typeof result === "object" &&
            "extractedText" in result &&
            result.extractedText &&
            !mimeType?.includes("text") &&
            !mimeType?.includes("markdown") && (
              <View style={styles.textContentContainer}>
                <Text style={styles.textContentTitle}>Extracted Text</Text>
                <TextDocumentViewer
                  content={result.extractedText}
                  title="Extracted Content"
                />
              </View>
            )}

          {showDetails && (
            <Text style={styles.resultSubtext}>
              Your file has been uploaded to Note Companion AI.
              {"\n\n"}
              It will be automatically synced to any services you have enabled.
            </Text>
          )}

          {/* View All Notes button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.viewNotesButton]}
              onPress={() => router.push("/notes")}
            >
              <View style={styles.buttonContent}>
                <MaterialIcons name="folder" size={18} color="#fff" />
                <Text style={styles.buttonText}>View All Notes</Text>
              </View>
            </TouchableOpacity>

            {onBackToHome && (
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={onBackToHome}
              >
                <Text style={styles.buttonText}>Back to Home</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {status === "error" && (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error" size={24} color="#f44336" />
          <Text style={styles.errorText}>
            {typeof result === "string" ? result : "An error occurred"}
          </Text>
          <View style={styles.buttonContainer}>
            {onRetry && (
              <TouchableOpacity style={styles.button} onPress={onRetry}>
                <Text style={styles.buttonText}>Retry</Text>
              </TouchableOpacity>
            )}
            {onBackToHome && (
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={onBackToHome}
              >
                <Text style={styles.buttonText}>Back to Home</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  statusContainer: {
    alignItems: "center",
    backgroundColor: "rgb(255, 250, 240)",
    padding: 20,
    borderRadius: 16,
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  statusText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  statusSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  resultContainer: {
    alignItems: "center",
    padding: 20,
    backgroundColor: "rgba(104, 211, 145, 0.1)", // Light green with low opacity
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(104, 211, 145, 0.4)", // Success color with lower opacity
    width: "100%",
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  previewContainer: {
    width: "100%",
    marginVertical: 15,
    maxHeight: 400,
    borderRadius: 8,
    overflow: "hidden",
  },
  errorContainer: {
    alignItems: "center",
    padding: 20,
    backgroundColor: "rgba(252, 129, 129, 0.1)", // Light red with low opacity
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(252, 129, 129, 0.4)", // Danger color with lower opacity
    width: "100%",
  },
  successText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2E7D32",
    marginLeft: 10,
    textAlign: "center",
  },
  resultSubtext: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginVertical: 8,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#C62828",
    marginVertical: 10,
    textAlign: "center",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginTop: 16,
    width: "100%",
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 12,
    borderRadius: 8,
    minWidth: 140,
    alignItems: "center",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  viewNotesButton: {
    backgroundColor: "#34C759", // Green button for "View All Notes"
  },
  secondaryButton: {
    backgroundColor: "#8E8E93",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  textContentContainer: {
    width: "100%",
    marginTop: 16,
  },
  textContentTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 8,
  },
});
