import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Dimensions,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Check } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import useSubscriptionStore from '../state/subscriptionStore';
import useProfileStore from '../state/profileStore';
import { useWorkspaceColor } from '../hooks/useWorkspaceColor';
import {
  getPackage,
  purchasePackage,
  isRevenueCatEnabled,
} from '../lib/revenuecatClient';
import type { PurchasesPackage } from 'react-native-purchases';
import Agent3D from './Agent3D';
import type { AgentId } from '../data/agentPersonalities';

interface PaywallModalProps {
  visible: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
  canDismiss?: boolean;
}

const { width, height } = Dimensions.get('window');

const FEATURES = [
  'AI-powered Reddit lead detection',
  'Smart comment generation',
  'DM outreach to prospects',
  'Track and analyze your leads',
];

export default function PaywallModal({
  visible,
  onClose,
  onSuccess,
  canDismiss = true,
}: PaywallModalProps) {
  const refreshSubscriptionStatus = useSubscriptionStore(
    (s) => s.refreshSubscriptionStatus,
  );
  const profile = useProfileStore((s) => s.profile);
  const { color: workspaceColor } = useWorkspaceColor();

  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [monthlyPackage, setMonthlyPackage] = useState<PurchasesPackage | null>(null);
  const [yearlyPackage, setYearlyPackage] = useState<PurchasesPackage | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [error, setError] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);

  // Shine animation for premium card
  const shinePosition = useSharedValue(-150);

  useEffect(() => {
    shinePosition.value = withRepeat(
      withTiming(width + 150, {
        duration: 2500,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      false,
    );
  }, []);

  const shineAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shinePosition.value }],
  }));

  // Extract agent ID from profile
  useEffect(() => {
    if (!profile) return;

    // Get the assigned agent ID (prioritize top-level, fallback to onboarding data)
    const assignedAgent = profile?.assignedAgentId ?? profile?.onboardingData?.assignedAgentId;
    if (assignedAgent) {
      setAgentId(assignedAgent);
    }
  }, [profile]);

  useEffect(() => {
    if (visible) {
      loadPackage();
    }
  }, [visible]);

  const loadPackage = async () => {
    if (!isRevenueCatEnabled()) {
      setError('Subscriptions are not available yet. Please try again later.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [monthlyResult, yearlyResult] = await Promise.all([
      getPackage('$rc_monthly'),
      getPackage('$rc_annual'),
    ]);

    if (!monthlyResult.ok || !monthlyResult.data) {
      setError('Unable to load subscription. Please try again later.');
      setLoading(false);
      return;
    }

    setMonthlyPackage(monthlyResult.data);

    if (yearlyResult.ok && yearlyResult.data) {
      setYearlyPackage(yearlyResult.data);
    }

    setLoading(false);
  };

  const handleSubscribe = async () => {
    const packageToPurchase = selectedPlan === 'yearly' ? yearlyPackage : monthlyPackage;
    if (!packageToPurchase) return;

    setPurchasing(true);

    const result = await purchasePackage(packageToPurchase);

    if (!result.ok) {
      setError('Purchase failed. Please try again.');
      setPurchasing(false);
      return;
    }

    await refreshSubscriptionStatus();
    setPurchasing(false);
    onSuccess?.();
    onClose?.();
  };

  const handleClose = () => {
    if (!purchasing && canDismiss) {
      onClose?.();
    }
  };

  const monthlyPrice = monthlyPackage?.product.priceString || '$9.99';
  const yearlyPrice = yearlyPackage?.product.priceString || '$79.99';
  const yearlyMonthlyPrice = yearlyPackage?.product.price
    ? `$${(yearlyPackage.product.price / 12).toFixed(2)}`
    : '$6.67';
  const savingsPercent = monthlyPackage?.product.price && yearlyPackage?.product.price
    ? Math.round((1 - yearlyPackage.product.price / (monthlyPackage.product.price * 12)) * 100)
    : 33;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={canDismiss ? handleClose : undefined}
    >
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        {/* Close Button */}
        {canDismiss && (
          <TouchableOpacity
            onPress={handleClose}
            disabled={purchasing}
            style={{
              position: 'absolute',
              top: 50,
              right: 20,
              zIndex: 100,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        )}

        {/* 3D Agent - Top Section */}
        <View style={{ height: height * 0.42, position: 'relative' }}>
          {agentId ? (
            <Agent3D agentId={agentId as AgentId} workspaceColor={workspaceColor} showGrid={false} modelScale={2} modelOffsetY={-0.5} />
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={workspaceColor} />
            </View>
          )}

          {/* Mist-like gradient overlay */}
          <LinearGradient
            colors={[
              'rgba(0, 0, 0, 0)',
              'rgba(0, 0, 0, 0)',
              'rgba(0, 0, 0, 0.3)',
              'rgba(0, 0, 0, 0.7)',
              'rgba(0, 0, 0, 0.95)',
              'rgba(0, 0, 0, 1)',
            ]}
            locations={[0, 0.3, 0.5, 0.7, 0.9, 1]}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: height * 0.25,
              pointerEvents: 'none',
            }}
          />
        </View>

        {/* Content - Bottom Half */}
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 0 }}>
          {loading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={workspaceColor} />
            </View>
          ) : error ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontSize: 16, textAlign: 'center', opacity: 0.8 }}>
                {error}
              </Text>
            </View>
          ) : (
            <>
              {/* Features with checkmarks */}
              <View style={{ marginBottom: 16 }}>
                {FEATURES.map((feature, index) => (
                  <View
                    key={feature}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginBottom: index === FEATURES.length - 1 ? 0 : 10,
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: workspaceColor,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 10,
                      }}
                    >
                      <Check size={12} color="#000000" strokeWidth={3} />
                    </View>
                    <Text
                      style={{
                        color: '#FFFFFF',
                        fontSize: 14,
                        fontWeight: index === FEATURES.length - 1 ? '600' : '400',
                        flex: 1,
                      }}
                    >
                      {feature}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Plan Selection */}
              <View style={{ marginTop: 'auto', paddingBottom: 8 }}>
                <View style={{ gap: 10, marginBottom: 16 }}>
                  {/* Yearly Plan - Premium Gold Card */}
                  <TouchableOpacity
                    onPress={() => setSelectedPlan('yearly')}
                    activeOpacity={0.8}
                    style={{
                      borderRadius: 14,
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <LinearGradient
                      colors={
                        selectedPlan === 'yearly'
                          ? ['#D4AF37', '#F5D67B', '#C9A227', '#E8C55B', '#B8960F']
                          : ['#3D3520', '#4A421F', '#3D3520']
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        padding: 14,
                        borderRadius: 14,
                        borderWidth: 2,
                        borderColor: selectedPlan === 'yearly' ? '#F5D67B' : '#5A5030',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Animated Shine Effect */}
                      <Animated.View
                        style={[
                          {
                            position: 'absolute',
                            top: -50,
                            bottom: -50,
                            width: 80,
                            backgroundColor: 'transparent',
                          },
                          shineAnimatedStyle,
                        ]}
                      >
                        <LinearGradient
                          colors={[
                            'transparent',
                            'rgba(255, 255, 255, 0.05)',
                            'rgba(255, 255, 255, 0.3)',
                            'rgba(255, 255, 255, 0.05)',
                            'transparent',
                          ]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={{
                            flex: 1,
                            transform: [{ skewX: '-20deg' }],
                          }}
                        />
                      </Animated.View>

                      {/* Save Badge */}
                      <View
                        style={{
                          position: 'absolute',
                          top: -2,
                          right: 14,
                          backgroundColor: '#1A1A1A',
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: '#D4AF37',
                        }}
                      >
                        <Text style={{ color: '#F5D67B', fontSize: 10, fontWeight: '700' }}>
                          SAVE {savingsPercent}%
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View>
                          <Text style={{ color: selectedPlan === 'yearly' ? '#1A1A1A' : '#D4AF37', fontSize: 15, fontWeight: '700' }}>
                            Yearly
                          </Text>
                          <Text style={{ color: selectedPlan === 'yearly' ? 'rgba(26, 26, 26, 0.7)' : 'rgba(212, 175, 55, 0.7)', fontSize: 12, marginTop: 1 }}>
                            {yearlyMonthlyPrice}/month
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ color: selectedPlan === 'yearly' ? '#1A1A1A' : '#F5D67B', fontSize: 16, fontWeight: '700' }}>
                            {yearlyPrice}
                          </Text>
                          <Text style={{ color: selectedPlan === 'yearly' ? 'rgba(26, 26, 26, 0.6)' : 'rgba(212, 175, 55, 0.6)', fontSize: 11 }}>
                            per year
                          </Text>
                        </View>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Monthly Plan */}
                  <TouchableOpacity
                    onPress={() => setSelectedPlan('monthly')}
                    activeOpacity={0.8}
                    style={{
                      borderWidth: 2,
                      borderColor: selectedPlan === 'monthly' ? workspaceColor : 'rgba(255, 255, 255, 0.2)',
                      borderRadius: 14,
                      padding: 14,
                      backgroundColor: selectedPlan === 'monthly' ? `${workspaceColor}15` : 'transparent',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View>
                        <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '600' }}>
                          Monthly
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
                          {monthlyPrice}
                        </Text>
                        <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 11 }}>
                          per month
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* CTA Button */}
                <TouchableOpacity
                  onPress={handleSubscribe}
                  disabled={purchasing}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: workspaceColor,
                    borderRadius: 28,
                    paddingVertical: 16,
                    alignItems: 'center',
                    shadowColor: workspaceColor,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.4,
                    shadowRadius: 12,
                    elevation: 8,
                  }}
                >
                  {purchasing ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <Text
                      style={{
                        color: '#000000',
                        fontSize: 17,
                        fontWeight: '700',
                        letterSpacing: 0.3,
                      }}
                    >
                      Continue
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Footer Links */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginTop: 10,
                    paddingBottom: 24,
                    gap: 10,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => Linking.openURL('https://www.heyvata.com/terms-conditions')}
                  >
                    <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 11 }}>
                      Terms of Use
                    </Text>
                  </TouchableOpacity>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 11 }}>
                    |
                  </Text>
                  <TouchableOpacity
                    onPress={() => Linking.openURL('https://www.heyvata.com/privacy-policy')}
                  >
                    <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 11 }}>
                      Privacy Policy
                    </Text>
                  </TouchableOpacity>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 11 }}>
                    |
                  </Text>
                  <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 11 }}>
                    Restore
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Bottom Indicator */}
        <View
          style={{
            position: 'absolute',
            bottom: 8,
            left: 0,
            right: 0,
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: 134,
              height: 5,
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              borderRadius: 3,
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
