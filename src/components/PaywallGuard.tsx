/**
 * PaywallGuard Component
 *
 * Enforces subscription requirements by showing a non-dismissible paywall
 * to users who haven't subscribed after completing onboarding.
 *
 * This component wraps the main app and automatically displays the paywall
 * when the user first enters the app after onboarding if they don't have
 * an active subscription.
 */

import React, { useEffect, useState } from 'react';
import PaywallModal from './PaywallModal';
import useSubscriptionStore from '../state/subscriptionStore';
import { isRevenueCatEnabled } from '../lib/revenuecatClient';

interface PaywallGuardProps {
  children: React.ReactNode;
}

export default function PaywallGuard({ children }: PaywallGuardProps) {
  const [showPaywall, setShowPaywall] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  const isPremium = useSubscriptionStore((s) => s.isPremium);
  const isLoading = useSubscriptionStore((s) => s.isLoading);
  const refreshSubscriptionStatus = useSubscriptionStore(
    (s) => s.refreshSubscriptionStatus,
  );

  // Check subscription status when component mounts
  useEffect(() => {
    const checkSubscription = async () => {
      if (!isRevenueCatEnabled()) {
        // RevenueCat not configured - don't show paywall
        setHasChecked(true);
        return;
      }

      await refreshSubscriptionStatus();
      setHasChecked(true);
    };

    checkSubscription();
  }, [refreshSubscriptionStatus]);

  // Show paywall after checking if user doesn't have premium
  useEffect(() => {
    if (hasChecked && !isLoading && !isPremium && isRevenueCatEnabled()) {
      setShowPaywall(true);
    } else if (isPremium) {
      setShowPaywall(false);
    }
  }, [hasChecked, isLoading, isPremium]);

  const handlePaywallSuccess = async () => {
    // User subscribed successfully - refresh status and hide paywall
    await refreshSubscriptionStatus();
    setShowPaywall(false);
  };

  return (
    <>
      {children}
      <PaywallModal
        visible={showPaywall}
        canDismiss={false}
        onSuccess={handlePaywallSuccess}
      />
    </>
  );
}
