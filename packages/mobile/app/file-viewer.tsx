import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Dimensions,
  Text,
  Alert,
  Share,
  useColorScheme,
  SafeAreaView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { TextDocumentViewer } from '@/components/text-document-viewer';
import { FilePreview } from '@/components/file-preview';
import * as FileSystem from 'expo-file-system/legacy';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// Function to adjust font size for all text elements
const adjustFontSizes = (baseStyles: any, fontSize: number) => {
  const textElements = [
    'body',
    'heading1',
    'heading2',
    'heading3',
    'paragraph',
    'list_item',
    'code_inline',
    'code_block',
    'blockquote',
  ];

  const newStyles = { ...baseStyles };
  textElements.forEach(element => {
    if (newStyles[element]) {
      newStyles[element] = {
        ...newStyles[element],
        fontSize: element.startsWith('heading')
          ? fontSize * (element === 'heading1' ? 2 : element === 'heading2' ? 1.75 : 1.5)
          : element.includes('code') ? fontSize - 2
          : fontSize,
      };
    }
  });
  return newStyles;
};

// Base markdown styles
const markdownStyles = {
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    paddingHorizontal: 16,
  },
  heading1: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 36,
    marginVertical: 16,
    color: '#1a1a1a',
  },
  heading2: {
    fontSize: 24,
    fontWeight: '600' as const,
    lineHeight: 32,
    marginVertical: 14,
    color: '#1a1a1a',
  },
  heading3: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 28,
    marginVertical: 12,
    color: '#1a1a1a',
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
    color: '#333',
  },
  list_item: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 8,
    color: '#333',
  },
  bullet_list: {
    marginBottom: 12,
  },
  ordered_list: {
    marginBottom: 12,
  },
  code_inline: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 15,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  code_block: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 15,
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  blockquote: {
    borderLeftWidth: 4,
    borderLeftColor: '#e1e1e1',
    paddingLeft: 16,
    marginVertical: 8,
    fontStyle: 'italic' as const,
    color: '#666',
  },
  link: {
    color: '#007AFF',
    textDecorationLine: 'underline' as const,
  },
  strong: {
    fontWeight: '600' as const,
  },
  em: {
    fontStyle: 'italic' as const,
  },
};

const darkMarkdownStyles = {
  ...markdownStyles,
  body: {
    ...markdownStyles.body,
    color: '#e1e1e1',
  },
  heading1: {
    ...markdownStyles.heading1,
    color: '#fff',
  },
  heading2: {
    ...markdownStyles.heading2,
    color: '#fff',
  },
  heading3: {
    ...markdownStyles.heading3,
    color: '#fff',
  },
  paragraph: {
    ...markdownStyles.paragraph,
    color: '#e1e1e1',
  },
  list_item: {
    ...markdownStyles.list_item,
    color: '#e1e1e1',
  },
  code_inline: {
    ...markdownStyles.code_inline,
    backgroundColor: '#2a2a2a',
    color: '#e1e1e1',
  },
  code_block: {
    ...markdownStyles.code_block,
    backgroundColor: '#2a2a2a',
    color: '#e1e1e1',
  },
  blockquote: {
    ...markdownStyles.blockquote,
    borderLeftColor: '#404040',
    color: '#b0b0b0',
  },
};

type ViewMode = 'document' | 'markdown';

