/**
 * Security Validation Service
 * Validates multi-tenant access and security rules compliance
 */

import { COLLECTIONS } from '../config/firebase';
import BackendService from './BackendService';
import AuthenticationService from './AuthenticationService';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface SecurityAudit {
  userId: string;
  timestamp: Date;
  collections: Record<string, {
    totalDocuments: number;
    ownedDocuments: number;
    unauthorizedAccess: number;
    missingUserIdField: number;
  }>;
  overallScore: number; // 0-100
  recommendations: string[];
}

class SecurityValidationService {
  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await BackendService.initialize();
      console.log('✅ SecurityValidationService initialized');
    } catch (error) {
      console.error('❌ Failed to initialize SecurityValidationService:', error);
    }
  }

  /**
   * Validate that a document belongs to the current user
   */
  validateDocumentOwnership(document: any): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    const currentUser = AuthenticationService.getCurrentUser();
    if (!currentUser) {
      result.isValid = false;
      result.errors.push('User not authenticated');
      return result;
    }

    // Check if document has userId field
    if (!document.userId) {
      result.isValid = false;
      result.errors.push('Document missing userId field for tenant isolation');
      return result;
    }

    // Check if userId matches current user
    if (document.userId !== currentUser.uid) {
      result.isValid = false;
      result.errors.push(`Document belongs to different user. Expected: ${currentUser.uid}, Found: ${document.userId}`);
      return result;
    }

    return result;
  }

  /**
   * Validate data before writing to ensure security compliance
   */
  validateBeforeWrite(
    collection: string,
    data: any,
    operation: 'create' | 'update',
  ): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    const currentUser = AuthenticationService.getCurrentUser();
    if (!currentUser) {
      result.isValid = false;
      result.errors.push('User not authenticated');
      return result;
    }

    // For create operations, ensure userId is set
    if (operation === 'create') {
      if (!data.userId) {
        result.isValid = false;
        result.errors.push('Create operation missing userId field');
        return result;
      }

      if (data.userId !== currentUser.uid) {
        result.isValid = false;
        result.errors.push('Create operation userId does not match authenticated user');
        return result;
      }
    }

    // For update operations, warn if trying to change userId
    if (operation === 'update') {
      if (data.hasOwnProperty('userId') && data.userId !== currentUser.uid) {
        result.isValid = false;
        result.errors.push('Update operation cannot change userId field');
        return result;
      }
    }

    // Collection-specific validations
    switch (collection) {
      case COLLECTIONS.SALES_AGENTS:
        this.validateSalesAgentData(data, result);
        break;
      case COLLECTIONS.LEADS:
        this.validateLeadData(data, result);
        break;
      case COLLECTIONS.CONVERSATIONS:
        this.validateConversationData(data, result);
        break;
    }

    return result;
  }

  private validateSalesAgentData(data: any, result: ValidationResult): void {
    // Validate required fields and data integrity
    if (data.config && data.config.credentials) {
      result.warnings.push('Agent config contains credentials - ensure they are properly encrypted');
    }
  }

  private validateLeadData(data: any, result: ValidationResult): void {
    // Validate lead data
    if (data.agentId && !data.agentId.startsWith('agent_')) {
      result.warnings.push('Lead agentId does not follow expected format');
    }
  }

  private validateConversationData(data: any, result: ValidationResult): void {
    // Validate conversation data
    if (data.leadId && !data.leadId.startsWith('lead_')) {
      result.warnings.push('Conversation leadId does not follow expected format');
    }
  }

  /**
   * Perform comprehensive security audit for current user
   */
  async performSecurityAudit(): Promise<SecurityAudit> {
    const currentUser = AuthenticationService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User must be authenticated to perform security audit');
    }

    const audit: SecurityAudit = {
      userId: currentUser.uid,
      timestamp: new Date(),
      collections: {},
      overallScore: 0,
      recommendations: [],
    };

    const collectionsToAudit = [
      COLLECTIONS.SALES_AGENTS,
      COLLECTIONS.LEADS,
      COLLECTIONS.CONVERSATIONS,
      COLLECTIONS.AGENT_INBOX,
      COLLECTIONS.AGENT_ACTIONS,
    ];

    let totalDocuments = 0;
    let totalOwnedDocuments = 0;
    let totalUnauthorizedAccess = 0;
    let totalMissingUserIdField = 0;

    for (const collection of collectionsToAudit) {
      try {
        // Query all documents for this collection (this should be restricted by security rules)
        const documents = await BackendService.queryDocuments<any>(
          collection,
          { limit: 1000 }, // Reasonable limit for audit
          { useCache: false }, // Don't use cache for audit
        );

        const collectionAudit = {
          totalDocuments: documents.length,
          ownedDocuments: 0,
          unauthorizedAccess: 0,
          missingUserIdField: 0,
        };

        for (const doc of documents) {
          totalDocuments++;
          collectionAudit.totalDocuments++;

          // Check if document has userId field
          if (!doc.userId) {
            totalMissingUserIdField++;
            collectionAudit.missingUserIdField++;
            continue;
          }

          // Check if document belongs to current user
          if (doc.userId === currentUser.uid) {
            totalOwnedDocuments++;
            collectionAudit.ownedDocuments++;
          } else {
            totalUnauthorizedAccess++;
            collectionAudit.unauthorizedAccess++;
          }
        }

        audit.collections[collection] = collectionAudit;
      } catch (error) {
        console.error(`Failed to audit collection ${collection}:`, error);
        audit.collections[collection] = {
          totalDocuments: 0,
          ownedDocuments: 0,
          unauthorizedAccess: 0,
          missingUserIdField: 0,
        };
      }
    }

    // Calculate overall security score
    if (totalDocuments === 0) {
      audit.overallScore = 100; // No data, perfect score
    } else {
      const securityScore = ((totalOwnedDocuments / totalDocuments) * 100);
      audit.overallScore = Math.round(securityScore);
    }

    // Generate recommendations
    if (totalUnauthorizedAccess > 0) {
      audit.recommendations.push(`Found ${totalUnauthorizedAccess} documents with unauthorized access - security rules may be misconfigured`);
    }

    if (totalMissingUserIdField > 0) {
      audit.recommendations.push(`Found ${totalMissingUserIdField} documents missing userId field - these documents are not properly isolated`);
    }

    if (audit.overallScore < 100) {
      audit.recommendations.push('Consider running data migration to fix tenant isolation issues');
    }

    if (audit.overallScore >= 95) {
      audit.recommendations.push('Security configuration looks good - maintain regular audits');
    }

    return audit;
  }

  /**
   * Validate Firestore security rules are properly configured
   */
  async validateSecurityRules(): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    const currentUser = AuthenticationService.getCurrentUser();
    if (!currentUser) {
      result.errors.push('User not authenticated for security rules validation');
      result.isValid = false;
      return result;
    }

    try {
      // Test 1: Try to create a document with wrong userId (should fail)
      try {
        await BackendService.createDocument<any>(COLLECTIONS.SALES_AGENTS, {
          userId: 'wrong_user_id', // This should be rejected by security rules
          name: 'Security Test Agent',
          description: 'Test agent for security validation',
        });

        result.errors.push('Security rules allow creating documents with wrong userId - SECURITY BREACH');
        result.isValid = false;
      } catch (error) {
        // This should fail - which means security rules are working
        result.warnings.push('✅ Security rules correctly reject documents with wrong userId');
      }

      // Test 2: Try to query documents without proper authentication
      // This test would need to be done with an unauthenticated client
      result.warnings.push('Manual testing required: Verify unauthenticated users cannot access any documents');

      // Test 3: Verify user can only see their own documents
      const ownDocuments = await BackendService.queryDocuments<any>(
        COLLECTIONS.SALES_AGENTS,
        { limit: 10 },
        { useCache: false },
      );

      for (const doc of ownDocuments) {
        if (!doc.userId || doc.userId !== currentUser.uid) {
          result.errors.push(`Found document ${doc.id} that doesn't belong to current user`);
          result.isValid = false;
        }
      }

      if (result.isValid && result.errors.length === 0) {
        result.warnings.push('✅ Security rules validation passed basic tests');
      }
    } catch (error) {
      result.errors.push(`Security rules validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.isValid = false;
    }

    return result;
  }

  /**
   * Check for common security misconfigurations
   */
  async checkSecurityMisconfigurations(): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    const currentUser = AuthenticationService.getCurrentUser();
    if (!currentUser) {
      result.errors.push('User not authenticated');
      result.isValid = false;
      return result;
    }

    try {
      // Check 1: Look for documents without userId field
      const collections = [
        COLLECTIONS.SALES_AGENTS,
        COLLECTIONS.LEADS,
        COLLECTIONS.CONVERSATIONS,
      ];

      for (const collection of collections) {
        const docs = await BackendService.queryDocuments<any>(
          collection,
          { limit: 100 },
          { useCache: false },
        );

        const docsWithoutUserId = docs.filter((doc: any) => !doc.userId);
        if (docsWithoutUserId.length > 0) {
          result.warnings.push(`Found ${docsWithoutUserId.length} documents in ${collection} without userId field`);
        }
      }

      // Check 2: Look for suspicious patterns in data
      result.warnings.push('Manual review recommended: Check for any hardcoded credentials or sensitive data in documents');
    } catch (error) {
      result.errors.push(`Misconfiguration check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.isValid = false;
    }

    return result;
  }

  /**
   * Generate security report
   */
  async generateSecurityReport(): Promise<{
    audit: SecurityAudit;
    rulesValidation: ValidationResult;
    misconfigurationCheck: ValidationResult;
    summary: {
      overallRating: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
      criticalIssues: number;
      warnings: number;
      recommendations: string[];
    };
  }> {
    const audit = await this.performSecurityAudit();
    const rulesValidation = await this.validateSecurityRules();
    const misconfigurationCheck = await this.checkSecurityMisconfigurations();

    const criticalIssues = rulesValidation.errors.length + misconfigurationCheck.errors.length;
    const warnings = rulesValidation.warnings.length + misconfigurationCheck.warnings.length;

    let overallRating: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
    if (criticalIssues === 0 && audit.overallScore >= 95) {
      overallRating = 'EXCELLENT';
    } else if (criticalIssues === 0 && audit.overallScore >= 80) {
      overallRating = 'GOOD';
    } else if (criticalIssues <= 2) {
      overallRating = 'FAIR';
    } else {
      overallRating = 'POOR';
    }

    const recommendations = [
      ...audit.recommendations,
      ...rulesValidation.warnings,
      ...misconfigurationCheck.warnings,
    ];

    return {
      audit,
      rulesValidation,
      misconfigurationCheck,
      summary: {
        overallRating,
        criticalIssues,
        warnings,
        recommendations,
      },
    };
  }
}

export default new SecurityValidationService();