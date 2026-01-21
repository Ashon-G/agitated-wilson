import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOpenAIClient } from '../api/openai';
import { AIMessage } from '../types/ai';
import useBrainStore from './brainStore';
import useWorkspaceStore from './workspaceStore';
import useProfileStore from './profileStore';
import useInboxStore from './inboxStore';
import useQuestStore from './questStore';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  workspaceId?: string;
}

interface ChatStore {
  chatInput: string;
  showAIChat: boolean;
  isProcessing: boolean;
  conversationHistory: ChatMessage[];
  currentProvider: 'openai' | 'anthropic' | 'grok';

  // Actions
  setChatInput: (input: string) => void;
  setShowAIChat: (show: boolean) => void;
  clearChatInput: () => void;
  submitChat: () => Promise<void>;
  processAIResponse: (userMessage: string) => Promise<string>;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearConversation: () => void;
  setProvider: (provider: 'openai' | 'anthropic' | 'grok') => void;
  getWorkspaceContext: () => Promise<string>;
  handleNavigationCommand: (userMessage: string) => string | null;
}

const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      chatInput: '',
      showAIChat: false,
      isProcessing: false,
      conversationHistory: [],
      currentProvider: 'openai',

      setChatInput: input => {
        set({ chatInput: input });
      },

      setShowAIChat: show => {
        set({ showAIChat: show });
      },

      clearChatInput: () => {
        set({ chatInput: '' });
      },

      setProvider: provider => {
        set({ currentProvider: provider });
      },

      addMessage: message => {
        const newMessage: ChatMessage = {
          ...message,
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
        };
        set(state => ({
          conversationHistory: [...state.conversationHistory, newMessage],
        }));
      },

      clearConversation: () => {
        set({ conversationHistory: [] });
      },

      getWorkspaceContext: async () => {
        const { currentWorkspace } = useWorkspaceStore.getState();
        const { profile } = useProfileStore.getState();
        const { knowledgeItems } = useBrainStore.getState();
        const { inboxItems } = useInboxStore.getState();
        const { quests, completedQuests, totalQuests } = useQuestStore.getState();

        if (!currentWorkspace || !profile) return '';

        try {
          // Get relevant knowledge from workspace
          const workspaceKnowledge = knowledgeItems
            .filter(item => item.workspaceId === currentWorkspace.id)
            .slice(0, 5); // Limit context

          // Get recent inbox items (last 5)
          const recentInbox = inboxItems
            .filter(item => item.workspaceId === currentWorkspace.id || !item.workspaceId)
            .slice(0, 5);

          // Get incomplete quests
          const incompleteQuests = quests.filter(q => !q.isCompleted).slice(0, 3);

          let context = `You are ${profile.onboardingData?.assignedAgentId ? profile.onboardingData.assignedAgentId.charAt(0).toUpperCase() + profile.onboardingData.assignedAgentId.slice(1) : 'Tava AI'}, an intelligent assistant for ${profile.name}'s workspace "${currentWorkspace.name}".

You are friendly, helpful, and knowledgeable about the user's business and their goals. Keep responses concise and actionable.`;

          // Add app capabilities context
          context += `\n\nThis app has the following key capabilities that you should know about:

1. **Autonomous Reddit Lead Hunting**: The app includes an automated Reddit agent that actively monitors subreddits, finds potential leads, and engages with them. When users connect their Reddit account, the agent:
   - Automatically searches for relevant discussions in targeted subreddits
   - Identifies potential leads based on their business and target market
   - Engages authentically by commenting and answering questions
   - Sends notifications to the user's inbox when leads are found or when the agent needs guidance
   - Learns from user feedback to improve lead qualification over time

2. **Knowledge Base Integration**: Users can upload business documents, product information, FAQs, and sales materials. The agent uses this knowledge to respond intelligently to leads.

3. **Inbox System**: All agent activities, questions, and potential leads appear in the user's inbox for review and action.

4. **Integration Hub**: Users can connect Reddit, Box (file storage), and other services to enhance the agent's capabilities.`;

          if (currentWorkspace.description) {
            context += `\n\nWorkspace description: ${currentWorkspace.description}.`;
          }

          if (profile.businessInfo) {
            context += `\n\nBusiness: ${profile.businessInfo.businessName} - ${profile.businessInfo.productDescription}.`;
            context += ` Target market: ${profile.businessInfo.targetMarket}.`;
          }

          // Check if Reddit is connected
          const hasRedditConnected = profile.redditAccount?.isActive;
          if (hasRedditConnected) {
            context += '\n\n✅ Reddit account is connected. The autonomous lead hunting agent is ready to find and engage with potential leads automatically.';
          } else {
            context += '\n\n⚠️ Reddit account is not yet connected. Once connected, the autonomous agent will actively hunt for leads 24/7.';
          }

          if (workspaceKnowledge.length > 0) {
            context += '\n\n**Knowledge Base:**\n';
            workspaceKnowledge.forEach(item => {
              context += `- ${item.title}: ${item.description || item.content?.slice(0, 100) || 'No description'}\n`;
            });
          }

          // Add inbox context
          if (recentInbox.length > 0) {
            context += `\n\n**Recent Inbox Activity (${recentInbox.length} items):**\n`;
            recentInbox.forEach(item => {
              const status = item.completed ? 'completed' : 'pending';
              context += `- [${status}] ${item.type}: ${item.title || item.content?.slice(0, 50) || 'No title'}\n`;
            });
          }

          // Add quests context
          if (totalQuests > 0) {
            context += `\n\n**Quests Progress:** ${completedQuests}/${totalQuests} completed`;
            if (incompleteQuests.length > 0) {
              context += '\n**Upcoming Quests:**\n';
              incompleteQuests.forEach(quest => {
                context += `- ${quest.title}: ${quest.question?.slice(0, 80) || ''}\n`;
              });
            }
          }

          context +=
            '\n\nIMPORTANT: When users ask about lead generation or Reddit integration, explain the ACTUAL autonomous agent capabilities of this app, not generic advice. Be specific about what the app does automatically.';
          return context;
        } catch (error) {
          console.log('Error getting workspace context');
          return 'You are Tava AI, an intelligent assistant for an autonomous lead generation app. This app includes a Reddit lead hunting agent that automatically finds and engages with potential customers.';
        }
      },

      processAIResponse: async (userMessage: string) => {
        const { conversationHistory, getWorkspaceContext } = get();

        // Check for navigation commands first (fallback for when AI is unavailable)
        const navigationResponse = get().handleNavigationCommand(userMessage);
        if (navigationResponse) {
          return navigationResponse;
        }

        try {
          // Get workspace context (includes knowledge, inbox, and quests)
          const systemContext = await getWorkspaceContext();

          // Build conversation messages
          const messages: AIMessage[] = [
            { role: 'system', content: systemContext },
            ...conversationHistory.slice(-8).map(msg => ({
              role: msg.role as 'user' | 'assistant',
              content: msg.content,
            })),
            { role: 'user', content: userMessage },
          ];

          // Get AI response from OpenAI
          const client = getOpenAIClient();
          const response = await client.chat.completions.create({
            model: 'gpt-4o-2024-11-20',
            messages,
            temperature: 0.7,
            max_tokens: 1024,
          });

          const content = response.choices[0]?.message?.content || '';

          // Validate response
          if (!content || content.trim() === '') {
            throw new Error('AI returned empty response');
          }

          return content;
        } catch (error) {
          // More specific error handling
          if (error instanceof Error) {
            const errorMessage = String(error.message || '');

            // Log the actual error for debugging
            console.log('AI processing failed:', errorMessage);

            if (
              errorMessage.includes('API key') ||
              errorMessage.includes('authentication') ||
              errorMessage.includes('401') ||
              errorMessage.includes('Unauthorized')
            ) {
              return "I'm having trouble connecting to the AI service right now. This might be due to API configuration. Please contact support if this persists.";
            } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
              return "I'm experiencing network issues. Please check your internet connection and try again.";
            } else if (errorMessage.includes('429')) {
              return "I'm experiencing high demand right now. Please wait a moment and try again.";
            } else if (errorMessage.includes('400')) {
              return 'I had trouble understanding that request. Please try rephrasing your message.';
            } else if (errorMessage.includes('403')) {
              return 'I don\'t have permission to access the AI service. Please check your API configuration.';
            } else if (errorMessage.includes('500') || errorMessage.includes('503')) {
              return 'The AI service is temporarily unavailable. Please try again in a moment.';
            } else if (errorMessage.includes('Gemini API error')) {
              // Extract and show the actual error for debugging
              return `I encountered an issue: ${errorMessage.slice(0, 200)}. Please try again.`;
            }
          }

          // Return a user-friendly error message instead of throwing
          return 'I apologize, but I encountered an error processing your message. Please try again, or contact support if this persists.';
        }
      },

      handleNavigationCommand: (userMessage: string) => {
        const message = userMessage.toLowerCase();

        // Common navigation commands
        if (message.includes('knowledge') && (message.includes('hub') || message.includes('base'))) {
          return "I'll help you navigate to the knowledge hub. You can access it from the main navigation menu or brain section of the app where you can manage your knowledge base items.";
        }

        if (message.includes('workspace')) {
          return 'To manage workspaces, you can access the workspace section from the main navigation. There you can create new workspaces, switch between them, and modify workspace settings.';
        }

        if (message.includes('history')) {
          return 'Your conversation history can be found in the History tab. This keeps track of all your previous AI conversations and interactions.';
        }

        if (message.includes('profile') || message.includes('settings')) {
          return 'Your profile and settings can be accessed from the Profile tab in the main navigation where you can update your business information and preferences.';
        }

        if (message.includes('inbox')) {
          return 'The inbox contains your agent activities and notifications. You can find it in the main navigation under the Inbox section.';
        }

        if (message.includes('home')) {
          return "You can return to the home screen using the Home tab in the main navigation, where you'll find your dashboard and overview.";
        }

        // Generic help for navigation
        if (
          message.includes('go to') ||
          message.includes('take me to') ||
          message.includes('navigate')
        ) {
          return 'I can help you navigate the app! The main sections include: Home, Brain AI (knowledge hub), Workspaces, History, Inbox, and Profile. You can access these through the navigation menu.';
        }

        return null;
      },

      submitChat: async () => {
        const { chatInput, addMessage, processAIResponse } = get();
        if (!chatInput.trim()) return;

        const userMessage = chatInput.trim();

        try {
          set({ isProcessing: true });

          // Add user message
          addMessage({
            role: 'user',
            content: userMessage,
            workspaceId: useWorkspaceStore.getState().currentWorkspace?.id,
          });

          // Clear input
          set({ chatInput: '' });

          // Process AI response
          const aiResponse = await processAIResponse(userMessage);

          // Add AI response
          addMessage({
            role: 'assistant',
            content: aiResponse,
            workspaceId: useWorkspaceStore.getState().currentWorkspace?.id,
          });
        } catch (error) {
          console.log('Chat submission error occurred');
          addMessage({
            role: 'assistant',
            content:
              'I apologize, but I encountered an error processing your message. Please try again.',
            workspaceId: useWorkspaceStore.getState().currentWorkspace?.id,
          });
        } finally {
          set({ isProcessing: false });
        }
      },
    }),
    {
      name: 'chat-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        conversationHistory: state.conversationHistory,
      }),
    },
  ),
);

export default useChatStore;
