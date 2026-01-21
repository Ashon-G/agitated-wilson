/**
 * Firebase Cloud Function: Spotify Conversions API
 *
 * Server-to-server integration to send conversion events to Spotify Ads.
 * This enables tracking of purchases, signups, and other conversion events
 * for Spotify ad campaign optimization.
 *
 * API Reference: https://capi.spotify.com/capi-direct/events/
 * Docs: https://stape.io/helpdesk/documentation/spotify-tag
 */

import { onRequest, onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

// Spotify Conversions API Configuration
const SPOTIFY_CAPI_ENDPOINT = 'https://capi.spotify.com/capi-direct/events/';
const SPOTIFY_AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3Njg2OTI5NDEsImp0aSI6IjU4MDQzZDdkLWMyNTktNDk3ZS05NzIzLTUyMTMxY2ZmNzgzNSJ9.1z7lLtsl1McMx9a2gGkcqQvOHFsOc8W0e6obSr4Fw74';
const SPOTIFY_CONNECTION_ID = '9eb0bb5f-f338-46a1-91d5-ffc8f3efb38e';

/**
 * Supported Spotify event types
 */
export type SpotifyEventType =
  | 'PageView'
  | 'CompleteRegistration'
  | 'AddToCart'
  | 'Checkout'
  | 'Purchase'
  | 'Search'
  | 'Lead'
  | 'Subscribe';

/**
 * Action source - where the event originated
 */
export type ActionSource = 'web' | 'app' | 'offline';

/**
 * Event details for conversion tracking
 */
interface SpotifyEventDetails {
  value?: number;
  currency?: string;
  content_name?: string;
  content_category?: string;
  content_ids?: string[];
  num_items?: number;
  [key: string]: unknown;
}

/**
 * User data for matching (emails/phones will be SHA256 hashed)
 */
interface SpotifyUserData {
  email?: string;
  phone?: string;
  ip_address?: string;
  device_id?: string;
  user_agent?: string;
}

/**
 * Request payload for sending conversion events
 */
interface SendConversionRequest {
  event_name: SpotifyEventType;
  event_id?: string;
  event_time?: string;
  action_source?: ActionSource;
  opt_out_targeting?: boolean;
  event_source_url?: string;
  event_details?: SpotifyEventDetails;
  user_data: SpotifyUserData;
}

/**
 * Internal event structure for Spotify API
 */
interface SpotifyEvent {
  event_name: string;
  event_id: string;
  event_time: string;
  action_source: string;
  opt_out_targeting: boolean;
  event_source_url?: string;
  event_details?: SpotifyEventDetails;
  user_data: {
    hashed_emails?: string[];
    hashed_phone_number?: string[];
    ip_address?: string;
    device_id?: string;
  };
}

/**
 * Spotify API request body structure
 */
interface SpotifyApiPayload {
  conversion_events: {
    capi_connection_id: string;
    events: SpotifyEvent[];
  };
}

/**
 * SHA256 hash a value for privacy-safe matching
 */
function hashValue(value: string): string {
  return crypto
    .createHash('sha256')
    .update(value.toLowerCase().trim())
    .digest('hex');
}

/**
 * Generate a unique event ID
 */
function generateEventId(): string {
  return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Map event name to Spotify format
 */
function mapEventName(eventName: SpotifyEventType): string {
  const eventMap: Record<SpotifyEventType, string> = {
    PageView: 'page_view',
    CompleteRegistration: 'complete_registration',
    AddToCart: 'add_to_cart',
    Checkout: 'checkout',
    Purchase: 'purchase',
    Search: 'search',
    Lead: 'lead',
    Subscribe: 'subscribe',
  };
  return eventMap[eventName] || eventName.toLowerCase();
}

/**
 * Build the Spotify API payload
 */
function buildSpotifyPayload(request: SendConversionRequest): SpotifyApiPayload {
  const userData: SpotifyEvent['user_data'] = {};

  // Hash email if provided
  if (request.user_data.email) {
    userData.hashed_emails = [hashValue(request.user_data.email)];
  }

  // Hash phone if provided
  if (request.user_data.phone) {
    userData.hashed_phone_number = [hashValue(request.user_data.phone)];
  }

  // Pass through IP address and device ID
  if (request.user_data.ip_address) {
    userData.ip_address = request.user_data.ip_address;
  }

  if (request.user_data.device_id) {
    userData.device_id = request.user_data.device_id;
  }

  const event: SpotifyEvent = {
    event_name: mapEventName(request.event_name),
    event_id: request.event_id || generateEventId(),
    event_time: request.event_time || new Date().toISOString(),
    action_source: request.action_source || 'app',
    opt_out_targeting: request.opt_out_targeting ?? false,
    user_data: userData,
  };

  // Add optional fields
  if (request.event_source_url) {
    event.event_source_url = request.event_source_url;
  }

  if (request.event_details) {
    event.event_details = request.event_details;
  }

  return {
    conversion_events: {
      capi_connection_id: SPOTIFY_CONNECTION_ID,
      events: [event],
    },
  };
}

/**
 * Send conversion event to Spotify
 */
async function sendToSpotify(payload: SpotifyApiPayload): Promise<{
  success: boolean;
  statusCode?: number;
  response?: unknown;
  error?: string;
}> {
  try {
    console.log('📤 Sending event to Spotify:', JSON.stringify(payload, null, 2));

    const response = await fetch(SPOTIFY_CAPI_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SPOTIFY_AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    let responseData: unknown;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    if (response.ok) {
      console.log('✅ Spotify conversion event sent successfully:', response.status);
      return {
        success: true,
        statusCode: response.status,
        response: responseData,
      };
    } else {
      console.error('❌ Spotify API error:', response.status, responseData);
      return {
        success: false,
        statusCode: response.status,
        response: responseData,
        error: `Spotify API returned ${response.status}`,
      };
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error sending to Spotify:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * HTTP endpoint to send conversion events to Spotify
 *
 * Use this endpoint from your app or other services to track conversions.
 *
 * Example request:
 * POST /sendSpotifyConversion
 * {
 *   "event_name": "Purchase",
 *   "user_data": {
 *     "email": "user@example.com"
 *   },
 *   "event_details": {
 *     "value": 9.99,
 *     "currency": "USD",
 *     "content_name": "Premium Subscription"
 *   }
 * }
 */
export const sendSpotifyConversion = onRequest(async (req, res) => {
  // Validate request method
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  try {
    const request = req.body as SendConversionRequest;

    // Validate required fields
    if (!request.event_name) {
      res.status(400).json({ error: 'Missing required field: event_name' });
      return;
    }

    if (!request.user_data) {
      res.status(400).json({ error: 'Missing required field: user_data' });
      return;
    }

    // At least one user identifier is required
    const { email, phone, ip_address, device_id } = request.user_data;
    if (!email && !phone && !ip_address && !device_id) {
      res.status(400).json({
        error: 'At least one user identifier required: email, phone, ip_address, or device_id',
      });
      return;
    }

    console.log('🎵 Sending Spotify conversion event:', {
      event_name: request.event_name,
      hasEmail: !!email,
      hasPhone: !!phone,
      hasIp: !!ip_address,
      hasDeviceId: !!device_id,
    });

    // Build and send the payload
    const payload = buildSpotifyPayload(request);
    const result = await sendToSpotify(payload);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Conversion event sent to Spotify',
        event_id: payload.conversion_events.events[0].event_id,
        statusCode: result.statusCode,
      });
    } else {
      res.status(result.statusCode || 500).json({
        success: false,
        error: result.error,
        response: result.response,
      });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error processing Spotify conversion:', errorMessage);
    res.status(500).json({
      error: 'Failed to send conversion event',
      details: errorMessage,
    });
  }
});

/**
 * RevenueCat Webhook endpoint for receiving purchase events
 *
 * RevenueCat sends webhook events when purchases occur. This endpoint
 * receives those events and forwards conversion data to Spotify.
 *
 * Set this URL in RevenueCat Dashboard → Project Settings → Integrations → Webhooks
 * URL: https://[YOUR-PROJECT].cloudfunctions.net/revenueCatWebhook
 *
 * RevenueCat Event Types:
 * - INITIAL_PURCHASE: First time purchase
 * - RENEWAL: Subscription renewal
 * - CANCELLATION: Subscription cancelled
 * - UNCANCELLATION: Subscription reactivated
 * - NON_RENEWING_PURCHASE: One-time purchase
 * - SUBSCRIPTION_PAUSED: Subscription paused
 * - EXPIRATION: Subscription expired
 * - BILLING_ISSUE: Billing problem detected
 * - PRODUCT_CHANGE: User changed product/tier
 */
interface RevenueCatWebhookEvent {
  api_version: string;
  event: {
    type: string;
    app_id: string;
    event_timestamp_ms: number;
    id: string;
    subscriber_attributes?: {
      $email?: { value: string };
      $phoneNumber?: { value: string };
      [key: string]: { value: string } | undefined;
    };
    app_user_id: string;
    original_app_user_id: string;
    aliases: string[];
    product_id: string;
    entitlement_ids?: string[];
    price?: number;
    currency?: string;
    price_in_purchased_currency?: number;
    store: string;
    environment: string;
    purchased_at_ms?: number;
    expiration_at_ms?: number;
    period_type?: string;
    takehome_percentage?: number;
  };
}

export const revenueCatWebhook = onRequest(async (req, res) => {
  // Validate request method
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  try {
    const { event } = req.body as RevenueCatWebhookEvent;

    console.log('🎵 RevenueCat webhook received:', {
      type: event.type,
      app_user_id: event.app_user_id,
      product_id: event.product_id,
      environment: event.environment,
    });

    // Only track purchase events for Spotify conversions
    const purchaseEventTypes = [
      'INITIAL_PURCHASE',
      'RENEWAL',
      'NON_RENEWING_PURCHASE',
    ];

    if (!purchaseEventTypes.includes(event.type)) {
      console.log('ℹ️ Skipping non-purchase event:', event.type);
      res.status(200).json({ success: true, skipped: true, reason: 'Not a purchase event' });
      return;
    }

    // Skip sandbox/test events in production (optional - remove if you want to track test events)
    if (event.environment === 'SANDBOX') {
      console.log('ℹ️ Sandbox event - tracking for testing');
    }

    // Get user email from subscriber attributes or fetch from Firestore
    let userEmail = event.subscriber_attributes?.$email?.value;

    if (!userEmail) {
      // Try to get email from Firestore user document
      const userId = event.app_user_id;
      const userDoc = await admin.firestore().collection('users').doc(userId).get();
      const userData = userDoc.data();
      userEmail = userData?.email;
    }

    if (!userEmail) {
      console.log('⚠️ No email found for user, skipping Spotify conversion');
      res.status(200).json({
        success: false,
        skipped: true,
        reason: 'No email available for matching',
      });
      return;
    }

    // Build and send Spotify conversion
    const payload = buildSpotifyPayload({
      event_name: 'Purchase',
      action_source: 'app',
      event_time: new Date(event.event_timestamp_ms).toISOString(),
      user_data: {
        email: userEmail,
        phone: event.subscriber_attributes?.$phoneNumber?.value,
      },
      event_details: {
        value: event.price_in_purchased_currency || event.price || 0,
        currency: event.currency || 'USD',
        content_name: event.product_id,
        content_category: 'subscription',
        content_ids: event.entitlement_ids,
      },
    });

    const result = await sendToSpotify(payload);

    // Log the conversion in Firestore
    await admin.firestore().collection('spotify_conversions').add({
      userId: event.app_user_id,
      revenueCatEventId: event.id,
      revenueCatEventType: event.type,
      productId: event.product_id,
      event_name: 'purchase',
      event_id: payload.conversion_events.events[0].event_id,
      sent_at: admin.firestore.FieldValue.serverTimestamp(),
      success: result.success,
      statusCode: result.statusCode,
      error: result.error,
      environment: event.environment,
    });

    if (result.success) {
      console.log('✅ Spotify Purchase conversion sent for RevenueCat event:', event.id);
      res.status(200).json({
        success: true,
        event_id: payload.conversion_events.events[0].event_id,
      });
    } else {
      console.error('❌ Failed to send Spotify conversion:', result.error);
      res.status(200).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error processing RevenueCat webhook:', errorMessage);
    res.status(500).json({
      error: 'Failed to process webhook',
      details: errorMessage,
    });
  }
});

/**
 * Firestore trigger: Send CompleteRegistration event when a new user is created
 */
export const onUserCreated = onDocumentCreated('users/{userId}', async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    console.log('No data associated with the event');
    return;
  }

  const { userId } = event.params;
  const userData = snapshot.data();

  console.log('👤 New user created:', userId);

  if (!userData?.email) {
    console.log('⚠️ No email found for new user, skipping Spotify conversion');
    return;
  }

  try {
    const payload = buildSpotifyPayload({
      event_name: 'CompleteRegistration',
      action_source: 'app',
      user_data: {
        email: userData.email,
      },
    });

    const result = await sendToSpotify(payload);

    if (result.success) {
      console.log('✅ Spotify CompleteRegistration conversion sent for user:', userId);

      await admin.firestore().collection('spotify_conversions').add({
        userId,
        event_name: 'complete_registration',
        event_id: payload.conversion_events.events[0].event_id,
        sent_at: admin.firestore.FieldValue.serverTimestamp(),
        success: true,
        statusCode: result.statusCode,
      });
    } else {
      console.error('❌ Failed to send Spotify registration conversion:', result.error);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error sending registration conversion to Spotify:', errorMessage);
  }
});

/**
 * Callable function request interface
 */
interface TrackConversionRequest {
  event_name?: SpotifyEventType;
  action_source?: ActionSource;
  opt_out_targeting?: boolean;
  event_details?: SpotifyEventDetails;
}

/**
 * Callable function for sending custom conversion events from the app
 *
 * Use this from React Native:
 * const sendConversion = httpsCallable(functions, 'trackSpotifyConversion');
 * await sendConversion({
 *   event_name: 'Lead',
 *   event_details: { content_name: 'Premium Interest' }
 * });
 */
export const trackSpotifyConversion = onCall(
  async (request: CallableRequest<TrackConversionRequest>) => {
    // Require authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const userId = request.auth.uid;
    const { data } = request;

    // Get user email for matching
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData?.email) {
      console.log('⚠️ No email found for user:', userId);
      return {
        success: false,
        error: 'No email associated with user account',
      };
    }

    const conversionRequest: SendConversionRequest = {
      event_name: data.event_name || 'Lead',
      action_source: data.action_source || 'app',
      opt_out_targeting: data.opt_out_targeting ?? false,
      user_data: {
        email: userData.email,
      },
      event_details: data.event_details,
    };

    console.log('📱 App-triggered Spotify conversion:', {
      userId,
      event_name: conversionRequest.event_name,
    });

    const payload = buildSpotifyPayload(conversionRequest);
    const result = await sendToSpotify(payload);

    // Log the conversion
    await admin.firestore().collection('spotify_conversions').add({
      userId,
      event_name: conversionRequest.event_name.toLowerCase(),
      event_id: payload.conversion_events.events[0].event_id,
      sent_at: admin.firestore.FieldValue.serverTimestamp(),
      success: result.success,
      statusCode: result.statusCode,
      error: result.error,
    });

    return {
      success: result.success,
      event_id: payload.conversion_events.events[0].event_id,
      error: result.error,
    };
  },
);
