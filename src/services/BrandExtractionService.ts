/**
 * Brand Extraction Service
 * Extracts brand and product information from websites and App Store URLs
 * Uses Gemini AI directly from the client
 */

export interface ExtractedQuestAnswers {
  // Quest answers keyed by quest ID
  quest_hunting_keywords?: string[]; // Keywords to search for leads
  quest_website_url?: string; // Website URL (we already have this)
  quest_brand_colors?: string[]; // Brand colors (hex codes)
  quest_social_links?: { platform: string; url: string }[]; // Social media links
  quest_pricing?: string; // Pricing description
  quest_faq?: { question: string; answer: string }[]; // Common FAQs
  quest_objections?: { objection: string; response: string }[]; // Objection handling
  quest_contact_sales?: string[]; // Sales contact info (name, email)
  quest_business_hours?: string; // Business hours
  quest_meeting_link?: string; // Booking/calendar link
}

export interface ExtractedBrandInfo {
  businessName: string;
  targetMarket: string;
  productDescription: string;
  businessStage: 'startup' | 'growth' | 'established';
  additionalKnowledge: Array<{
    title: string;
    content: string;
    tags: string[];
    category: string;
  }>;
  questAnswers?: ExtractedQuestAnswers; // AI-extracted quest answers
  sourceUrl: string;
  extractedAt: Date;
  confidence: number;
}

interface AppStoreData {
  trackName?: string;
  artistName?: string;
  description?: string;
  primaryGenreName?: string;
  formattedPrice?: string;
  averageUserRating?: number;
  userRatingCount?: number;
  releaseNotes?: string;
}

interface WebPageContent {
  title: string;
  description: string;
  bodyText: string;
  url: string;
}

class BrandExtractionService {
  private getGeminiApiKey(): string | null {
    // Access EXPO_PUBLIC_ env vars directly - they're inlined at build time
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || null;
    return apiKey;
  }

  /**
   * Extract brand information from a URL
   */
  async extractFromURL(url: string): Promise<ExtractedBrandInfo> {
    console.log(`Extracting brand info from: ${url}`);

    // Check if it's an App Store URL
    const isAppStore = url.includes('apps.apple.com') || url.includes('itunes.apple.com');

    let content: WebPageContent;

    if (isAppStore) {
      console.log('Fetching App Store content...');
      content = await this.fetchAppStoreContent(url);
    } else {
      console.log('Fetching website content...');
      content = await this.fetchWebsiteContent(url);
    }

    console.log('Content fetched:', content.title);

    // Try to analyze with Gemini AI
    const apiKey = this.getGeminiApiKey();
    console.log('Gemini API key available:', !!apiKey);

    if (apiKey) {
      try {
        console.log('Analyzing with Gemini...');
        const result = await this.analyzeWithGemini(content, url, apiKey);
        console.log('Gemini analysis complete:', result.businessName);
        return result;
      } catch (error) {
        console.error('Gemini analysis failed:', error);
      }
    } else {
      console.log('No Gemini API key found, using basic extraction');
    }

    // Fallback to basic extraction
    console.log('Using basic extraction...');
    return this.extractBasicInfo(content, url);
  }

  /**
   * Fetch App Store content using iTunes API
   */
  private async fetchAppStoreContent(url: string): Promise<WebPageContent> {
    const appIdMatch = url.match(/id(\d+)/);
    const appId = appIdMatch ? appIdMatch[1] : null;

    if (appId) {
      try {
        const lookupUrl = `https://itunes.apple.com/lookup?id=${appId}`;
        const response = await fetch(lookupUrl);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
          const app: AppStoreData = data.results[0];
          return {
            title: app.trackName || 'App',
            description: app.description || '',
            bodyText: `
              App Name: ${app.trackName}
              Developer: ${app.artistName}
              Category: ${app.primaryGenreName}
              Price: ${app.formattedPrice || 'Free'}
              Rating: ${app.averageUserRating || 'N/A'} (${app.userRatingCount || 0} reviews)
              Description: ${app.description}
              What's New: ${app.releaseNotes || 'N/A'}
            `,
            url,
          };
        }
      } catch (error) {
        console.error('Error fetching App Store data:', error);
      }
    }

