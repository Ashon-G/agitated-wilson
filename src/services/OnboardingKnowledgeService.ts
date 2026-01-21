/**
 * Onboarding Knowledge Service
 * Handles processing and storage of knowledge collected during onboarding
 */

import { FileUpload } from '../types/knowledge';
import { PricingStructure, FAQPair, ObjectionResponse, ContactDetails } from '../types/app';
import KnowledgeBaseService from './KnowledgeBaseService';
import FileProcessingService from './FileProcessingService';
import BackendService from './BackendService';
import AuthenticationService from './AuthenticationService';
import { KnowledgeItem } from '../types/app';
import { auth } from '../config/firebase';

/**
 * Helper function to ensure Firebase auth is ready with a valid token
 * This prevents permission errors when Firebase auth context isn't fully established
 */
const ensureAuthReady = async (maxRetries = 5, delayMs = 500): Promise<boolean> => {
  for (let i = 0; i < maxRetries; i++) {
    const user = AuthenticationService.getCurrentUser();
    const firebaseUser = auth.currentUser;

    console.log(`🔄 [OnboardingKnowledge] Auth check attempt ${i + 1}/${maxRetries}:`, {
      hasUser: !!user,
      hasFirebaseUser: !!firebaseUser,
      userId: user?.uid,
    });

    if (user && firebaseUser) {
      try {
        // Try to get a token to verify auth is working (not force refresh to avoid quota issues)
        const token = await firebaseUser.getIdToken(false);
        if (token && token.length > 0) {
          console.log(`✅ [OnboardingKnowledge] Auth ready on attempt ${i + 1}`);

          // Add a small initial delay to ensure Firebase auth state is propagated
          if (i === 0) {
            console.log('⏳ [OnboardingKnowledge] Waiting 500ms for auth state propagation...');
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          return true;
        }
      } catch (error) {
        console.warn(`⚠️ [OnboardingKnowledge] Auth check failed on attempt ${i + 1}:`, error);
      }
    } else {
      console.warn(`⚠️ [OnboardingKnowledge] Missing auth on attempt ${i + 1}`);
    }

    if (i < maxRetries - 1) {
      console.log(`⏳ [OnboardingKnowledge] Waiting ${delayMs}ms before retry ${i + 2}...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  console.error('❌ [OnboardingKnowledge] Auth not ready after all retries');
  return false;
};

class OnboardingKnowledgeService {
  /**
   * Get the current authenticated user ID
   * Always use this instead of relying on passed userId to ensure Firebase auth context matches
   */
  private static getAuthenticatedUserId(passedUserId: string): string {
    const currentUser = AuthenticationService.getCurrentUser();
    if (!currentUser) {
      console.error('❌ No authenticated user found, falling back to passed userId');
      return passedUserId;
    }

    if (currentUser.uid !== passedUserId) {
      console.warn(`⚠️ Passed userId (${passedUserId}) differs from authenticated user (${currentUser.uid}). Using authenticated user.`);
    }

    return currentUser.uid;
  }

  /**
   * Process website content and save as knowledge item
   */
  static async processWebsiteContent(
    url: string,
    userId: string,
    workspaceId: string,
    brandColors?: string[],
    socialLinks?: Record<string, string>,
  ): Promise<void> {
    try {
      // Ensure Firebase auth is ready before proceeding
      console.log('🔄 [processWebsiteContent] Ensuring Firebase auth is ready...');
      const isAuthReady = await ensureAuthReady();
      if (!isAuthReady) {
        throw new Error('Firebase authentication not ready. Please try again.');
      }

      // Use authenticated user ID to ensure Firebase auth context matches
      const authenticatedUserId = this.getAuthenticatedUserId(userId);

      // Normalize and validate URL
      let validUrl = url.trim();

      // Auto-prepend https:// if no protocol is specified
      if (!validUrl.match(/^https?:\/\//i)) {
        validUrl = `https://${  validUrl}`;
      }

      // Validate URL format: must have protocol and domain with at least one dot
      const urlPattern = /^https?:\/\/[a-zA-Z0-9][\w\-]*(\.[\w\-]+)+/i;
      if (!urlPattern.test(validUrl)) {
        throw new Error('Please enter a valid website URL (e.g., example.com or www.example.com)');
      }

      // Create website knowledge item
      const websiteKnowledge = {
        type: 'webpage' as const,
        title: `Company Website - ${validUrl}`,
        content: `Website URL: ${validUrl}
        
${brandColors ? `Brand Colors: ${brandColors.join(', ')}` : ''}
        
${socialLinks ? Object.entries(socialLinks)
    .filter(([_, link]) => link.trim())
    .map(([platform, link]) => `${platform}: ${link}`)
    .join('\n') : ''}

This is the primary company website containing key business information, branding, and contact details.`,
        url: validUrl,
        tags: ['onboarding', 'website', 'company-info', 'branding'],
        description: 'Company website and branding information collected during onboarding',
        workspaceId,
        createdAt: new Date(),
      };

      // Create in users/{userId}/knowledge subcollection (3 segments = valid collection path)
      const knowledgePath = `users/${authenticatedUserId}/knowledge`;
      await BackendService.createDocument<KnowledgeItem>(knowledgePath, {
        ...websiteKnowledge,
        userId: authenticatedUserId,
      } as Omit<KnowledgeItem, 'id'> & { userId: string });

      console.log('Website knowledge saved successfully');
    } catch (error) {
      console.error('Error processing website content:', error);
      throw error;
    }
  }

  /**
   * Process sales materials and save as knowledge items
   */
  static async processSalesMaterials(
    files: FileUpload[],
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    try {
      // Ensure Firebase auth is ready before proceeding
      console.log('🔄 [processSalesMaterials] Ensuring Firebase auth is ready...');
      const isAuthReady = await ensureAuthReady();
      if (!isAuthReady) {
        throw new Error('Firebase authentication not ready. Please try again.');
      }

      // Use authenticated user ID to ensure Firebase auth context matches
      const authenticatedUserId = this.getAuthenticatedUserId(userId);

      for (const file of files) {
        // Validate file
        const validation = FileProcessingService.validateFile(file);
        if (!validation.isValid) {
          console.warn(`Skipping invalid file: ${file.name} - ${validation.error}`);
          continue;
        }

        // Process file content
        let extractedContent = '';
        try {
          // For now, create a basic knowledge item with file metadata
          // In a full implementation, you'd extract text content from PDFs, DOCX, etc.
          extractedContent = `Sales Material: ${file.name}
File Type: ${file.mimeType}
File Size: ${(file.size / 1024 / 1024).toFixed(2)} MB

This is a sales material uploaded during onboarding setup. The file contains important information about products, services, pricing, or sales processes that AI agents can reference during conversations.`;
        } catch (error) {
          console.warn(`Could not process file content for ${file.name}:`, error);
          extractedContent = `Sales material file: ${file.name} (content extraction pending)`;
        }

        const salesKnowledge = {
          type: 'file' as const,
          title: `Sales Material: ${file.name}`,
          content: extractedContent,
          tags: ['onboarding', 'sales-materials', 'documents'],
          description: `Sales material uploaded during onboarding: ${file.name}`,
          filePath: file.uri,
          fileSize: file.size,
          mimeType: file.mimeType,
          workspaceId,
          createdAt: new Date(),
        };

        // Create in users/{userId}/knowledge subcollection
        const knowledgePath = `users/${authenticatedUserId}/knowledge`;
        await BackendService.createDocument<KnowledgeItem>(knowledgePath, {
          ...salesKnowledge,
          userId: authenticatedUserId,
        } as Omit<KnowledgeItem, 'id'> & { userId: string });
      }

      console.log(`Processed ${files.length} sales materials successfully`);
    } catch (error) {
      console.error('Error processing sales materials:', error);
      throw error;
    }
  }

  /**
   * Structure pricing data and save as knowledge item
   */
  static async structurePricingData(
    pricing: PricingStructure,
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    try {
      // Ensure Firebase auth is ready before proceeding
      console.log('🔄 [structurePricingData] Ensuring Firebase auth is ready...');
      const isAuthReady = await ensureAuthReady();
      if (!isAuthReady) {
        throw new Error('Firebase authentication not ready. Please try again.');
      }

      // Use authenticated user ID to ensure Firebase auth context matches
      const authenticatedUserId = this.getAuthenticatedUserId(userId);
      const pricingContent = `PRICING INFORMATION

Currency: ${pricing.currency}

PRICING TIERS:
${pricing.tiers.map(tier => `
${tier.name} - ${tier.price}
${tier.isPopular ? '⭐ POPULAR CHOICE' : ''}
Features:
${tier.features.map(feature => `• ${feature}`).join('\n')}
${tier.targetCustomer ? `Target Customer: ${tier.targetCustomer}` : ''}
`).join('\n---\n')}

CORE FEATURES:
${pricing.coreFeatures.map(feature => `• ${feature}`).join('\n')}

COMPETITIVE ADVANTAGES:
${pricing.competitiveAdvantages.map(advantage => `• ${advantage}`).join('\n')}

TARGET CUSTOMER PROFILE:
${pricing.targetCustomerProfile}

Use this pricing information to respond to pricing questions and help qualify leads based on their budget and needs.`;

      const pricingKnowledge = {
        type: 'snippet' as const,
        title: 'Pricing Structure & Product Information',
        content: pricingContent,
        tags: ['onboarding', 'pricing', 'product-info', 'sales'],
        description: 'Comprehensive pricing and product information for AI agents',
        workspaceId,
        createdAt: new Date(),
      };

      // Create in users/{userId}/knowledge subcollection
      const knowledgePath = `users/${authenticatedUserId}/knowledge`;
      await BackendService.createDocument<KnowledgeItem>(knowledgePath, {
        ...pricingKnowledge,
        userId: authenticatedUserId,
      } as Omit<KnowledgeItem, 'id'> & { userId: string });

      console.log('Pricing information saved successfully');
    } catch (error) {
      console.error('Error saving pricing data:', error);
      throw error;
    }
  }

  /**
   * Save FAQs to knowledge base
   */
  static async saveFAQsToKnowledge(
    faqs: FAQPair[],
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    try {
      // Ensure Firebase auth is ready before proceeding
      console.log('🔄 [saveFAQsToKnowledge] Ensuring Firebase auth is ready...');
      const isAuthReady = await ensureAuthReady();
      if (!isAuthReady) {
        throw new Error('Firebase authentication not ready. Please try again.');
      }

      // Use authenticated user ID to ensure Firebase auth context matches
      const authenticatedUserId = this.getAuthenticatedUserId(userId);

      // Group FAQs by category for better organization
      const categorizedFAQs = faqs.reduce((acc, faq) => {
        if (!acc[faq.category]) {
          acc[faq.category] = [];
        }
        acc[faq.category].push(faq);
        return acc;
      }, {} as Record<string, FAQPair[]>);

      // Create a knowledge item for each category
      for (const [category, categoryFAQs] of Object.entries(categorizedFAQs)) {
        const faqContent = `FREQUENTLY ASKED QUESTIONS - ${category.toUpperCase()}

${categoryFAQs.map(faq => `Q: ${faq.question}
A: ${faq.answer}`).join('\n\n---\n\n')}

Use these answers to respond to common customer questions in the ${category} category.`;

        const faqKnowledge = {
          type: 'snippet' as const,
          title: `FAQ - ${category.charAt(0).toUpperCase() + category.slice(1)}`,
          content: faqContent,
          tags: ['onboarding', 'faq', category, 'customer-support'],
          description: `Frequently asked questions in the ${category} category`,
          workspaceId,
          createdAt: new Date(),
        };

        // Create in users/{userId}/knowledge subcollection
        const knowledgePath = `users/${authenticatedUserId}/knowledge`;
        await BackendService.createDocument<KnowledgeItem>(knowledgePath, {
          ...faqKnowledge,
          userId: authenticatedUserId,
        } as Omit<KnowledgeItem, 'id'> & { userId: string });
      }

      console.log(`Saved ${faqs.length} FAQs across ${Object.keys(categorizedFAQs).length} categories`);
    } catch (error) {
      console.error('Error saving FAQs:', error);
      throw error;
    }
  }

  /**
   * Save objection responses to knowledge base
   */
  static async saveObjectionResponses(
    objections: ObjectionResponse[],
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    try {
      // Ensure Firebase auth is ready before proceeding
      console.log('🔄 [saveObjectionResponses] Ensuring Firebase auth is ready...');
      const isAuthReady = await ensureAuthReady();
      if (!isAuthReady) {
        throw new Error('Firebase authentication not ready. Please try again.');
      }

      // Use authenticated user ID to ensure Firebase auth context matches
      const authenticatedUserId = this.getAuthenticatedUserId(userId);

      const objectionContent = `OBJECTION HANDLING RESPONSES

${objections.map(obj => `OBJECTION: "${obj.objection}"
RESPONSE: ${obj.response}
${obj.context ? `CONTEXT: ${obj.context}` : ''}
${obj.isCommon ? '(Common objection)' : ''}`).join('\n\n---\n\n')}

Use these responses to handle common sales objections during conversations. Adapt the language and tone to match the specific situation and prospect.`;

      const objectionKnowledge = {
        type: 'snippet' as const,
        title: 'Sales Objection Handling Responses',
        content: objectionContent,
        tags: ['onboarding', 'objections', 'sales-responses', 'sales-training'],
        description: 'Prepared responses for handling common sales objections',
        workspaceId,
        createdAt: new Date(),
      };

      // Create in users/{userId}/knowledge subcollection
      const knowledgePath = `users/${authenticatedUserId}/knowledge`;
      await BackendService.createDocument<KnowledgeItem>(knowledgePath, {
        ...objectionKnowledge,
        userId: authenticatedUserId,
      } as Omit<KnowledgeItem, 'id'> & { userId: string });

      console.log(`Saved ${objections.length} objection responses`);
    } catch (error) {
      console.error('Error saving objection responses:', error);
      throw error;
    }
  }

  /**
   * Save contact information to knowledge base
   */
  static async saveContactInfo(
    contactInfo: ContactDetails,
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    try {
      // Ensure Firebase auth is ready before proceeding
      console.log('🔄 [saveContactInfo] Ensuring Firebase auth is ready...');
      const isAuthReady = await ensureAuthReady();
      if (!isAuthReady) {
        throw new Error('Firebase authentication not ready. Please try again.');
      }

      // Use authenticated user ID to ensure Firebase auth context matches
      const authenticatedUserId = this.getAuthenticatedUserId(userId);

      const contactContent = `COMPANY CONTACT INFORMATION

SALES CONTACT:
Name: ${contactInfo.salesContact.name}
Email: ${contactInfo.salesContact.email}
${contactInfo.salesContact.phone ? `Phone: ${contactInfo.salesContact.phone}` : ''}

SUPPORT CONTACT:
Name: ${contactInfo.supportContact.name}
Email: ${contactInfo.supportContact.email}
${contactInfo.supportContact.phone ? `Phone: ${contactInfo.supportContact.phone}` : ''}

BUSINESS HOURS:
${contactInfo.businessHours.hours}
Timezone: ${contactInfo.businessHours.timezone}

PREFERRED COMMUNICATION:
${contactInfo.preferredCommunication.join(', ')}

${contactInfo.additionalInfo ? `ADDITIONAL INFO:
${contactInfo.additionalInfo}` : ''}

Use this contact information to direct prospects to the appropriate team members and set proper expectations about response times and availability.`;

      const contactKnowledge = {
        type: 'snippet' as const,
        title: 'Company Contact Information',
        content: contactContent,
        tags: ['onboarding', 'contact-info', 'company-details', 'support'],
        description: 'Company contact information and business hours',
        workspaceId,
        createdAt: new Date(),
      };

      // Create in users/{userId}/knowledge subcollection
      const knowledgePath = `users/${authenticatedUserId}/knowledge`;
      await BackendService.createDocument<KnowledgeItem>(knowledgePath, {
        ...contactKnowledge,
        userId: authenticatedUserId,
      } as Omit<KnowledgeItem, 'id'> & { userId: string });

      console.log('Contact information saved successfully');
    } catch (error) {
      console.error('Error saving contact info:', error);
      throw error;
    }
  }

  /**
   * Save closing links to knowledge base
   */
  static async saveClosingLinks(
    closingLinks: {
      websiteUrl?: string;
      meetingCalendarUrl?: string;
      demoBookingUrl?: string;
      pricingPageUrl?: string;
      contactFormUrl?: string;
      customClosingMessage?: string;
    },
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    try {
      // Ensure Firebase auth is ready before proceeding
      console.log('🔄 [saveClosingLinks] Ensuring Firebase auth is ready...');
      const isAuthReady = await ensureAuthReady();
      if (!isAuthReady) {
        throw new Error('Firebase authentication not ready. Please try again.');
      }

      // Use authenticated user ID to ensure Firebase auth context matches
      const authenticatedUserId = this.getAuthenticatedUserId(userId);

      const closingContent = `CLOSING LINKS & CONVERSION TOOLS

${closingLinks.websiteUrl ? `MAIN WEBSITE: ${closingLinks.websiteUrl}` : ''}
${closingLinks.meetingCalendarUrl ? `MEETING CALENDAR: ${closingLinks.meetingCalendarUrl}` : ''}
${closingLinks.demoBookingUrl ? `DEMO BOOKING: ${closingLinks.demoBookingUrl}` : ''}
${closingLinks.pricingPageUrl ? `PRICING PAGE: ${closingLinks.pricingPageUrl}` : ''}
${closingLinks.contactFormUrl ? `CONTACT FORM: ${closingLinks.contactFormUrl}` : ''}

${closingLinks.customClosingMessage ? `CUSTOM CLOSING MESSAGE:
"${closingLinks.customClosingMessage}"` : ''}

USAGE GUIDELINES:
- Use the main website for general inquiries and company information
- Use meeting calendar for prospects ready to schedule calls
- Use demo booking for prospects interested in product demonstrations
- Use pricing page for budget-conscious prospects
- Use contact form for general inquiries and lead capture
- Always personalize the closing message based on the prospect's specific needs and interests
- Only share links via private message after establishing rapport in public comments
- Choose the most appropriate link based on the conversation context and prospect's stage in the buying process

These links are essential tools for converting qualified leads into customers. Use them strategically based on the prospect's expressed needs and buying signals.`;

      const closingKnowledge = {
        type: 'snippet' as const,
        title: 'Closing Links & Conversion Tools',
        content: closingContent,
        tags: ['onboarding', 'closing-links', 'conversion-tools', 'sales'],
        description: 'Links and tools for closing leads and converting prospects',
        workspaceId,
        createdAt: new Date(),
      };

      // Create in users/{userId}/knowledge subcollection
      const knowledgePath = `users/${authenticatedUserId}/knowledge`;
      await BackendService.createDocument<KnowledgeItem>(knowledgePath, {
        ...closingKnowledge,
        userId: authenticatedUserId,
      } as Omit<KnowledgeItem, 'id'> & { userId: string });

      console.log('Closing links saved successfully');
    } catch (error) {
      console.error('Error saving closing links:', error);
      throw error;
    }
  }

  /**
   * Generate comprehensive knowledge summary for AI context
   */
  static async generateOnboardingKnowledgeSummary(userId: string): Promise<string> {
    try {
      // Fetch all onboarding knowledge items from users/{userId}/knowledge subcollection
      const knowledgePath = `users/${userId}/knowledge`;
      const knowledgeItems = await BackendService.queryCollection<KnowledgeItem>(
        knowledgePath,
        {
          where: [
            { field: 'tags', operator: 'array-contains', value: 'onboarding' },
          ],
        },
      );

      const summary = `ONBOARDING KNOWLEDGE SUMMARY

Total Knowledge Items: ${knowledgeItems.length}

Categories Covered:
${knowledgeItems.map((item: KnowledgeItem) => `• ${item.title} (${item.type})`).join('\n')}

This knowledge was collected during the user's onboarding process and represents the most important information about their business, products, pricing, and sales processes. Prioritize this information when responding to customer inquiries.`;

      return summary;
    } catch (error) {
      console.error('Error generating knowledge summary:', error);
      return 'Unable to generate knowledge summary at this time.';
    }
  }

  /**
   * Get onboarding knowledge completion status
   */
  static async getKnowledgeCompletionStatus(userId: string): Promise<{
    hasWebsite: boolean;
    hasSalesMaterials: boolean;
    hasPricing: boolean;
    hasFAQs: boolean;
    hasContact: boolean;
    totalItems: number;
  }> {
    try {
      // Query from users/{userId}/knowledge subcollection
      const knowledgePath = `users/${userId}/knowledge`;
      const knowledgeItems = await BackendService.queryCollection<KnowledgeItem>(
        knowledgePath,
        {
          where: [
            { field: 'tags', operator: 'array-contains', value: 'onboarding' },
          ],
        },
      );

      const hasWebsite = knowledgeItems.some((item: KnowledgeItem) => item.tags.includes('website'));
      const hasSalesMaterials = knowledgeItems.some((item: KnowledgeItem) => item.tags.includes('sales-materials'));
      const hasPricing = knowledgeItems.some((item: KnowledgeItem) => item.tags.includes('pricing'));
      const hasFAQs = knowledgeItems.some((item: KnowledgeItem) => item.tags.includes('faq'));
      const hasContact = knowledgeItems.some((item: KnowledgeItem) => item.tags.includes('contact-info'));

      return {
        hasWebsite,
        hasSalesMaterials,
        hasPricing,
        hasFAQs,
        hasContact,
        totalItems: knowledgeItems.length,
      };
    } catch (error) {
      console.error('Error getting knowledge completion status:', error);
      return {
        hasWebsite: false,
        hasSalesMaterials: false,
        hasPricing: false,
        hasFAQs: false,
        hasContact: false,
        totalItems: 0,
      };
    }
  }
}

export default OnboardingKnowledgeService;