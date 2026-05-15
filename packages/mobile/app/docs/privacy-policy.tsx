import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Button } from '@/components/Button';

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <Button 
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </Button>
        <ThemedText style={styles.title}>Privacy Policy</ThemedText>
      </View>
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <ThemedText style={styles.lastUpdated}>Last Updated: March 13, 2025</ThemedText>
          
          <ThemedText style={styles.sectionTitle}>Introduction</ThemedText>
          <ThemedText style={styles.paragraph}>
            Welcome to Note Companion. We respect your privacy and are committed to protecting your personal data. 
            This privacy policy explains how we collect, use, and safeguard your information when you use our application.
          </ThemedText>
          
          <ThemedText style={styles.sectionTitle}>Information We Collect</ThemedText>
          <ThemedText style={styles.subSectionTitle}>Personal Information</ThemedText>
          <View style={styles.bulletList}>
            <ThemedText style={styles.bulletPoint}>• Account information (email, name) when you register</ThemedText>
            <ThemedText style={styles.bulletPoint}>• Authentication data when using social sign-in methods</ThemedText>
            <ThemedText style={styles.bulletPoint}>• User-generated content (notes, documents, images)</ThemedText>
          </View>
          
          <ThemedText style={styles.subSectionTitle}>Automatically Collected Information</ThemedText>
          <View style={styles.bulletList}>
            <ThemedText style={styles.bulletPoint}>• Device information (model, operating system)</ThemedText>
            <ThemedText style={styles.bulletPoint}>• App usage statistics</ThemedText>
            <ThemedText style={styles.bulletPoint}>• Crash reports and performance data</ThemedText>
          </View>
          
          <ThemedText style={styles.sectionTitle}>How We Use Your Information</ThemedText>
          <ThemedText style={styles.paragraph}>
            We use your information to:
          </ThemedText>
          <View style={styles.bulletList}>
            <ThemedText style={styles.bulletPoint}>• Provide and maintain our service</ThemedText>
            <ThemedText style={styles.bulletPoint}>• Authenticate you and secure your account</ThemedText>
            <ThemedText style={styles.bulletPoint}>• Sync your notes across devices</ThemedText>
            <ThemedText style={styles.bulletPoint}>• Improve and personalize your experience</ThemedText>
            <ThemedText style={styles.bulletPoint}>• Communicate with you about service updates</ThemedText>
          </View>
          
          <ThemedText style={styles.sectionTitle}>Data Storage and Security</ThemedText>
          <View style={styles.bulletList}>
            <ThemedText style={styles.bulletPoint}>• Your notes and files are stored on your device and in our secure cloud storage</ThemedText>
            <ThemedText style={styles.bulletPoint}>• All data is encrypted in transit and at rest</ThemedText>
            <ThemedText style={styles.bulletPoint}>• We implement industry-standard security measures to protect your data</ThemedText>
          </View>
          
          <ThemedText style={styles.sectionTitle}>Data Sharing</ThemedText>
          <ThemedText style={styles.paragraph}>
            We do not sell your personal information. We may share data with:
          </ThemedText>
          <View style={styles.bulletList}>
            <ThemedText style={styles.bulletPoint}>• Service providers who help us deliver our services</ThemedText>
            <ThemedText style={styles.bulletPoint}>• When required by law or to protect our rights</ThemedText>
          </View>
          
          <ThemedText style={styles.sectionTitle}>Your Rights</ThemedText>
          <ThemedText style={styles.paragraph}>
            You have the right to:
          </ThemedText>
          <View style={styles.bulletList}>
            <ThemedText style={styles.bulletPoint}>• Access your personal data</ThemedText>
            <ThemedText style={styles.bulletPoint}>• Correct inaccurate data</ThemedText>
            <ThemedText style={styles.bulletPoint}>• Delete your account and associated data</ThemedText>
            <ThemedText style={styles.bulletPoint}>• Export your data</ThemedText>
            <ThemedText style={styles.bulletPoint}>• Opt-out of certain data collection</ThemedText>
          </View>
          
          <ThemedText style={styles.sectionTitle}>Children's Privacy</ThemedText>
          <ThemedText style={styles.paragraph}>
            Our service is not intended for children under 13. We do not knowingly collect information from children under 13.
          </ThemedText>
          
          <ThemedText style={styles.sectionTitle}>Changes to This Policy</ThemedText>
          <ThemedText style={styles.paragraph}>
            We may update this policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last Updated" date.
          </ThemedText>
          
          <ThemedText style={styles.sectionTitle}>Contact Us</ThemedText>
          <ThemedText style={styles.paragraph}>
            If you have questions about this privacy policy, please contact us at:
          </ThemedText>
          <ThemedText style={styles.bulletPoint}>Email: support@notecompanion.com</ThemedText>
          
          <ThemedText style={[styles.paragraph, styles.finalParagraph]}>
            By using Note Companion, you agree to the terms of this privacy policy.
          </ThemedText>
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  lastUpdated: {
    fontStyle: 'italic',
    marginBottom: 20,
    fontSize: 14,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 8,
  },
  subSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  bulletList: {
    marginLeft: 8,
    marginBottom: 16,
  },
  bulletPoint: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 8,
  },
  finalParagraph: {
    marginTop: 24,
    fontWeight: '500',
  },
});