    return {
      title: 'App',
      description: '',
      bodyText: '',
      url,
    };
  }

  /**
   * Fetch website content by scraping the page
   */
  private async fetchWebsiteContent(url: string): Promise<WebPageContent> {
    // Extract domain name as fallback title
    let fallbackTitle = 'Website';
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace('www.', '');
      const parts = hostname.split('.');
      if (parts.length >= 2) {
        fallbackTitle = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      }
    } catch {
      // Keep default
    }

    try {
      console.log('[BrandExtraction] Fetching website content from:', url);

      // Use a CORS proxy to fetch website content
      // AllOrigins is a public CORS proxy that works well for this use case
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;

      const response = await fetch(proxyUrl, {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const html = await response.text();
      console.log('[BrandExtraction] Fetched HTML length:', html.length);

      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : fallbackTitle;

      // Extract meta description
      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i)
        || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i);
      const description = descMatch ? descMatch[1].trim() : '';

      // Extract Open Graph description as fallback
      const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i)
        || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["'][^>]*>/i);
      const ogDescription = ogDescMatch ? ogDescMatch[1].trim() : '';

      // Extract body text - remove scripts, styles, and HTML tags
      let bodyText = html
        // Remove script and style content
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
        // Remove HTML comments
        .replace(/<!--[\s\S]*?-->/g, ' ')
        // Remove HTML tags but keep content
        .replace(/<[^>]+>/g, ' ')
        // Decode common HTML entities
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&rsquo;/g, "'")
        .replace(/&lsquo;/g, "'")
        .replace(/&rdquo;/g, '"')
        .replace(/&ldquo;/g, '"')
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–')
        // Clean up whitespace
        .replace(/\s+/g, ' ')
        .trim();

      // Limit body text to prevent huge prompts
      if (bodyText.length > 15000) {
        bodyText = `${bodyText.substring(0, 15000)}...`;
      }

      console.log('[BrandExtraction] Extracted title:', title);
      console.log('[BrandExtraction] Extracted description:', description || ogDescription || '(none)');
      console.log('[BrandExtraction] Body text length:', bodyText.length);

      return {
        title,
        description: description || ogDescription,
        bodyText,
        url,
      };
    } catch (error) {
      console.error('[BrandExtraction] Error fetching website:', error);

      // Return minimal content with just the URL - Gemini will work with what it has
      return {
        title: fallbackTitle,
        description: '',
        bodyText: `Website URL: ${url}. Please analyze this website and infer business information based on the URL and any knowledge you have about this domain.`,
        url,
      };
    }
  }

  /**
   * Analyze content with Gemini AI
   */
  private async analyzeWithGemini(
    content: WebPageContent,
    sourceUrl: string,
    apiKey: string,
  ): Promise<ExtractedBrandInfo> {
    const prompt = `You are a business analyst AI that extracts and structures brand information from websites and app listings. Always respond with valid JSON only, no markdown formatting.

Analyze this website/app content and extract brand and business information. Be thorough - extract as much useful information as possible for a sales AI agent that needs to learn about this business.

SOURCE URL: ${sourceUrl}
TITLE: ${content.title}
DESCRIPTION: ${content.description}
CONTENT: ${content.bodyText.substring(0, 8000)}

Extract the following information. Be specific and detailed based on the actual content:

1. businessName: The official business or brand name
2. targetMarket: Detailed description of the ideal customer (demographics, job titles, industries, pain points)
3. productDescription: What the product/service does, key features, benefits, and what makes it unique
4. businessStage: Estimate based on content - "startup" (new, early stage), "growth" (scaling, some traction), or "established" (mature, market leader)
5. additionalKnowledge: Extract 3-5 additional useful pieces of information
6. questAnswers: IMPORTANT - You MUST provide answers for ALL of these fields. If you cannot find explicit information, INFER reasonable values based on the industry, product type, and typical business practices. Empty arrays or null values are NOT acceptable - provide your best educated guess:

   - quest_hunting_keywords: (REQUIRED - array of 5-10 strings) What search phrases would potential customers use? Think about pain points they're trying to solve. Examples: "need help with invoicing", "looking for project management tool", "best CRM for small business"

   - quest_brand_colors: (REQUIRED - array of 2-3 hex codes) Extract colors from the site, or suggest professional colors that fit the brand/industry. Examples: ["#3B82F6", "#10B981"]

   - quest_social_links: (array of objects) Social media links found on the site. If none found, return empty array []. Format: [{"platform": "twitter", "url": "https://..."}]

   - quest_pricing: (REQUIRED - string) Describe the pricing model. If not found, infer based on industry standards. Examples: "Freemium model with paid plans starting at $X/month", "Custom enterprise pricing", "One-time purchase at $X"

   - quest_faq: (REQUIRED - array of 3-5 objects) Common customer questions. ALWAYS generate these based on the product/industry. Format: [{"question": "How does X work?", "answer": "X works by..."}]

   - quest_objections: (REQUIRED - array of 3-5 objects) Sales objections customers might have. ALWAYS generate these. Format: [{"objection": "It's too expensive", "response": "We offer flexible pricing..."}]

   - quest_contact_sales: (array of strings) Contact info found. If none, return empty array []. Format: ["John Smith - john@company.com"]

   - quest_business_hours: (string or null) Business hours if mentioned. If not found, suggest typical hours like "Mon-Fri 9am-5pm EST"

   - quest_meeting_link: (string or null) Any booking/calendar links found.

Respond with ONLY valid JSON (no markdown code blocks):
{
  "businessName": "string",
  "targetMarket": "string (2-3 sentences describing ideal customer)",
  "productDescription": "string (2-3 sentences about the product)",
  "businessStage": "startup" | "growth" | "established",
  "additionalKnowledge": [
    {
      "title": "string",
      "content": "string",
      "tags": ["tag1", "tag2"],
      "category": "pricing" | "features" | "competitive" | "use_cases" | "company" | "other"
    }
  ],
  "questAnswers": {
    "quest_hunting_keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
    "quest_brand_colors": ["#hex1", "#hex2"],
    "quest_social_links": [],
    "quest_pricing": "Pricing description here",
    "quest_faq": [{"question": "...", "answer": "..."}, {"question": "...", "answer": "..."}, {"question": "...", "answer": "..."}],
    "quest_objections": [{"objection": "...", "response": "..."}, {"objection": "...", "response": "..."}, {"objection": "...", "response": "..."}],
    "quest_contact_sales": [],
    "quest_business_hours": "Mon-Fri 9am-5pm EST",
    "quest_meeting_link": null
  },
  "confidence": 0.0-1.0
}

CRITICAL: quest_hunting_keywords, quest_brand_colors, quest_pricing, quest_faq, and quest_objections are REQUIRED and must have values. Generate intelligent guesses if needed.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    console.log('[BrandExtraction] Raw Gemini response:', responseText.substring(0, 500));

    // Clean up response (remove markdown code blocks if present)
    const cleanedResponse = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleanedResponse);

    console.log('[BrandExtraction] Parsed questAnswers:', JSON.stringify(parsed.questAnswers, null, 2));

    const validateBusinessStage = (value: string): 'startup' | 'growth' | 'established' => {
      if (value === 'startup' || value === 'growth' || value === 'established') {
        return value;
      }
      return 'startup';
    };

    // Helper to safely extract arrays - more forgiving of data formats
    const safeArray = (val: unknown): string[] | undefined => {
      if (Array.isArray(val) && val.length > 0) {
        return val.map(v => String(v)).filter(v => v.trim() !== '');
      }
      return undefined;
    };

    // Helper to safely extract string
    const safeString = (val: unknown): string | undefined => {
      if (typeof val === 'string' && val.trim() !== '') {
        return val.trim();
      }
      if (val !== null && val !== undefined) {
        const str = String(val).trim();
        if (str !== '' && str !== 'null' && str !== 'undefined') {
          return str;
        }
      }
      return undefined;
    };

    // Helper for FAQ/objection arrays (objects with question/answer or objection/response)
    const safeObjectArray = (val: unknown): Array<{ question?: string; answer?: string; objection?: string; response?: string }> | undefined => {
      if (Array.isArray(val) && val.length > 0) {
        const filtered = val.filter(item =>
          item && typeof item === 'object' &&
          ((item.question && item.answer) || (item.objection && item.response)),
        );
        if (filtered.length > 0) {
          return filtered;
        }
      }
      return undefined;
    };

    // Helper for social links array
    const safeSocialLinks = (val: unknown): Array<{ platform: string; url: string }> | undefined => {
      if (Array.isArray(val) && val.length > 0) {
        const filtered = val.filter(item =>
          item && typeof item === 'object' && item.platform && item.url,
        );
        if (filtered.length > 0) {
          return filtered;
        }
      }
      return undefined;
    };

    // Extract quest answers with more forgiving parsing
    const qa = parsed.questAnswers || {};
    const questAnswers: ExtractedQuestAnswers = {
      quest_hunting_keywords: safeArray(qa.quest_hunting_keywords),
      quest_website_url: sourceUrl,
      quest_brand_colors: safeArray(qa.quest_brand_colors),
      quest_social_links: safeSocialLinks(qa.quest_social_links),
      quest_pricing: safeString(qa.quest_pricing),
      quest_faq: safeObjectArray(qa.quest_faq) as { question: string; answer: string }[] | undefined,
      quest_objections: safeObjectArray(qa.quest_objections) as { objection: string; response: string }[] | undefined,
      quest_contact_sales: safeArray(qa.quest_contact_sales),
      quest_business_hours: safeString(qa.quest_business_hours),
      quest_meeting_link: safeString(qa.quest_meeting_link),
    };

    // Log what we actually extracted
    const extractedFields = Object.entries(questAnswers)
      .filter(([, v]) => v !== undefined)
      .map(([k]) => k);
    console.log('[BrandExtraction] Successfully extracted quest fields:', extractedFields);

    return {
      businessName: parsed.businessName || content.title,
      targetMarket: parsed.targetMarket || 'Edit to describe your ideal customer.',
      productDescription: parsed.productDescription || content.description || 'Add your product description here.',
      businessStage: validateBusinessStage(parsed.businessStage),
      additionalKnowledge: Array.isArray(parsed.additionalKnowledge)
        ? parsed.additionalKnowledge.map((item: { title?: string; content?: string; tags?: string[]; category?: string }) => ({
          title: item.title || 'Information',
          content: item.content || '',
          tags: Array.isArray(item.tags) ? item.tags : [],
          category: item.category || 'other',
        }))
        : [],
      questAnswers,
      sourceUrl,
      extractedAt: new Date(),
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
    };
  }

  /**
   * Basic extraction without AI
   */
  private extractBasicInfo(content: WebPageContent, sourceUrl: string): ExtractedBrandInfo {
    return {
      businessName: content.title || 'My Business',
      targetMarket: 'Edit to describe your ideal customer.',
      productDescription: content.description || 'Add your product or service description here.',
      businessStage: 'startup',
      additionalKnowledge: [
        {
          title: 'Website',
          content: sourceUrl,
          tags: ['website', 'source'],
          category: 'company',
        },
      ],
      sourceUrl,
      extractedAt: new Date(),
      confidence: 0.5,
    };
  }

  /**
   * Validate URL format
   */
  isValidURL(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Normalize URL (add https if missing)
   */
  normalizeURL(url: string): string {
    let normalized = url.trim();

    if (!normalized.match(/^https?:\/\//i)) {
      normalized = `https://${normalized}`;
    }

    return normalized;
  }
}

export default new BrandExtractionService();
