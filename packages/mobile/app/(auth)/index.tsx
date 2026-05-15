import React from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@clerk/clerk-react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// Define valid icon types for TypeScript
type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

export default function IndexScreen() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  
  // If already signed in, redirect to main app
  if (isLoaded && isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }
  
  const features = [
    {
      title: "Document OCR",
      description: "Upload documents and photos to automatically extract text using OCR technology",
      icon: "document-scanner" as IconName,
    },
    {
      title: "Cross-Platform Sync",
      description: "Access your transcribed notes on Obsidian, Apple Notes, Telegram and more",
      icon: "sync" as IconName,
    },
    {
      title: "Web Dashboard",
      description: "Manage all your transcribed documents on our convenient web interface",
      icon: "computer" as IconName,
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      >
        <View style={styles.header}>
          <Image 
            source={require('@/assets/big-logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Note Companion</Text>
          <Text style={styles.subtitle}>
            Document OCR and Cross-Platform Sync
          </Text>
        </View>
        
        <View style={styles.demoSection}>
          <Text style={styles.sectionHeading}>Scan • Transcribe • Sync</Text>
          <Text style={styles.sectionDescription}>
            Upload your documents and photos to instantly transcribe text with OCR. 
            Access your transcribed content across multiple platforms.
          </Text>
          
          {features.map((feature, index) => (
            <View key={index} style={styles.featureCard}>
              <MaterialIcons name={feature.icon} size={28} color="#8a65ed" style={styles.featureIcon} />
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            </View>
          ))}
          
          <TouchableOpacity 
            style={styles.learnMoreButton}
            onPress={() => router.push('/(auth)/welcome')}
          >
            <Text style={styles.learnMoreText}>Learn More</Text>
            <MaterialIcons name="arrow-forward" size={18} color="#8a65ed" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.infoSection}>
          <MaterialIcons name="info-outline" size={24} color="#666" style={styles.infoIcon} />
          <Text style={styles.infoText}>
            Note Companion is a companion app for the Note Companion AI web service. 
            Sign in to upload documents, extract text with OCR, and sync with other platforms.
          </Text>
        </View>
      </ScrollView>
      
      <View style={[styles.footer, { paddingBottom: Math.max(20, insets.bottom) }]}>
        <TouchableOpacity 
          style={styles.signInButton}
          onPress={() => router.push('/(auth)/sign-in')}
        >
          <Text style={styles.signInButtonText}>Sign In</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.createAccountButton}
          onPress={() => router.push('/(auth)/sign-up')}
        >
          <Text style={styles.createAccountButtonText}>Create Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginVertical: 30,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  demoSection: {
    marginBottom: 30,
  },
  sectionHeading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  sectionDescription: {
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  featureCard: {
    flexDirection: 'row',
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  featureIcon: {
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  infoSection: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 12,
    marginBottom: 30,
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  footer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  signInButton: {
    backgroundColor: '#8a65ed',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  createAccountButton: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  createAccountButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  learnMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    padding: 10,
  },
  learnMoreText: {
    color: '#8a65ed',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 6,
  },
}); 