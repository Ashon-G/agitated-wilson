// Knowledge Base specific types
export interface FileUpload {
  id: string;
  name: string;
  size: number;
  type: string;
  uri: string;
  mimeType: string;
  uploadProgress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

export interface URLPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  status: 'loading' | 'loaded' | 'error';
  error?: string;
}

export interface KnowledgeUploadData {
  type: 'file' | 'url' | 'text' | 'onboarding_website' | 'onboarding_sales' | 'onboarding_pricing' | 'onboarding_faq' | 'onboarding_contact';
  title: string;
  description?: string;
  tags: string[];
  workspaceId: string;

  // File specific
  files?: FileUpload[];

  // URL specific
  url?: string;
  urlPreview?: URLPreview;

  // Text specific
  content?: string;

  // Onboarding specific
  isOnboardingData?: boolean;
  onboardingStep?: number;
  onboardingCategory?: string;
}