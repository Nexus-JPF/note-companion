import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Button } from '@/components/Button';

export default function TermsOfServiceScreen() {
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
        <ThemedText style={styles.title}>Terms of Service</ThemedText>
      </View>
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <ThemedText style={styles.lastUpdated}>Last Updated: March 13, 2025</ThemedText>
          
          <ThemedText style={styles.sectionTitle}>Introduction</ThemedText>
          <ThemedText style={styles.paragraph}>
            Welcome to Note Companion. By using our application, you agree to these Terms of Service. 
            Please read them carefully.
          </ThemedText>
          
          <ThemedText style={styles.sectionTitle}>Account Registration</ThemedText>
          <ThemedText style={styles.paragraph}>
            You may need to create an account to use some features of our service. You are responsible for:
          </ThemedText>
          <View style={styles.bulletList}>
            <ThemedText style={styles.bulletPoint}>• Providing accurate information</ThemedText>
            <ThemedText style={styles.bulletPoint}>• Maintaining the security of your account</ThemedText>
            <ThemedText style={styles.bulletPoint}>• All activities that occur under your account</ThemedText>
          </View>
          
          <ThemedText style={styles.sectionTitle}>Acceptable Use</ThemedText>
          <ThemedText style={styles.paragraph}>
            You agree not to:
          </ThemedText>
          <View style={styles.bulletList}>
            <ThemedText style={styles.bulletPoint}>• Use the service for any illegal purpose</ThemedText>
            <ThemedText style={styles.bulletPoint}>• Upload or share content that infringes on others' rights</ThemedText>
            <ThemedText style={styles.bulletPoint}>• Attempt to bypass any security measures</ThemedText>
            <ThemedText style={styles.bulletPoint}>• Interfere with the proper functioning of the service</ThemedText>
            <ThemedText style={styles.bulletPoint}>• Share your account credentials with others</ThemedText>
          </View>
          
          <ThemedText style={styles.sectionTitle}>User Content</ThemedText>
          <View style={styles.bulletList}>
            <ThemedText style={styles.bulletPoint}>• You retain ownership of the content you create and upload</ThemedText>
            <ThemedText style={styles.bulletPoint}>• You grant us a license to store, use, and display your content for the purpose of providing the service</ThemedText>
            <ThemedText style={styles.bulletPoint}>• You are solely responsible for your content and its legality</ThemedText>
          </View>
          
          <ThemedText style={styles.sectionTitle}>Intellectual Property</ThemedText>
          <View style={styles.bulletList}>
            <ThemedText style={styles.bulletPoint}>• Our service, including all software, designs, logos, and documentation, is owned by us</ThemedText>
            <ThemedText style={styles.bulletPoint}>• We grant you a limited, non-exclusive license to use our service for its intended purpose</ThemedText>
          </View>
          
          <ThemedText style={styles.sectionTitle}>Service Availability</ThemedText>
          <View style={styles.bulletList}>
            <ThemedText style={styles.bulletPoint}>• We strive to provide a reliable service but do not guarantee uninterrupted access</ThemedText>
            <ThemedText style={styles.bulletPoint}>• We reserve the right to modify or discontinue features with reasonable notice</ThemedText>
          </View>
          
          <ThemedText style={styles.sectionTitle}>Termination</ThemedText>
          <View style={styles.bulletList}>
            <ThemedText style={styles.bulletPoint}>• You may terminate your account at any time</ThemedText>
            <ThemedText style={styles.bulletPoint}>• We may suspend or terminate your account for violations of these terms</ThemedText>
            <ThemedText style={styles.bulletPoint}>• Upon termination, your data may be deleted according to our data retention policies</ThemedText>
          </View>
          
          <ThemedText style={styles.sectionTitle}>Disclaimers</ThemedText>
          <ThemedText style={styles.paragraph}>
            The service is provided "as is" without warranties of any kind, either express or implied.
          </ThemedText>
          
          <ThemedText style={styles.sectionTitle}>Limitation of Liability</ThemedText>
          <ThemedText style={styles.paragraph}>
            We shall not be liable for any indirect, incidental, special, consequential, or punitive damages.
          </ThemedText>
          
          <ThemedText style={styles.sectionTitle}>Changes to Terms</ThemedText>
          <ThemedText style={styles.paragraph}>
            We may modify these terms at any time. Continued use of the service after changes constitutes acceptance of modified terms.
          </ThemedText>
          
          <ThemedText style={styles.sectionTitle}>Governing Law</ThemedText>
          <ThemedText style={styles.paragraph}>
            These terms shall be governed by the laws of the jurisdiction where the company is registered.
          </ThemedText>
          
          <ThemedText style={styles.sectionTitle}>Contact</ThemedText>
          <ThemedText style={styles.paragraph}>
            If you have questions about these terms, please contact us at:
          </ThemedText>
          <ThemedText style={styles.bulletPoint}>Email: support@notecompanion.com</ThemedText>
          
          <ThemedText style={[styles.paragraph, styles.finalParagraph]}>
            By using Note Companion, you acknowledge that you have read, understood, and agree to these Terms of Service.
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