export default function FileViewerScreen() {
  const params = useLocalSearchParams<{
    fileUrl?: string;
    mimeType?: string;
    fileName?: string;
    content?: string;
  }>();
  const router = useRouter();
  const [fontSize, setFontSize] = useState(16);
  const [theme, setTheme] = useState<'light' | 'dark' | 'sepia'>('light');
  const [viewMode, setViewMode] = useState<ViewMode>('markdown');
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    router.back();
  };

  const handleShare = async () => {
    try {
      // Determine if we have content to share
      const hasContent = params.content && params.content.trim().length > 0;
      
      if (hasContent) {
        // For markdown or text files, share the content directly
        await Share.share({
          title: params.fileName,
          message: params.content as string,
        });
      } else if (params.fileUrl) {
        // For binary files like PDFs, attempt to share the URL
        try {
          // Download the file locally first if it's a remote URL
          const localUri = `${FileSystem.documentDirectory}${params.fileName}`;
          const downloadResumable = FileSystem.createDownloadResumable(
            params.fileUrl,
            localUri
          );
          
          const downloadResult = await downloadResumable.downloadAsync();
          
          if (downloadResult && downloadResult.uri) {
            await Share.share({
              title: params.fileName,
              url: downloadResult.uri, // iOS only
            });
          } else {
            throw new Error('Failed to download file for sharing');
          }
        } catch (error) {
          console.error('Error preparing file for sharing:', error);
          
          // Fallback to just sharing the URL if download fails
          await Share.share({
            title: params.fileName,
            message: `View my note: ${params.fileUrl}`,
          });
        }
      } else {
        Alert.alert('Cannot Share', 'This note has no content available for sharing.');
      }
    } catch (error) {
      console.error('Error sharing file:', error);
      Alert.alert('Share Failed', 'There was a problem sharing this note.');
    }
  };

  const renderDocumentView = () => {
    if (params.mimeType?.includes('pdf') && params.fileUrl) {
      return (
        <View style={styles.pdfContainer}>
          <WebView
            source={{ uri: params.fileUrl }}
            style={styles.pdfView}
            originWhitelist={['*']}
          />
        </View>
      );
    }

    if (params.mimeType?.includes('image')) {
      return (
        <FilePreview
          fileUrl={params.fileUrl}
          mimeType={params.mimeType}
          fileName={params.fileName}
        />
      );
    }

    return (
      <TextDocumentViewer
        content={params.content || ''}
        title={params.fileName}
        metadata={{
          source: params.fileUrl,
        }}
      />
    );
  };

  const renderMarkdownView = () => {
    const baseStyles = theme === 'dark' ? darkMarkdownStyles : markdownStyles;
    const scaleFactor = fontSize / 16;
    
    const adjustedStyles = {
      ...baseStyles,
      body: {
        ...baseStyles.body,
        fontSize: baseStyles.body.fontSize * scaleFactor,
        lineHeight: baseStyles.body.lineHeight * scaleFactor,
      },
      paragraph: {
        ...baseStyles.paragraph,
        fontSize: baseStyles.paragraph.fontSize * scaleFactor,
        lineHeight: baseStyles.paragraph.lineHeight * scaleFactor,
      },
      heading1: {
        ...baseStyles.heading1,
        fontSize: baseStyles.heading1.fontSize * scaleFactor,
        lineHeight: baseStyles.heading1.lineHeight * scaleFactor,
      },
      heading2: {
        ...baseStyles.heading2,
        fontSize: baseStyles.heading2.fontSize * scaleFactor,
        lineHeight: baseStyles.heading2.lineHeight * scaleFactor,
      },
      heading3: {
        ...baseStyles.heading3,
        fontSize: baseStyles.heading3.fontSize * scaleFactor,
        lineHeight: baseStyles.heading3.lineHeight * scaleFactor,
      },
      list_item: {
        ...baseStyles.list_item,
        fontSize: baseStyles.list_item.fontSize * scaleFactor,
        lineHeight: baseStyles.list_item.lineHeight * scaleFactor,
      },
      code_inline: {
        ...baseStyles.code_inline,
        fontSize: baseStyles.code_inline.fontSize * scaleFactor,
      },
      code_block: {
        ...baseStyles.code_block,
        fontSize: baseStyles.code_block.fontSize * scaleFactor,
      },
    };

    return (
      <ScrollView style={styles.markdownContainer}>
        <Markdown style={adjustedStyles}>
          {params.content || ''}
        </Markdown>
      </ScrollView>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
        }}
      />
      <SafeAreaView style={[styles.container, theme === 'dark' && styles.darkTheme]}>
        {/* Header */}
        <View 
          style={[
            styles.header,
            theme === 'dark' && styles.darkHeader,
            { paddingTop: insets.top > 0 ? 8 : 16 }
          ]}
        >
          <TouchableOpacity 
            style={styles.headerButton} 
            onPress={handleBack}
          >
            <MaterialIcons name="arrow-back" size={24} color={theme === 'dark' ? '#fff' : '#000'} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text 
              style={[
                styles.headerTitle, 
                theme === 'dark' && styles.darkText
              ]}
              numberOfLines={1}
            >
              {params.fileName}
            </Text>
          </View>
          <TouchableOpacity 
            style={[styles.headerButton, styles.shareButton]} 
            onPress={handleShare}
          >
            <MaterialIcons name="share" size={24} color="#68D391" />
          </TouchableOpacity>
        </View>

        {/* View Mode Tabs */}
        <View style={[styles.tabContainer, theme === 'dark' && styles.darkTab]}>
          <TouchableOpacity
            style={[
              styles.tab,
              viewMode === 'markdown' && styles.activeTab,
            ]}
            onPress={() => setViewMode('markdown')}
          >
            <MaterialIcons
              name="text-snippet"
              size={20}
              color={viewMode === 'markdown' ? '#007AFF' : theme === 'dark' ? '#999' : '#666'}
            />
            <Text
              style={[
                styles.tabText,
                viewMode === 'markdown' && styles.activeTabText,
                theme === 'dark' && styles.darkTabText,
              ]}
            >
              Markdown
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              viewMode === 'document' && styles.activeTab,
            ]}
            onPress={() => setViewMode('document')}
          >
            <MaterialIcons
              name="description"
              size={20}
              color={viewMode === 'document' ? '#007AFF' : theme === 'dark' ? '#999' : '#666'}
            />
            <Text
              style={[
                styles.tabText,
                viewMode === 'document' && styles.activeTabText,
                theme === 'dark' && styles.darkTabText,
              ]}
            >
              Document
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.contentContainer}>
          {viewMode === 'document' ? renderDocumentView() : renderMarkdownView()}

          {/* Reading Controls */}
          <View style={[
            styles.controls, 
            theme === 'dark' && styles.darkControls,
            { paddingBottom: Math.max(16, insets.bottom) }
          ]}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => setFontSize(Math.max(12, fontSize - 2))}
            >
              <MaterialIcons name="text-fields" size={20} color="#007AFF" />
              <Text style={styles.controlText}>A-</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => setFontSize(Math.min(24, fontSize + 2))}
            >
              <MaterialIcons name="text-fields" size={24} color="#007AFF" />
              <Text style={styles.controlText}>A+</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            >
              <MaterialIcons
                name={theme === 'light' ? 'dark-mode' : 'light-mode'}
                size={24}
                color="#007AFF"
              />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  darkTheme: {
    backgroundColor: '#1a1a1a',
  },
  contentContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
    backgroundColor: '#fff',
    height: 56,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  darkHeader: {
    backgroundColor: '#1a1a1a',
    borderBottomColor: '#333',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  shareButton: {
    backgroundColor: 'rgba(104, 211, 145, 0.15)',
  },
  headerTitleContainer: {
    flex: 1,
    marginHorizontal: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: '#000',
  },
  darkText: {
    color: '#fff',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
    backgroundColor: '#fff',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#007AFF',
    backgroundColor: 'rgba(0, 122, 255, 0.05)',
  },
  darkTab: {
    backgroundColor: '#1a1a1a',
    borderBottomColor: '#333',
  },
  tabText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#666',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  darkTabText: {
    color: '#e1e1e1',
  },
  markdownContainer: {
    flex: 1,
    paddingVertical: 16,
  },
  pdfContainer: {
    flex: 1,
    width: width,
  },
  pdfView: {
    flex: 1,
    width: width,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e1e1e1',
    backgroundColor: '#fff',
  },
  darkControls: {
    backgroundColor: '#1a1a1a',
    borderTopColor: '#333',
  },
  controlButton: {
    padding: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  controlText: {
    marginLeft: 4,
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
}); 