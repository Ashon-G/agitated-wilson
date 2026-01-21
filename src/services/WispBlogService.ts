/**
 * WispBlogService - Service for fetching blog posts from Wisp CMS
 */

const BLOG_ID = 'cm3o0nulo00005d7hhk1qfx6w';
const BASE_URL = `https://www.wisp.blog/api/v1/${BLOG_ID}`;

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  description?: string;
  content?: string;
  image?: {
    url: string;
    alt?: string;
  };
  // Alternative image field names from API
  featuredImage?: string;
  thumbnail?: string;
  coverImage?: string;
  tags?: BlogTag[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  readingTime?: number;
}

export interface BlogTag {
  id: string;
  name: string;
  slug: string;
}

export interface BlogPostsResponse {
  posts: BlogPost[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface BlogTagsResponse {
  tags: BlogTag[];
}

class WispBlogService {
  /**
   * Normalize post data to ensure consistent image field
   */
  private normalizePost(post: any): BlogPost {
    // Handle various image field formats from the API
    let imageUrl: string | undefined;

    if (post.image?.url) {
      imageUrl = post.image.url;
    } else if (typeof post.image === 'string') {
      imageUrl = post.image;
    } else if (post.featuredImage) {
      imageUrl = typeof post.featuredImage === 'string' ? post.featuredImage : post.featuredImage?.url;
    } else if (post.thumbnail) {
      imageUrl = typeof post.thumbnail === 'string' ? post.thumbnail : post.thumbnail?.url;
    } else if (post.coverImage) {
      imageUrl = typeof post.coverImage === 'string' ? post.coverImage : post.coverImage?.url;
    }

    return {
      ...post,
      image: imageUrl ? { url: imageUrl, alt: post.image?.alt || post.title } : undefined,
    };
  }

  /**
   * Get list of all published blog posts
   */
  async getPosts(options?: { tag?: string; query?: string }): Promise<BlogPost[]> {
    try {
      let url = `${BASE_URL}/posts`;
      const params = new URLSearchParams();

      if (options?.tag) {
        params.append('tag', options.tag);
      }
      if (options?.query) {
        params.append('query', options.query);
      }

      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }

      console.log('📰 WispBlogService: Fetching posts from', url);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch posts: ${response.status}`);
      }

      const data = await response.json();
      console.log('📰 WispBlogService: Fetched', data.posts?.length || 0, 'posts');
      console.log('📰 WispBlogService: Sample post data:', JSON.stringify(data.posts?.[0], null, 2));

      // Normalize all posts
      const posts = (data.posts || []).map((post: any) => this.normalizePost(post));
      return posts;
    } catch (error) {
      console.error('📰 WispBlogService: Error fetching posts:', error);
      return [];
    }
  }

  /**
   * Get a single blog post by slug
   */
  async getPostBySlug(slug: string): Promise<BlogPost | null> {
    try {
      const url = `${BASE_URL}/posts/${slug}`;
      console.log('📰 WispBlogService: Fetching post:', slug);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch post: ${response.status}`);
      }

      const data = await response.json();
      console.log('📰 WispBlogService: Fetched post:', data.post?.title);
      console.log('📰 WispBlogService: Post content length:', data.post?.content?.length || 0);
      console.log('📰 WispBlogService: Full post data keys:', Object.keys(data.post || {}));
      console.log('📰 WispBlogService: Post content preview:', data.post?.content?.substring(0, 500));

      if (data.post) {
        return this.normalizePost(data.post);
      }
      return null;
    } catch (error) {
      console.error('📰 WispBlogService: Error fetching post:', error);
      return null;
    }
  }

  /**
   * Get list of all tags
   */
  async getTags(): Promise<BlogTag[]> {
    try {
      const url = `${BASE_URL}/tags`;
      console.log('📰 WispBlogService: Fetching tags');

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch tags: ${response.status}`);
      }

      const data = await response.json();
      console.log('📰 WispBlogService: Fetched', data.tags?.length || 0, 'tags');
      return data.tags || [];
    } catch (error) {
      console.error('📰 WispBlogService: Error fetching tags:', error);
      return [];
    }
  }

  /**
   * Search posts by multiple tags
   */
  async getPostsByTags(tags: string[]): Promise<BlogPost[]> {
    try {
      const params = new URLSearchParams();
      tags.forEach(tag => params.append('tag', tag));

      const url = `${BASE_URL}/posts?${params.toString()}`;
      console.log('📰 WispBlogService: Fetching posts by tags:', tags);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch posts: ${response.status}`);
      }

      const data = await response.json();
      return data.posts || [];
    } catch (error) {
      console.error('📰 WispBlogService: Error fetching posts by tags:', error);
      return [];
    }
  }

  /**
   * Full text search on blog posts
   */
  async searchPosts(query: string): Promise<BlogPost[]> {
    return this.getPosts({ query });
  }

  /**
   * Format reading time
   */
  formatReadingTime(minutes?: number): string {
    if (!minutes) return '';
    return `${minutes} min read`;
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  }
}

export default new WispBlogService();
