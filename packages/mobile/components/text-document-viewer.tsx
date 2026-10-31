import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { withInlineDiagramImages } from '@/utils/diagram-markdown';

interface TextDocumentViewerProps {
  content: string;
  title?: string;
  metadata?: {
    date?: string;
    page?: string;
    source?: string;
  };
}

export const TextDocumentViewer: React.FC<TextDocumentViewerProps> = ({
  content,
  title,
  metadata,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <View style={styles.container}>
      {/* Document Header */}
      {(title || metadata) && (
        <View style={styles.header}>
          {title && <Text style={styles.title}>{title}</Text>}
          {metadata?.date && (
            <Text style={styles.metadata}>Date: {metadata.date}</Text>
          )}
          {metadata?.page && (
            <Text style={styles.metadata}>Page: {metadata.page}</Text>
          )}
          {metadata?.source && (
            <Text style={styles.metadata}>Source: {metadata.source}</Text>
          )}
        </View>
      )}

      {/* Document Content */}
      <ScrollView
        style={[
          styles.contentContainer,
          !isExpanded && { maxHeight: 400 },
        ]}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.contentWrapper}>
          <Markdown
            style={markdownStyles}
            mergeStyle={true}
          >
            {withInlineDiagramImages(content)}
          </Markdown>
        </View>
      </ScrollView>

      {/* Expand/Collapse Button */}
      <TouchableOpacity
        style={styles.expandButton}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <MaterialIcons
          name={isExpanded ? 'expand-less' : 'expand-more'}
          size={24}
          color="rgb(159, 122, 234)"
        />
        <Text style={styles.expandButtonText}>
          {isExpanded ? 'Show less' : 'Show more'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgb(255, 250, 240)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    margin: 16,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    backgroundColor: 'rgb(255, 250, 240)',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  metadata: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  contentContainer: {
    backgroundColor: 'rgb(255, 250, 240)',
  },
  contentWrapper: {
    padding: 16,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    backgroundColor: 'rgb(255, 250, 240)',
  },
  expandButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: 'rgb(159, 122, 234)',
    fontWeight: '500',
  },
});

const markdownStyles = {
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: '#2c3e50',
  },
  heading1: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
    paddingBottom: 8,
  },
  heading2: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginVertical: 14,
  },
  heading3: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginVertical: 12,
  },
  paragraph: {
    marginVertical: 12,
  },
  list: {
    marginVertical: 8,
  },
  listItem: {
    marginVertical: 4,
  },
  listUnorderedItemIcon: {
    fontSize: 16,
    lineHeight: 24,
    color: 'rgb(159, 122, 234)',
    marginRight: 8,
  },
  link: {
    color: 'rgb(159, 122, 234)',
    textDecorationLine: 'underline' as const,
  },
  blockquote: {
    borderLeftWidth: 4,
    borderLeftColor: 'rgb(159, 122, 234)',
    paddingLeft: 16,
    marginVertical: 12,
    backgroundColor: 'rgba(159, 122, 234, 0.05)',
    paddingVertical: 8,
  },
  code_inline: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    backgroundColor: 'rgba(159, 122, 234, 0.05)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 14,
  },
  code_block: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    backgroundColor: 'rgba(159, 122, 234, 0.05)',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
    fontSize: 14,
  },
  fence: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    backgroundColor: 'rgba(159, 122, 234, 0.05)',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
    fontSize: 14,
  },
  table: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 8,
    marginVertical: 12,
  },
  thead: {
    backgroundColor: 'rgba(159, 122, 234, 0.05)',
  },
  th: {
    padding: 12,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  td: {
    padding: 12,
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
}; 