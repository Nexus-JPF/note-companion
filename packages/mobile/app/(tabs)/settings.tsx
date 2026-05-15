import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Platform, ScrollView, Linking, TouchableOpacity } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-react';
import { Button } from '../../components/Button';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';
import { MaterialIcons } from '@expo/vector-icons';
import { useSemanticColor } from '@/hooks/useThemeColor';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UsageStatus } from '@/components/usage-status';
import Constants from 'expo-constants';
import * as Localization from 'expo-localization';
import * as WebBrowser from 'expo-web-browser';

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const primaryColor = useSemanticColor('primary');
  const insets = useSafeAreaInsets();
  const isUS = Localization.getLocales()[0]?.regionCode === 'US';

  type ExtraConfig = { upgradeCheckoutUrl?: string };
  const checkoutUrl = process.env.EXPO_PUBLIC_UPGRADE_CHECKOUT_URL;


  const handleUpgrade = async () => {
    if (!checkoutUrl) {
      Alert.alert('Unavailable', 'Upgrade link is not configured.');
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(checkoutUrl);
    } catch (error) {
      console.error("Failed to open upgrade URL:", error);
      Alert.alert("Error", "Could not open the upgrade page.");
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: confirmDeleteAccount
        }
      ],
      { cancelable: true }
    );
  };

  const confirmDeleteAccount = async () => {
    try {
      // First attempt to delete the user
      await user?.delete();
      // If successful, sign out
      await signOut();
    } catch (error) {
      console.error("Error deleting account:", error);
      Alert.alert(
        "Error",
        "There was a problem deleting your account. Please try again later."
      );
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedView variant="elevated" style={[styles.header, { paddingTop: Math.max(20, insets.top) }]}>
        <View style={styles.titleContainer}>
          <MaterialIcons name="settings" size={28} color={primaryColor} style={styles.icon} />
          <ThemedText type="heading" style={styles.headerTitle}>Settings</ThemedText>
        </View>
        <ThemedText colorName="textSecondary" type="label" style={styles.headerSubtitle}>
          Manage your account and preferences
        </ThemedText>
      </ThemedView>
      
      <ScrollView 
        style={styles.contentContainer}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Account</ThemedText>
          
          <ThemedView variant="elevated" style={styles.card}>
            <View style={styles.userInfo}>
              <MaterialIcons name="account-circle" size={40} color={primaryColor} />
              <View style={styles.userDetails}>
                <ThemedText type="defaultSemiBold">{user?.fullName || user?.username}</ThemedText>
                <ThemedText colorName="textSecondary" type="caption">{user?.primaryEmailAddress?.emailAddress}</ThemedText>
              </View>
            </View>
          </ThemedView>
        </View>

        {/* Account Status Section */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Account Status</ThemedText>
          
          <UsageStatus />
          
          <ThemedView variant="elevated" style={styles.infoCard}>
            <MaterialIcons name="info-outline" size={20} color={primaryColor} style={styles.infoIcon} />
            <ThemedText colorName="textSecondary" style={styles.infoText}>
              This is a companion app for Note Companion AI service. Your account status reflects the features available to you.
            </ThemedText>
          </ThemedView>
        </View>
        
        {/* Upgrade and Sign Out buttons */}
        <View style={styles.actionsContainer}> 

          {/* Upgrade Section (Conditional for US) */}
          {isUS && (
            <View style={styles.upgradeSection}>
              <Button
                onPress={handleUpgrade}
                variant="primary"
              >
                Upgrade on notecompanion.ai
              </Button>

              {/* Disclosure for External Purchase Link */}
              <View style={styles.disclosureSection}>
                <ThemedText style={styles.disclosureText} colorName="textSecondary">
                  <ThemedText style={[styles.disclosureText, { fontWeight: '600' }]}>Note Companion AI - Cloud Plan</ThemedText>{'\n\n'}
                  Subscription Length: Monthly (recurring payment, cancel anytime){'\n'}
                  Price: $15.00/month{'\n\n'}
                  Tapping "Upgrade on notecompanion.ai" will take you outside the app to complete your purchase. This subscription is managed entirely through our website, not Apple.
                </ThemedText>
              </View>
              <TouchableOpacity style={styles.tosLink} onPress={() => Linking.openURL('https://notecompanion.ai/terms-of-service')}>
                <ThemedText style={styles.tosLinkText}>Terms of Service</ThemedText>
                <MaterialIcons name="launch" size={16} color={primaryColor} />
              </TouchableOpacity>
            </View>
          )}

          {/* Sign Out Button */}
          <View style={styles.signOutContainer}>
            <Button
              onPress={() => signOut()}
              variant="secondary" 
              textStyle={{color: '#333333', fontWeight: '600'}}
            >
              Sign Out
            </Button>
          </View>
        </View>
        
        {/* Danger Zone Section */}
        <View style={styles.dangerSection}>
          <ThemedText type="subtitle" style={styles.dangerTitle}>Danger Zone</ThemedText>
          <ThemedView style={styles.dangerCard}>
            <ThemedText style={styles.dangerText}>
              Deleting your account will permanently remove all your data and cannot be undone.
            </ThemedText>
            <Button
              onPress={handleDeleteAccount}
              variant="danger" 
              style={styles.deleteButton}
            >
              Delete Account
            </Button>
          </ThemedView>
        </View>

        {/* Legal Section */}
        <View style={styles.legalSection}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Legal</ThemedText>
          <TouchableOpacity style={styles.legalLink} onPress={() => Linking.openURL('https://notecompanion.ai/privacy')}> 
            <ThemedText style={styles.legalLinkText}>Privacy Policy</ThemedText>
            <MaterialIcons name="launch" size={16} color={primaryColor} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.legalLink} onPress={() => Linking.openURL('https://notecompanion.ai/terms-of-service')}>
            <ThemedText style={styles.legalLinkText}>Terms of Service</ThemedText>
            <MaterialIcons name="launch" size={16} color={primaryColor} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
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
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginTop: 8,
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userDetails: {
    marginLeft: 12,
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  actionsContainer: {
    paddingVertical: 20,
    marginTop: 10,
  },
  upgradeSection: {
    marginBottom: 16,
  },
  signOutContainer: {
    marginTop: 10,
  },
  dangerSection: {
    marginTop: 10,
    marginBottom: 40,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  dangerTitle: {
    color: '#E53E3E',
    marginBottom: 16,
  },
  dangerCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(229, 62, 62, 0.3)',
    backgroundColor: 'rgba(254, 215, 215, 0.1)',
  },
  dangerText: {
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 20,
  },
  deleteButton: {
    borderRadius: 12,
    minHeight: 48,
    backgroundColor: '#E53E3E',
    marginTop: 8,
  },
  disclosureSection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: 'rgba(254, 215, 215, 0.1)',
  },
  disclosureText: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  tosLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  tosLinkText: {
    marginRight: 8,
    color: '#007AFF',
    fontSize: 14,
  },
  legalSection: {
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
    backgroundColor: 'rgba(254, 215, 215, 0.1)',
  },
  legalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legalLinkText: {
    marginLeft: 8,
  },
});
