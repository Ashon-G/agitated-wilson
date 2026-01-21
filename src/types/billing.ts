/**
 * Billing System Type Definitions
 * Types for usage-based billing, invoice management, and payment tracking
 */

export type QualificationType = 'interest_expressed' | 'target_match' | 'link_clicked';
export type BillingStatus = 'unbilled' | 'billed' | 'invoiced' | 'paid';
export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'overdue' | 'void';
export type BillingCycleStatus = 'active' | 'finalized' | 'invoiced';

/**
 * Qualified Lead Event - Records when a lead meets billing criteria
 */
export interface QualifiedLeadEvent {
  id: string;
  userId: string;
  leadId: string;
  agentId: string;
  qualifiedAt: Date;
  qualificationType: QualificationType;
  billingStatus: BillingStatus;
  invoiceId?: string;
  stripeLineItemId?: string;
  billingCycleId?: string;

  // Lead details for invoice line item description
  leadName?: string;
  leadContext?: string;
  platform: string;

  // Metadata
  metadata: {
    postTitle?: string;
    subreddit?: string;
    qualificationScore?: number;
    conversationId?: string;
    linkUrl?: string;
  };

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Billing Cycle - Monthly billing period
 */
export interface BillingCycle {
  id: string;
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  status: BillingCycleStatus;

  // Counts and amounts
  qualifiedLeadsCount: number;
  totalAmount: number; // In cents (e.g., 500 = $5.00)

  // Breakdown by qualification type
  breakdown: {
    interestExpressed: number;
    targetMatch: number;
    linkClicked: number;
  };

  // Invoice reference
  invoiceId?: string;
  invoicedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
  finalizedAt?: Date;
}

/**
 * Invoice - Extends Stripe invoice data with app context
 */
export interface Invoice {
  id: string;
  userId: string;

  // Stripe references
  stripeInvoiceId: string;
  stripeCustomerId: string;

  // Billing context
  billingCycleId: string;
  amount: number; // In cents
  qualifiedLeadsCount: number;

  // Status and dates
  status: InvoiceStatus;
  dueDate: Date;
  paidAt?: Date;
  sentAt?: Date;

  // URLs
  hostedInvoiceUrl?: string;
  invoicePdfUrl?: string;

  // Payment details
  paymentIntentId?: string;
  paymentMethodType?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  voidedAt?: Date;
}

/**
 * Payment Status - User's current payment state
 */
export interface PaymentStatus {
  userId: string;
  stripeCustomerId?: string;

  // Outstanding invoice tracking
  hasOutstandingInvoice: boolean;
  oldestOverdueInvoiceId?: string;
  daysPastDue: number;
  totalAmountDue: number; // In cents

  // Agent suspension state
  agentSuspended: boolean;
  suspendedAt?: Date;
  suspensionReason?: string;

  // Payment history
  totalPaid: number; // Lifetime total in cents
  invoicesPaid: number;
  invoicesOverdue: number;

  // Timestamps
  lastCheckedAt: Date;
  lastPaymentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Link Click Event - Tracks clicks on agent-shared links
 */
export interface LinkClickEvent {
  id: string;
  leadId: string;
  userId: string;
  agentId: string;

  // Click details
  url: string; // Original URL
  trackingUrl: string; // Generated tracking URL
  clickedAt: Date;

  // Request metadata
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;

  // Billing
  tracked: boolean; // Whether this click counted toward billing
  qualifiedLeadEventId?: string;

  createdAt: Date;
}

/**
 * Billing Configuration - System-wide billing settings
 */
export interface BillingConfig {
  pricePerQualifiedLead: number; // In cents (default: 500 = $5.00)
  paymentTermsDays: number; // Net terms (default: 5)
  gracePeriodDays: number; // Days before suspension (default: 0)
  currency: string; // Default: 'usd'
  taxRate?: number; // Optional tax percentage

  // Feature flags
  enableAutomaticSuspension: boolean;
  enableEmailNotifications: boolean;
  enableLinkTracking: boolean;
}

/**
 * Billing Summary - User dashboard summary
 */
export interface BillingSummary {
  userId: string;
  currentCycle: {
    periodStart: Date;
    periodEnd: Date;
    qualifiedLeadsCount: number;
    projectedAmount: number;
    breakdown: {
      interestExpressed: number;
      targetMatch: number;
      linkClicked: number;
    };
  };

  paymentStatus: {
    hasPendingInvoice: boolean;
    isOverdue: boolean;
    daysPastDue: number;
    amountDue: number;
    agentActive: boolean;
  };

  lifetime: {
    totalQualifiedLeads: number;
    totalSpent: number;
    averageLeadsPerMonth: number;
    memberSince: Date;
  };
}

/**
 * Invoice Line Item - Detailed breakdown for invoice
 */
export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  qualifiedLeadEventId: string;

  description: string; // e.g., "Qualified Lead - John Doe (r/entrepreneur)"
  amount: number; // In cents
  quantity: number; // Always 1 for leads

  // Lead context
  leadName?: string;
  platform: string;
  qualificationType: QualificationType;
  qualifiedAt: Date;

  metadata: Record<string, any>;
}

/**
 * Payment Required Exception - Custom error for suspended agents
 */
/**
 * Payment Required Exception
 * Custom error for payment requirement failures
 *
 * Note: Using factory function instead of class extends Error
 * to avoid Hermes runtime issues with Error subclassing
 */
export interface PaymentRequiredError extends Error {
  userId: string;
  invoiceUrl?: string;
  amountDue: number;
  daysPastDue: number;
  isPaymentRequiredException: true;
}

export function PaymentRequiredException(
  message: string,
  userId: string,
  amountDue: number,
  daysPastDue: number,
  invoiceUrl?: string,
): PaymentRequiredError {
  const error = new Error(message) as PaymentRequiredError;
  error.name = 'PaymentRequiredException';
  error.userId = userId;
  error.amountDue = amountDue;
  error.daysPastDue = daysPastDue;
  error.invoiceUrl = invoiceUrl;
  error.isPaymentRequiredException = true;

  // Maintains proper stack trace for where our error was thrown
  if (Error.captureStackTrace) {
    Error.captureStackTrace(error, PaymentRequiredException);
  }

  return error;
}

// Type guard for checking if error is PaymentRequiredException
export function isPaymentRequiredException(error: any): error is PaymentRequiredError {
  return error?.isPaymentRequiredException === true;
}

/**
 * Billing Event - For real-time updates and audit log
 */
export interface BillingEvent {
  id: string;
  userId: string;
  type: 'lead_qualified' | 'cycle_finalized' | 'invoice_generated' | 'invoice_paid' |
        'invoice_overdue' | 'agent_suspended' | 'agent_resumed' | 'link_clicked';

  // Event data
  data: {
    leadId?: string;
    invoiceId?: string;
    billingCycleId?: string;
    amount?: number;
    qualificationType?: QualificationType;
    [key: string]: any;
  };

  timestamp: Date;
  metadata?: Record<string, any>;
}
