import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useAuth } from '@clerk/clerk-react';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedView } from './ThemedView';
import { ThemedText } from './ThemedText';
import { useSemanticColor } from '@/hooks/useThemeColor';
import { API_URL } from '@/constants/config';

type UsageStatusProps = {
  compact?: boolean;
};

type UsageData = {
  tokenUsage: number;
  maxTokenUsage: number;
  subscriptionStatus: string;
  tier: string;
  // Note: audioTranscriptionMinutes and maxAudioTranscriptionMinutes are intentionally
  // excluded from the mobile app display for now, even if present in the API response
};

export function UsageStatus({ compact = false }: UsageStatusProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const { getToken } = useAuth();
  const primaryColor = useSemanticColor('primary');

  useEffect(() => {
    async function fetchUsageData() {
      try {
        const token = await getToken();
        if (!token) {
          setError('Authentication required');
          setLoading(false);
          return;
        }

        const response = await fetch(`${API_URL}/api/usage`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Error fetching usage data: ${response.status}`);
        }

        const data = await response.json();
        setUsageData(data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching usage info:', err);
        setError('Could not load usage information');
        setLoading(false);
      }
    }

    fetchUsageData();
  }, []);

  if (loading) {
    return (
      <ThemedView
        variant="elevated"
        style={[styles.card, compact && styles.compactCard]}
      >
        <ActivityIndicator size="small" color={primaryColor} />
        <ThemedText style={{ marginTop: 8 }}>
          Loading usage information...
        </ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView
        variant="elevated"
        style={[styles.card, compact && styles.compactCard]}
      >
        <MaterialIcons name="error-outline" size={24} color="#E53E3E" />
        <ThemedText style={{ marginTop: 8 }}>{error}</ThemedText>
      </ThemedView>
    );
  }

  // Format the plan name for display
  const getPlanDisplay = (plan: string) => {
    switch (plan?.toLowerCase()) {
      case 'free':
        return 'Free Plan';
      case 'monthly':
        return 'Monthly Subscription';
      case 'yearly':
        return 'Yearly Subscription';
      default:
        return plan || 'Basic Plan';
    }
  };

  return (
    <ThemedView
      variant="elevated"
      style={[styles.card, compact && styles.compactCard]}
    >
      <View style={styles.planInfo}>
        <MaterialIcons name="star" size={24} color={primaryColor} />
        <View style={styles.planDetails}>
          <ThemedText type="defaultSemiBold">
            {getPlanDisplay(usageData?.tier || 'free')}
          </ThemedText>
          <ThemedText colorName="textSecondary" type="caption">
            {usageData?.subscriptionStatus === 'active'
              ? 'Active Account'
              : 'Free Usage'}
          </ThemedText>
        </View>
      </View>

      {usageData && (
        <View style={styles.usageInfo}>
          <ThemedText type="caption" colorName="textSecondary">
            Usage: {usageData.tokenUsage} / {usageData.maxTokenUsage} tokens
          </ThemedText>
          <View style={styles.usageBar}>
            <View
              style={[
                styles.usageProgress,
                {
                  width: `${Math.min(
                    100,
                    (usageData.tokenUsage / usageData.maxTokenUsage) * 100
                  )}%`,
                  backgroundColor: primaryColor,
                },
              ]}
            />
          </View>
        </View>
      )}

      {!compact && (
        <ThemedText style={styles.subscriptionNote}>
          {'Thank you for being a Note Companion AI member.'}
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  compactCard: {
    padding: 12,
    marginBottom: 12,
  },
  planInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    alignSelf: 'flex-start',
    width: '100%',
  },
  planDetails: {
    marginLeft: 12,
  },
  usageInfo: {
    width: '100%',
    marginBottom: 16,
  },
  usageBar: {
    height: 6,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  usageProgress: {
    height: '100%',
    borderRadius: 3,
  },
  subscriptionNote: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
    paddingHorizontal: 16,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8a65ed',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 10,
    width: '100%',
  },
  upgradeIcon: {
    marginRight: 4,
  },
  upgradeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
