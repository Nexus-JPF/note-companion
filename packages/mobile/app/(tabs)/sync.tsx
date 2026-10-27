import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { useSemanticColor } from '@/hooks/useThemeColor';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface IntegrationOption {
  id: string;
  name: string;
  icon: string;
  description: string;
  comingSoon: boolean;
}

const integrations: IntegrationOption[] = [
  {
    id: 'obsidian',
    name: 'Obsidian',
    icon: 'book',
    description: 'Sync your files directly with your Obsidian vault',
    comingSoon: false,
  },
  {
    id: 'gdrive',
    name: 'Google Drive',
    icon: 'cloud',
    description: 'Backup your files to Google Drive',
    comingSoon: true,
  },
  {
    id: 'icloud',
    name: 'iCloud',
    icon: 'cloud-download',
    description: 'Seamlessly sync with your iCloud storage',
    comingSoon: true,
  },
  {
    id: 'notion',
    name: 'Notion',
    icon: 'description',
    description: 'Import files directly to your Notion workspace',
    comingSoon: true,
  },
];

export default function SyncScreen() {
  const primaryColor = useSemanticColor('primary');
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={styles.wrapper}>
      <ThemedView variant="elevated" style={[styles.header, { paddingTop: Math.max(20, insets.top) }]}>
        <View style={styles.titleContainer}>
          <MaterialIcons name="sync" size={28} color={primaryColor} style={styles.icon} />
          <ThemedText type="heading" style={styles.headerTitle}>Synced Notes</ThemedText>
        </View>
        <ThemedText colorName="textSecondary" type="label" style={styles.headerSubtitle}>
          Connect with your favorite services
        </ThemedText>
      </ThemedView>

      <ScrollView style={styles.container} contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 120 }]}>
        <View style={styles.mainSection}>
          <View style={styles.explanationCard}>
            <MaterialIcons name="update" size={24} color={primaryColor} />
            <Text style={styles.explanationTitle}>Seamless Integration</Text>
            <Text style={styles.explanationText}>
              We're working on integrations with your favorite services to make your file organization experience even better.
            </Text>
          </View>

          {/* Apple Notes integration card */}
          <View style={styles.appleNotesCard}>
            <View style={styles.appleNotesHeader}>
              <MaterialIcons name="share" size={28} color={primaryColor} />
              <Text style={styles.appleNotesTitle}>Sync with Apple Notes</Text>
            </View>
            <Text style={styles.appleNotesText}>
              You can quickly add any of your notes to Apple Notes using the Share button in each note card.
            </Text>
            <View style={styles.appleNotesSteps}>
              <View style={styles.stepRow}>
                <View style={styles.stepBullet}><Text style={styles.stepNumber}>1</Text></View>
                <Text style={styles.stepText}>Open any note from your list</Text>
              </View>
              <View style={styles.stepRow}>
                <View style={styles.stepBullet}><Text style={styles.stepNumber}>2</Text></View>
                <Text style={styles.stepText}>Tap the green Share button in the top right</Text>
              </View>
              <View style={styles.stepRow}>
                <View style={styles.stepBullet}><Text style={styles.stepNumber}>3</Text></View>
                <Text style={styles.stepText}>Select "Notes" from the share sheet</Text>
              </View>
              <View style={styles.stepRow}>
                <View style={styles.stepBullet}><Text style={styles.stepNumber}>4</Text></View>
                <Text style={styles.stepText}>Add any additional text and tap Save</Text>
              </View>
            </View>
          </View>

          <View style={styles.integrationsList}>
            {integrations.map((integration) => (
              <View key={integration.id} style={styles.integrationCard}>
                <View style={styles.integrationHeader}>
                  <MaterialIcons name={integration.icon as any} size={32} color={primaryColor} />
                  <View style={styles.integrationTitleContainer}>
                    <Text style={styles.integrationTitle}>{integration.name}</Text>
                    {integration.comingSoon ? (
                      <View style={styles.comingSoonBadge}>
                        <Text style={styles.comingSoonText}>Coming Soon</Text>
                      </View>
                    ) : (
                      <View style={styles.availableBadge}>
                        <Text style={styles.availableText}>Available</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={styles.integrationDescription}>
                  {integration.description}
                </Text>
                {integration.id === 'obsidian' && !integration.comingSoon && (
                  <View style={styles.instructionsContainer}>
                    <Text style={styles.instructionsTitle}>How to sync:</Text>
                    <Text style={styles.instructionsText}>
                      1. Visit notecompanion.ai in your browser{'\n'}
                      2. Follow the instructions for Obsidian integration{'\n'}
                      3. Your notes will sync between this app and your Obsidian vault
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          <View style={styles.notificationCard}>
            <MaterialIcons name="notifications-active" size={24} color={primaryColor} />
            <Text style={styles.notificationTitle}>Stay Updated</Text>
            <Text style={styles.notificationText}>
              We'll notify you as soon as these integrations become available.
            </Text>
            <Text style={styles.notificationHint}>
              You can view your saved notes in the My Notes tab.
            </Text>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    marginRight: 8,
  },
  headerTitle: {
    fontWeight: '700',
  },
  headerSubtitle: {
    marginBottom: 8,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
  mainSection: {
    padding: 16,
  },
  explanationCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e1e1e1',
  },
  explanationTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginVertical: 12,
    color: '#1a1a1a',
  },
  explanationText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  integrationsList: {
    gap: 16,
  },
  integrationCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e1e1e1',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
  },
  integrationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  integrationTitleContainer: {
    flex: 1,
    marginLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  integrationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  comingSoonBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  comingSoonText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  availableBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  availableText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  integrationDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  instructionsContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  instructionsText: {
    fontSize: 13,
    color: '#555',
    lineHeight: 20,
  },
  notificationCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  notificationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginVertical: 8,
  },
  notificationText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  notificationHint: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 12,
  },
  appleNotesCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e1e1e1',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
  },
  appleNotesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  appleNotesTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
    color: '#1a1a1a',
  },
  appleNotesText: {
    fontSize: 15,
    color: '#666',
    marginBottom: 16,
    lineHeight: 22,
  },
  appleNotesSteps: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgb(159, 122, 234)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumber: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  stepText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
});