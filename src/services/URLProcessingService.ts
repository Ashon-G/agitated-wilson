import { URLPreview } from '../types/knowledge';
import { getOpenAITextResponse } from '../api/chat-service';
import { AIMessage } from '../types/ai';

class URLProcessingService {
  private static readonly URL_REGEX = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

  /**
   * Validate URL format
   */
  static isValidURL(url: string): boolean {
    try {
      new URL(url);
      return this.URL_REGEX.test(url);
    } catch {
      return false;
    }
  }

  /**
   * Process URL and extract metadata with AI analysis
   */
  static async processURL(url: string, userId?: string): Promise<URLPreview> {
    const preview: URLPreview = {
      url,
      status: 'loading',
    };

    try {
      // Validate URL first
      if (!this.isValidURL(url)) {
        return {
          ...preview,
          status: 'error',
          error: 'Invalid URL format',
        };
      }

      // Simulate API call to extract metadata
      // In a real implementation, you'd call a service like:
      // - OpenGraph API
      // - Custom scraping service
      // - Third-party URL preview service

      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay

      // Mock successful response based on URL patterns
      const mockPreview = this.generateMockPreview(url);

      // AI-powered content analysis if user provided
      let aiAnalysis = null;
      if (userId) {
        try {
          aiAnalysis = await this.analyzeURLContent(url);
        } catch (aiError) {
          console.warn('AI URL analysis failed:', aiError);
        }
      }

      return {
        ...preview,
        ...mockPreview,
        ...(aiAnalysis && {
          aiSummary: aiAnalysis.summary,
          aiKeyPoints: aiAnalysis.keyPoints,
          aiTags: aiAnalysis.suggestedTags,
          relevanceScore: aiAnalysis.relevanceScore,
        }),
        status: 'loaded',
      };
    } catch (error) {
      console.error('URL processing error:', error);
      return {
        ...preview,
        status: 'error',
        error: 'Failed to load URL preview',
      };
    }
  }

