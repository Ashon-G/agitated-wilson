import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Conversation, ConversationMessage } from '../types/lead';

interface ConversationState {
  // Conversations
  conversations: Conversation[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;

  // Message actions
  addMessage: (conversationId: string, message: ConversationMessage) => void;
  markAsRead: (conversationId: string) => void;

  // Loading actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Selectors
  getConversationByLeadId: (leadId: string) => Conversation | undefined;
  getUnreadCount: () => number;
  getConversationsWithUnread: () => Conversation[];
}

const useConversationStore = create<ConversationState>()(
  persist(
    (set, get) => ({
      // Initial state
      conversations: [],
      isLoading: false,
      error: null,

      // Conversation actions
      setConversations: conversations => set({ conversations }),

      addConversation: conversation =>
        set(state => ({
          conversations: [conversation, ...state.conversations],
        })),

      updateConversation: (id, updates) =>
        set(state => ({
          conversations: state.conversations.map(conv =>
            conv.id === id ? { ...conv, ...updates, updatedAt: new Date() } : conv,
          ),
        })),

      // Message actions
      addMessage: (conversationId, message) =>
        set(state => ({
          conversations: state.conversations.map(conv =>
            conv.id === conversationId
              ? {
                ...conv,
                messages: [...conv.messages, message],
                lastMessageAt: new Date(),
                hasUnread: !message.isFromUser,
                updatedAt: new Date(),
              }
              : conv,
          ),
        })),

      markAsRead: conversationId =>
        set(state => ({
          conversations: state.conversations.map(conv =>
            conv.id === conversationId
              ? {
                ...conv,
                hasUnread: false,
                messages: conv.messages.map(msg => ({
                  ...msg,
                  readAt: msg.readAt || new Date(),
                })),
                updatedAt: new Date(),
              }
              : conv,
          ),
        })),

      // Loading actions
      setLoading: loading => set({ isLoading: loading }),
      setError: error => set({ error }),

      // Selectors
      getConversationByLeadId: leadId =>
        get().conversations.find(conv => conv.leadId === leadId),

      getUnreadCount: () =>
        get().conversations.filter(conv => conv.hasUnread).length,

      getConversationsWithUnread: () =>
        get().conversations.filter(conv => conv.hasUnread),
    }),
    {
      name: 'conversation-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        conversations: state.conversations,
      }),
    },
  ),
);

export default useConversationStore;
