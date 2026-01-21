/**
 * Integration Types
 * Type definitions for third-party CRM integrations
 */

export type IntegrationType = 'hubspot' | 'salesforce' | 'pipedrive';

export interface Integration {
  id: string;
  userId: string;
  type: IntegrationType;
  name: string;
  enabled: boolean;
  connectedAt: Date;
  lastSyncAt?: Date;
  syncStatus: 'active' | 'error' | 'paused' | 'syncing';
  errorMessage?: string;
  settings: IntegrationSettings;
}

export interface IntegrationSettings {
  syncFrequency: 'realtime' | 'hourly' | 'daily' | 'manual';
  learnFrom: {
    closedDeals: boolean;
    contactNotes: boolean;
    engagementHistory: boolean;
    dealStages: boolean;
  };
  syncBack: {
    newLeads: boolean;
    agentActivity: boolean;
    leadScores: boolean;
    statusUpdates: boolean;
  };
  filters: {
    minDealValue?: number;
    dealDaysBack?: number;
    specificStages?: string[];
  };
}

// HubSpot specific types
export interface HubSpotIntegration extends Integration {
  type: 'hubspot';
  accessToken: string; // Encrypted in storage
  refreshToken: string; // Encrypted in storage
  expiresAt: Date;
  portalId: string;
  hubDomain?: string;
}

export interface HubSpotContact {
  id: string;
  email?: string;
  firstname?: string;
  lastname?: string;
  company?: string;
  jobtitle?: string;
  lifecyclestage?: string;
  hs_lead_status?: string;
  createdate?: string;
  lastmodifieddate?: string;
  properties: Record<string, any>;
}

export interface HubSpotDeal {
  id: string;
  dealname: string;
  dealstage: string;
  amount?: number;
  closedate?: string;
  pipeline?: string;
  createdate?: string;
  properties: Record<string, any>;
}

export interface HubSpotEngagement {
  id: string;
  type: 'NOTE' | 'EMAIL' | 'CALL' | 'MEETING' | 'TASK';
  timestamp: Date;
  body?: string;
  subject?: string;
  associations?: {
    contactIds?: string[];
    dealIds?: string[];
  };
}

export interface HubSpotInsights {
  totalContacts: number;
  totalDeals: number;
  closedWonDeals: number;
  avgDealSize: number;
  topIndustries: string[];
  topJobTitles: string[];
  avgTimeToClose: number;
  engagementRate: number;
  lastUpdated: Date;
}

export interface HubSpotCustomProperty {
  name: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'enumeration' | 'bool';
  fieldType: 'text' | 'textarea' | 'number' | 'select' | 'checkbox';
  groupName: string;
  description?: string;
  options?: Array<{ label: string; value: string }>;
}

export interface IntegrationSyncStats {
  contactsCreated: number;
  contactsUpdated: number;
  engagementsSynced: number;
  dealsCreated: number;
  insightsPulled: number;
  lastSyncDuration: number; // milliseconds
  failedSyncs: number;
}

export interface ICPProfile {
  jobTitles: Array<{ title: string; frequency: number }>;
  industries: Array<{ industry: string; frequency: number }>;
  companySizes: Array<{ size: string; frequency: number }>;
  technologies: Array<{ tech: string; frequency: number }>;
  avgDealSize: number;
  avgTimeToClose: number;
  commonTraits: string[];
  updatedAt: Date;
}

export interface EngagementPattern {
  messageType: string;
  topic: string;
  responseRate: number;
  avgTimeToResponse: number;
  conversionRate: number;
  examples: string[];
  updatedAt: Date;
}