  /**
   * Analyze URL content using AI
   */
  static async analyzeURLContent(url: string): Promise<{
    summary: string;
    keyPoints: string[];
    suggestedTags: string[];
    relevanceScore: number;
  }> {
    try {
      const domain = this.extractDomain(url);

      const analysisPrompt = `Analyze this URL and provide insights based on the domain and URL structure:

URL: ${url}
Domain: ${domain}

Based on the URL pattern, domain, and path, provide:
1. A summary of what type of content this likely contains
2. Key topics or areas this content might cover
3. Relevant tags for categorization
4. Relevance score (0-100) for business/professional use

Consider common URL patterns:
- GitHub repositories usually contain code and documentation
- YouTube links are video content
- Documentation sites contain technical guides
- Blog posts contain articles and insights
- Stack Overflow has Q&A content

Format your response as JSON:
{
  "summary": "Brief description of expected content",
  "keyPoints": ["Topic 1", "Topic 2", "Topic 3"],
  "suggestedTags": ["tag1", "tag2", "tag3"],
  "relevanceScore": 85
}`;

      const messages: AIMessage[] = [
        { role: 'system', content: 'You are an AI assistant that analyzes URLs and predicts content type and relevance. Always respond with valid JSON.' },
        { role: 'user', content: analysisPrompt },
      ];

      const response = await getOpenAITextResponse(messages, {
        temperature: 0.3,
        maxTokens: 400,
      });

      try {
        const analysis = JSON.parse(response.content);
        return {
          summary: analysis.summary || 'Web content analysis not available',
          keyPoints: Array.isArray(analysis.keyPoints) ? analysis.keyPoints.slice(0, 5) : [],
          suggestedTags: Array.isArray(analysis.suggestedTags) ? analysis.suggestedTags.slice(0, 8) : this.getSuggestedTags(url),
          relevanceScore: typeof analysis.relevanceScore === 'number' ? Math.min(100, Math.max(0, analysis.relevanceScore)) : 50,
        };
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError);
        return {
          summary: 'URL added to knowledge base',
          keyPoints: [],
          suggestedTags: this.getSuggestedTags(url),
          relevanceScore: 50,
        };
      }
    } catch (error) {
      console.error('AI URL analysis failed:', error);
      throw error;
    }
  }

  /**
   * Generate mock preview data based on URL patterns
   * In production, this would be replaced with real scraping
   */
  private static generateMockPreview(url: string): Partial<URLPreview> {
    const domain = this.extractDomain(url);

    // GitHub URLs
    if (domain.includes('github.com')) {
      return {
        title: 'GitHub Repository',
        description: 'A repository hosted on GitHub with code, documentation, and collaboration features.',
        image: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
        favicon: 'https://github.com/favicon.ico',
      };
    }

    // Documentation sites
    if (domain.includes('docs.') || url.includes('documentation')) {
      return {
        title: 'Documentation',
        description: 'Technical documentation and guides for developers and users.',
        favicon: '/docs-favicon.ico',
      };
    }

    // YouTube URLs
    if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
      return {
        title: 'YouTube Video',
        description: 'Educational and informational video content.',
        image: 'https://img.youtube.com/vi/placeholder/maxresdefault.jpg',
        favicon: 'https://www.youtube.com/favicon.ico',
      };
    }

    // Medium articles
    if (domain.includes('medium.com')) {
      return {
        title: 'Medium Article',
        description: 'Insightful article from the Medium publishing platform.',
        favicon: 'https://medium.com/favicon.ico',
      };
    }

    // Stack Overflow
    if (domain.includes('stackoverflow.com')) {
      return {
        title: 'Stack Overflow Question',
        description: 'Programming question and answers from the developer community.',
        favicon: 'https://stackoverflow.com/favicon.ico',
      };
    }

    // Default fallback
    return {
      title: this.generateTitleFromURL(url),
      description: `Content from ${domain}`,
      favicon: `https://www.google.com/s2/favicons?domain=${domain}`,
    };
  }

  /**
   * Extract domain from URL
   */
  private static extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return '';
    }
  }

  /**
   * Generate title from URL path
   */
  private static generateTitleFromURL(url: string): string {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;

      if (path === '/' || path === '') {
        return urlObj.hostname;
      }

      // Extract meaningful part from path
      const segments = path.split('/').filter(segment => segment.length > 0);
      const lastSegment = segments[segments.length - 1];

      // Clean up the segment (remove file extensions, decode URI, etc.)
      const cleaned = lastSegment
        .replace(/\.[^/.]+$/, '') // Remove file extension
        .replace(/[-_]/g, ' ') // Replace dashes and underscores with spaces
        .replace(/%20/g, ' ') // Decode URL encoding
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

      return cleaned || urlObj.hostname;
    } catch {
      return 'Web Page';
    }
  }

  /**
   * Get suggested tags based on URL
   */
  static getSuggestedTags(url: string): string[] {
    const tags: string[] = ['webpage'];
    const domain = this.extractDomain(url);

    // Add domain-based tags
    if (domain.includes('github.com')) tags.push('github', 'code', 'repository');
    if (domain.includes('youtube.com')) tags.push('youtube', 'video', 'tutorial');
    if (domain.includes('medium.com')) tags.push('medium', 'article', 'blog');
    if (domain.includes('stackoverflow.com')) tags.push('stackoverflow', 'programming', 'qa');
    if (domain.includes('docs.')) tags.push('documentation', 'reference');
    if (domain.includes('wikipedia.org')) tags.push('wikipedia', 'reference', 'knowledge');
    if (domain.includes('reddit.com')) tags.push('reddit', 'discussion', 'community');
    if (domain.includes('twitter.com') || domain.includes('x.com')) tags.push('twitter', 'social', 'news');

    // Add content-based tags from URL path
    const url_lower = url.toLowerCase();
    if (url_lower.includes('api')) tags.push('api');
    if (url_lower.includes('tutorial')) tags.push('tutorial');
    if (url_lower.includes('guide')) tags.push('guide');
    if (url_lower.includes('blog')) tags.push('blog');
    if (url_lower.includes('news')) tags.push('news');
    if (url_lower.includes('research')) tags.push('research');
    if (url_lower.includes('paper')) tags.push('paper', 'academic');

    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Check if URL points to a specific content type
   */
  static getContentType(url: string): string {
    const url_lower = url.toLowerCase();

    if (url_lower.includes('youtube.com') || url_lower.includes('youtu.be') ||
        url_lower.includes('vimeo.com')) return 'video';

    if (url_lower.includes('spotify.com') || url_lower.includes('soundcloud.com') ||
        url_lower.match(/\.(mp3|wav|m4a)$/)) return 'audio';

    if (url_lower.match(/\.(pdf|doc|docx)$/)) return 'document';

    if (url_lower.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) return 'image';

    if (url_lower.includes('github.com')) return 'code';

    return 'webpage';
  }
}

export default URLProcessingService;