import { create } from 'zustand';
import {
  InboxItem,
  Memory,
} from '../types/app';
import BackendService from '../services/BackendService';
import AuthenticationService from '../services/AuthenticationService';
import RedditAPIService, { RedditMessage } from '../services/RedditAPIService';
import { db } from '../config/firebase';
import { collection, query, where, orderBy, onSnapshot, Timestamp, limit } from 'firebase/firestore';

/**
 * Safely convert various date formats to a Date object
 * Handles Firestore Timestamps, numbers (Unix timestamps), Date objects, and strings
 */
function toSafeDate(value: unknown): Date {
  if (!value) return new Date();

  // Firestore Timestamp
  if (value instanceof Timestamp) {
    return value.toDate();
  }

  // Check for Firestore Timestamp-like object with toDate method
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: unknown }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }

  // Already a Date
  if (value instanceof Date) {
    return value;
  }

  // Unix timestamp in seconds (Firestore sometimes stores as seconds)
  if (typeof value === 'number') {
    // If the number is small enough, it's likely seconds; otherwise milliseconds
    return value < 1e12 ? new Date(value * 1000) : new Date(value);
  }

  // String date
  if (typeof value === 'string') {
    return new Date(value);
  }

  // Firestore Timestamp stored as plain object with seconds/nanoseconds
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }

  return new Date();
}

interface InboxStore {
  inboxItems: InboxItem[];
  memories: Memory[];
  isLoading: boolean;
  isLoadingMore: boolean;
  lastRefreshAt: Date | null;
  currentWorkspaceId: string | null;

  // Pagination state
  hasMoreFirestoreItems: boolean;
  lastFirestoreDoc: any | null;
  firestorePageSize: number;

  // Computed notification count (cached to avoid expensive filtering in UI)
  notificationCount: number;

  // Multi-select state
  isMultiSelectMode: boolean;
  selectedItemIds: string[];

  // Listener state
  activeListeners: string[];

  // Cleanup functions stored properly in state
  _pollInterval: ReturnType<typeof setInterval> | null;
  _unsubscribeAgentInbox: (() => void) | null;
  _unsubscribeInbox: (() => void) | null;

  // Actions
  loadInboxItems: (workspaceId: string, reset?: boolean) => Promise<void>;
  loadMoreInboxItems: (workspaceId: string) => Promise<void>;
  setupRealtimeListeners: (workspaceId: string) => void;
  cleanupListeners: () => void;
  refreshRedditMessages: () => Promise<void>;
  addInboxItem: (item: Omit<InboxItem, 'id' | 'createdAt'>) => Promise<void>;
  updateInboxItem: (id: string, updates: Partial<InboxItem>) => Promise<void>;
  deleteInboxItem: (id: string) => Promise<void>;
  markMessageAsRead: (id: string) => Promise<void>;
  markAsResponded: (id: string) => Promise<void>;
  sendReply: (messageId: string, text: string) => Promise<boolean>;
  getInboxByWorkspace: (workspaceId: string) => InboxItem[];
  getActiveInboxItems: (workspaceId?: string) => InboxItem[];
  getPendingItems: (workspaceId?: string) => InboxItem[];
  getAgentQuestions: (workspaceId?: string) => InboxItem[];
  getAgentActivities: (workspaceId?: string) => InboxItem[];
  clearAllInboxItems: () => Promise<number>;

  // Multi-select actions
  enableMultiSelect: () => void;
  disableMultiSelect: () => void;
  toggleItemSelection: (id: string) => void;
  selectAllItems: (items: InboxItem[]) => void;
  clearSelection: () => void;
  massApproveSelected: () => Promise<void>;
  massRejectSelected: () => Promise<void>;

  // Comment approval actions
  approveComment: (pendingCommentId: string) => Promise<boolean>;
  rejectComment: (pendingCommentId: string) => Promise<boolean>;

  // Legacy compatibility methods (no-ops)
  answerAgentQuestion: (id: string, userResponse: any) => Promise<void>;
  approveRequest: (id: string, approved: boolean, notes?: string) => Promise<void>;
  submitLearningFeedback: (id: string, answer: string) => Promise<void>;

  loadMemories: (workspaceId: string) => Promise<void>;
  addMemory: (memory: Omit<Memory, 'id' | 'createdAt'>) => Promise<void>;
  updateMemory: (id: string, updates: Partial<Memory>) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  getMemoriesByWorkspace: (workspaceId: string) => Memory[];
}

/**
 * Helper to compute notification count from inbox items
 * Counts high-priority pending items in the current workspace
 */
function computeNotificationCount(items: InboxItem[], workspaceId: string | null): number {
  let count = 0;
  for (const item of items) {
    const isInWorkspace = !workspaceId || item.workspaceId === workspaceId;
    if (!isInWorkspace) continue;

    const isPending = item.status === 'pending';
    if (!isPending) continue;

    const isHighPriority =
      item.type === 'agent_question' ||
      item.priority === 'urgent' ||
      item.priority === 'high' ||
      item.type === 'approval_request';

    if (isHighPriority) count++;
  }
  return count;
}

const useInboxStore = create<InboxStore>((set, get) => ({
  inboxItems: [],
  memories: [],
  isLoading: false,
  isLoadingMore: false,
  lastRefreshAt: null,
  currentWorkspaceId: null,

  // Pagination state
  hasMoreFirestoreItems: true,
  lastFirestoreDoc: null,
  firestorePageSize: 20,

  // Computed notification count (updated when items change)
  notificationCount: 0,

  isMultiSelectMode: false,
  selectedItemIds: [],
  activeListeners: [],

  // Cleanup function refs - properly typed in state
  _pollInterval: null,
  _unsubscribeAgentInbox: null,
  _unsubscribeInbox: null,

  /**
   * Setup real-time listeners for Reddit messages and agent_inbox ONLY
   * NO listener for inbox collection - we use pagination instead
   */
  setupRealtimeListeners: (workspaceId: string) => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) return;

    // Skip if already set up for this workspace
    const state = get();
    if (state.activeListeners.length > 0 && state.currentWorkspaceId === workspaceId) {
      console.log('🔴 [InboxStore] Listeners already active for workspace, skipping');
      return;
    }

    // Clean up any existing listeners first
    get().cleanupListeners();

    // Store the workspace ID for use in refreshRedditMessages
    set({ currentWorkspaceId: workspaceId });

    console.log('🔴 [InboxStore] Setting up minimal real-time listeners');

    // Poll Reddit API for new messages every 60 seconds
    const pollInterval = setInterval(async () => {
      await get().refreshRedditMessages();
    }, 60000);

    // Initial Reddit fetch after short delay
    setTimeout(() => {
      get().refreshRedditMessages();
    }, 1000);

    // Set up Firestore listener for agent_inbox ONLY (comment approvals that need immediate attention)
    // This is a small collection so it's OK to listen to it
    console.log('🔴 [InboxStore] Setting up agent_inbox listener for user:', user.uid);

    let isFirstAgentInboxSnapshot = true;
    const agentInboxQuery = query(
      collection(db, 'agent_inbox'),
      where('userId', '==', user.uid),
      where('status', '==', 'pending'),
      limit(20),
    );

    const unsubscribeAgentInbox = onSnapshot(
      agentInboxQuery,
      (snapshot) => {
        // Skip the initial snapshot - loadInboxItems already loaded data
        if (isFirstAgentInboxSnapshot) {
          isFirstAgentInboxSnapshot = false;
          console.log('📬 [InboxStore] agent_inbox: skipping initial snapshot');
          return;
        }

        // Only process actual changes after initial load
        const changes = snapshot.docChanges();
        if (changes.length === 0) return;

        console.log(`📬 [InboxStore] agent_inbox update: ${changes.length} changes`);

        changes.forEach((change) => {
          const { doc } = change;
          const data = doc.data();

          const inboxItem: InboxItem = {
            id: `agent_inbox_${doc.id}`,
            userId: user.uid,
            workspaceId: workspaceId,
            type: 'comment_approval',
            title: `Comment ready for ${data.post?.subreddit || 'approval'}`,
            content: data.comment?.text || '',
            status: data.status || 'pending',
            priority: 'high',
            createdAt: toSafeDate(data.createdAt),
            agentName: 'AI Agent',
            tags: ['comment_approval', data.post?.subreddit].filter(Boolean),
            completed: false,
            pendingCommentId: data.pendingCommentId,
            post: data.post,
            comment: data.comment,
            aiQualityCheck: data.aiQualityCheck,
            relatedLeadId: data.leadId,
          };

          if (change.type === 'added') {
            set(state => {
              const exists = state.inboxItems.some(item => item.id === inboxItem.id);
              if (exists) return state;
              const newItems = [inboxItem, ...state.inboxItems];
              return {
                inboxItems: newItems,
                notificationCount: computeNotificationCount(newItems, state.currentWorkspaceId),
              };
            });
          } else if (change.type === 'modified') {
            set(state => {
              const newItems = state.inboxItems.map(item =>
                item.id === inboxItem.id ? inboxItem : item,
              );
              return {
                inboxItems: newItems,
                notificationCount: computeNotificationCount(newItems, state.currentWorkspaceId),
              };
            });
          } else if (change.type === 'removed') {
            set(state => {
              const newItems = state.inboxItems.filter(item => item.id !== inboxItem.id);
              return {
                inboxItems: newItems,
                notificationCount: computeNotificationCount(newItems, state.currentWorkspaceId),
              };
            });
          }
        });
      },
      (error) => {
        console.error('❌ [InboxStore] agent_inbox listener error:', error);
      },
    );

    // NO listener for inbox collection - pagination handles it
    // This prevents loading 50+ items on every tab switch

    // Store cleanup refs
    set({
      activeListeners: ['reddit_poll', 'agent_inbox'],
      _pollInterval: pollInterval,
      _unsubscribeAgentInbox: unsubscribeAgentInbox,
      _unsubscribeInbox: null,
    });

    return () => {
      clearInterval(pollInterval);
      unsubscribeAgentInbox();
    };
  },

  cleanupListeners: () => {
    const state = get();
    console.log('🧹 [InboxStore] Cleaning up', state.activeListeners.length, 'listeners');

    // Clean up poll interval
    if (state._pollInterval) {
      clearInterval(state._pollInterval);
    }

    // Clean up agent_inbox Firestore listener
    if (state._unsubscribeAgentInbox) {
      state._unsubscribeAgentInbox();
    }

    // Clean up inbox collection Firestore listener
    if (state._unsubscribeInbox) {
      state._unsubscribeInbox();
    }

    set({
      activeListeners: [],
      _pollInterval: null,
      _unsubscribeAgentInbox: null,
      _unsubscribeInbox: null,
    });
  },

  /**
   * Load inbox items from Firestore with pagination
   * Does NOT refresh Reddit messages - that's handled by polling
   */
  loadInboxItems: async (workspaceId, reset = true) => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) return;

    // Skip if already loading or if we have data for this workspace and not resetting
    const state = get();
    if (state.isLoading) {
      console.log('📥 [InboxStore] Skipping load - already loading');
      return;
    }

    // If we already have items for this workspace and not forcing reset, skip
    if (!reset && state.currentWorkspaceId === workspaceId && state.inboxItems.length > 0) {
      console.log('📥 [InboxStore] Skipping load - already have data for workspace');
      return;
    }

    try {
      set({ isLoading: true, currentWorkspaceId: workspaceId });

      const pageSize = state.firestorePageSize;

      console.log('📥 [InboxStore] Loading inbox items for workspace:', workspaceId, 'pageSize:', pageSize);

      // Load approval requests and other inbox items from Firestore with pagination
      const firestoreItems = await BackendService.queryCollection<InboxItem>('inbox', {
        where: [
          { field: 'userId', operator: '==', value: user.uid },
          { field: 'workspaceId', operator: '==', value: workspaceId },
        ],
        limit: pageSize + 1, // Fetch one extra to check if there are more
      });

      // Sort by createdAt descending (newest first) in JavaScript
      firestoreItems.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      // Check if there are more items
      const hasMore = firestoreItems.length > pageSize;
      const itemsToUse = hasMore ? firestoreItems.slice(0, pageSize) : firestoreItems;
      const lastDoc = itemsToUse.length > 0 ? itemsToUse[itemsToUse.length - 1] : null;

      console.log(`📥 [InboxStore] Loaded ${itemsToUse.length} items from Firestore inbox collection, hasMore: ${hasMore}`);

      // Update state with Firestore items
      set(currentState => {
        // Keep Reddit items (they're refreshed separately)
        const redditItems = currentState.inboxItems.filter(item => item.id.startsWith('reddit_'));
        // Keep agent_inbox items (they're from real-time listener)
        const agentInboxItems = currentState.inboxItems.filter(item => item.id.startsWith('agent_inbox_'));

        // Combine all items and deduplicate by id
        const allItems = [...redditItems, ...agentInboxItems, ...itemsToUse];
        const seenIds = new Set<string>();
        const uniqueItems = allItems.filter(item => {
          if (seenIds.has(item.id)) return false;
          seenIds.add(item.id);
          return true;
        });

        return {
          inboxItems: uniqueItems,
          hasMoreFirestoreItems: hasMore,
          lastFirestoreDoc: lastDoc,
          isLoading: false,
          notificationCount: computeNotificationCount(uniqueItems, workspaceId),
        };
      });
    } catch (error) {
      console.error('❌ [InboxStore] Failed to load inbox items:', error);
      set({ isLoading: false });
    }
  },

  /**
   * Load more inbox items (pagination) - uses cursor-based pagination
   */
  loadMoreInboxItems: async (workspaceId) => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) return;

    const { hasMoreFirestoreItems, lastFirestoreDoc, isLoadingMore, firestorePageSize, inboxItems } = get();

    // Don't load more if already loading or no more items
    if (isLoadingMore || !hasMoreFirestoreItems || !lastFirestoreDoc) {
      console.log('📥 [InboxStore] Skipping loadMore - isLoadingMore:', isLoadingMore, 'hasMore:', hasMoreFirestoreItems);
      return;
    }

    try {
      set({ isLoadingMore: true });

      console.log('📥 [InboxStore] Loading more inbox items with cursor...');

      // Get the timestamp of the last item for cursor-based pagination
      const lastTimestamp = new Date(lastFirestoreDoc.createdAt);

      // Use startAfter for true cursor-based pagination - fetch only items we don't have
      const firestoreItems = await BackendService.queryCollection<InboxItem>('inbox', {
        where: [
          { field: 'userId', operator: '==', value: user.uid },
          { field: 'workspaceId', operator: '==', value: workspaceId },
          { field: 'createdAt', operator: '<', value: lastTimestamp },
        ],
        limit: firestorePageSize + 1,
      });

      // Sort by createdAt descending (newest first)
      firestoreItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Check if there are more items
      const hasMore = firestoreItems.length > firestorePageSize;
      const itemsToUse = hasMore ? firestoreItems.slice(0, firestorePageSize) : firestoreItems;
      const newLastDoc = itemsToUse.length > 0 ? itemsToUse[itemsToUse.length - 1] : null;

      console.log(`📥 [InboxStore] Loaded ${itemsToUse.length} more items, hasMore: ${hasMore}`);

      // Merge with existing items - only add new ones
      set(state => {
        const existingIds = new Set(state.inboxItems.map(item => item.id));
        const newItems = itemsToUse.filter(item => !existingIds.has(item.id));
        const allItems = [...state.inboxItems, ...newItems];

        return {
          inboxItems: allItems,
          hasMoreFirestoreItems: hasMore && itemsToUse.length > 0,
          lastFirestoreDoc: newLastDoc,
          isLoadingMore: false,
          notificationCount: computeNotificationCount(allItems, state.currentWorkspaceId),
        };
      });
    } catch (error) {
      console.error('❌ [InboxStore] Failed to load more inbox items:', error);
      set({ isLoadingMore: false });
    }
  },

  /**
   * Refresh Reddit messages from API
   * Fetches comment replies and DMs directly from Reddit
   * Groups DMs by conversation (same author) to show as unified threads
   */
  refreshRedditMessages: async () => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) return;

    // Debounce: skip if refreshed within last 5 seconds
    const state = get();
    const now = new Date();
    if (state.lastRefreshAt && now.getTime() - state.lastRefreshAt.getTime() < 5000) {
      console.log('🔄 [InboxStore] Skipping refresh - debounced (last refresh was < 5s ago)');
      return;
    }

    try {
      set({ lastRefreshAt: now });
      console.log('🔄 [InboxStore] Refreshing Reddit messages...');

      // Check if Reddit is connected before fetching
      const RedditConnectionService = (await import('../services/RedditConnectionService')).default;
      const isConnected = await RedditConnectionService.hasActiveConnection();

      if (!isConnected) {
        console.log('ℹ️ [InboxStore] Reddit not connected, skipping message fetch');
        return;
      }

      // Fetch messages from Reddit API with reduced limit for initial load
      const [inboxResponse, sentResponse] = await Promise.all([
        RedditAPIService.fetchAllMessages(25),
        RedditAPIService.fetchSentMessages(25),
      ]);

      if (!inboxResponse.success || !inboxResponse.data) {
        // Only log as warning if it's a 403 (likely not connected)
        if (inboxResponse.error?.includes('403')) {
          console.log('ℹ️ [InboxStore] Reddit API returned 403 - connection may have expired');
        } else {
          console.warn('⚠️ [InboxStore] Failed to fetch Reddit messages:', inboxResponse.error);
        }
        return;
      }

      const inboxMessages = inboxResponse.data;
      const sentMessages = sentResponse.success && sentResponse.data ? sentResponse.data : [];

      console.log(`✅ [InboxStore] Fetched ${inboxMessages.length} inbox messages, ${sentMessages.length} sent messages`);

      // Get the current workspace ID
      const workspaceId = get().currentWorkspaceId || '';
      console.log(`📍 [InboxStore] Using workspace ID: ${workspaceId}`);

      // Group DMs by conversation (based on author for received, or first_message_name for threads)
      // For private messages, group by the other person's username
      const dmConversations = new Map<string, RedditMessage[]>();
      const otherMessages: RedditMessage[] = [];

      // Add inbox messages
      inboxMessages.forEach((msg: RedditMessage) => {
        // Skip messages with null/undefined author
        if (!msg.author) {
          console.log('⚠️ [InboxStore] Skipping message with null author:', msg.id);
          return;
        }

        if (msg.type === 'private_message') {
          // Group by author (the person who sent the DM)
          const conversationKey = msg.author.toLowerCase();
          if (!dmConversations.has(conversationKey)) {
            dmConversations.set(conversationKey, []);
          }
          dmConversations.get(conversationKey)!.push(msg);
        } else {
          otherMessages.push(msg);
        }
      });

      // Add sent messages to conversations
      sentMessages.forEach((msg: RedditMessage) => {
        // Skip messages with null/undefined author
        if (!msg.author) {
          console.log('⚠️ [InboxStore] Skipping sent message with null author:', msg.id);
          return;
        }

        if (msg.type === 'private_message') {
          // For sent messages, msg.author is the recipient (the other person)
          const conversationKey = msg.author.toLowerCase();
          if (!dmConversations.has(conversationKey)) {
            dmConversations.set(conversationKey, []);
          }
          // Mark sent messages with a flag
          dmConversations.get(conversationKey)!.push({ ...msg, isSent: true } as any);
        }
      });

      // Convert DM conversations to InboxItems (one per conversation)
      const dmInboxItems: InboxItem[] = [];
      dmConversations.forEach((messages, author) => {
        // Sort messages by timestamp (oldest first for conversation history)
        messages.sort((a, b) => a.created - b.created);

        // The most recent message determines unread status
        const mostRecentMessage = messages[messages.length - 1];
        const hasUnread = messages.some(m => m.new);

        // Build conversation history
        const conversationHistory = messages.map(m => ({
          id: `reddit_msg_${m.id}`,
          content: m.body,
          isUser: (m as any).isSent === true,
          timestamp: new Date(m.created * 1000),
          agentName: (m as any).isSent ? 'You' : `u/${m.author}`,
        }));

        dmInboxItems.push({
          id: `reddit_dm_${author}`,
          userId: user.uid,
          workspaceId,
          type: 'reddit_message',
          title: `DM with u/${author}`,
          content: mostRecentMessage.body,
          status: hasUnread ? 'pending' : 'resolved',
          priority: 'medium',
          createdAt: new Date(messages[0].created * 1000), // First message time
          agentName: 'Reddit',
          tags: ['DM', 'private'],
          completed: !hasUnread,
          conversationHistory,
          metadata: {
            redditMessageId: mostRecentMessage.id,
            messageType: 'private_message',
            author: author,
            conversationAuthor: author,
            messageCount: messages.length,
            lastMessageTime: mostRecentMessage.created,
            // Store all message IDs for marking as read
            allMessageIds: messages.filter(m => !(m as any).isSent).map(m => m.id),
          },
        } as InboxItem);
      });

      // Convert other messages (replies) to individual InboxItems
      // Filter out messages with null authors
      const replyInboxItems: InboxItem[] = otherMessages
        .filter((msg: RedditMessage) => msg.author !== null && msg.author !== undefined)
        .map((msg: RedditMessage) => {
          const title = `Reply from u/${msg.author}`;

          return {
            id: `reddit_${msg.id}`,
            userId: user.uid,
            workspaceId,
            type: 'reddit_message',
            title,
            content: msg.body,
            status: msg.new ? 'pending' : 'resolved',
            priority: 'medium',
            createdAt: new Date(msg.created * 1000),
            agentName: 'Reddit',
            tags: ['Reply', msg.subreddit || 'reddit'].filter(Boolean),
            completed: !msg.new,
            metadata: {
              redditMessageId: msg.id,
              messageType: msg.type,
              author: msg.author,
              subreddit: msg.subreddit,
              context: msg.context,
              parentId: msg.parentId,
              linkId: msg.linkId,
              postTitle: msg.postTitle,
            },
          };
        });

      const redditInboxItems = [...dmInboxItems, ...replyInboxItems];

      // Merge with existing items, preserving local conversation history
      set(state => {
        // Create a map of existing Reddit items to preserve their conversation history
        const existingRedditItemsMap = new Map<string, InboxItem>();
        state.inboxItems.forEach(item => {
          if (item.id.startsWith('reddit_')) {
            existingRedditItemsMap.set(item.id, item);
          }
        });

        // Get non-Reddit items
        const nonRedditItems = state.inboxItems.filter(
          item => !item.id.startsWith('reddit_'),
        );

        // Merge new Reddit items with existing ones, preserving conversation history
        const mergedRedditItems = redditInboxItems.map(newItem => {
          const existingItem = existingRedditItemsMap.get(newItem.id);
          if (existingItem && existingItem.conversationHistory && existingItem.conversationHistory.length > 0) {
            // Preserve the existing conversation history (user's messages)
            // But merge in any new messages from the API
            const existingMsgIds = new Set(existingItem.conversationHistory.map((msg: any) => msg.id));
            const newApiMessages = (newItem.conversationHistory || []).filter(
              (msg: any) => !existingMsgIds.has(msg.id),
            );
            return {
              ...newItem,
              conversationHistory: [...existingItem.conversationHistory, ...newApiMessages],
              // Also preserve any user response data
              userResponse: existingItem.userResponse || newItem.userResponse,
              status: existingItem.status || newItem.status,
              completed: existingItem.completed || newItem.completed,
            };
          }
          return newItem;
        });

        const allItems = [...nonRedditItems, ...mergedRedditItems];

        // Deduplicate by id
        const seenIds = new Set<string>();
        const uniqueItems = allItems.filter(item => {
          if (seenIds.has(item.id)) return false;
          seenIds.add(item.id);
          return true;
        });

        uniqueItems.sort((a, b) => {
          // Sort by most recent activity for DMs
          const aTime = (a as any).metadata?.lastMessageTime
            ? (a as any).metadata.lastMessageTime * 1000
            : new Date(a.createdAt).getTime();
          const bTime = (b as any).metadata?.lastMessageTime
            ? (b as any).metadata.lastMessageTime * 1000
            : new Date(b.createdAt).getTime();
          return bTime - aTime;
        });

        return {
          inboxItems: uniqueItems,
          lastRefreshAt: new Date(),
          notificationCount: computeNotificationCount(uniqueItems, state.currentWorkspaceId),
        };
      });
    } catch (error) {
      console.error('❌ [InboxStore] Error refreshing Reddit messages:', error);
    }
  },

  /**
   * Update an inbox item
   */
  updateInboxItem: async (id, updates) => {
    try {
      // Only update local state for Reddit messages
      // Reddit messages are ephemeral and don't need Firestore persistence
      if (id.startsWith('reddit_')) {
        set(state => {
          const newItems = state.inboxItems.map(item => (item.id === id ? { ...item, ...updates } : item));
          return {
            inboxItems: newItems,
            notificationCount: computeNotificationCount(newItems, state.currentWorkspaceId),
          };
        });
        return;
      }

      // For non-Reddit items, update Firestore
      const existingDoc = await BackendService.getDocument<InboxItem>('inbox', id);

      if (existingDoc) {
        await BackendService.updateDocument<InboxItem>('inbox', id, updates);
      } else {
        console.warn(`Inbox item ${id} not found in Firestore, updating local state only`);
      }

      // Update local state
      set(state => {
        const newItems = state.inboxItems.map(item => (item.id === id ? { ...item, ...updates } : item));
        return {
          inboxItems: newItems,
          notificationCount: computeNotificationCount(newItems, state.currentWorkspaceId),
        };
      });
    } catch (error) {
      console.error('Failed to update inbox item:', error);
      // Update local state even if Firestore fails
      set(state => {
        const newItems = state.inboxItems.map(item => (item.id === id ? { ...item, ...updates } : item));
        return {
          inboxItems: newItems,
          notificationCount: computeNotificationCount(newItems, state.currentWorkspaceId),
        };
      });
    }
  },

  /**
   * Delete an inbox item
   */
  deleteInboxItem: async (id) => {
    try {
      // For Reddit messages, just remove from local state
      if (id.startsWith('reddit_')) {
        set(state => {
          const newItems = state.inboxItems.filter(item => item.id !== id);
          return {
            inboxItems: newItems,
            notificationCount: computeNotificationCount(newItems, state.currentWorkspaceId),
          };
        });
        return;
      }

      // For Firestore items, delete from backend
      await BackendService.deleteDocument('inbox', id);

      set(state => {
        const newItems = state.inboxItems.filter(item => item.id !== id);
        return {
          inboxItems: newItems,
          notificationCount: computeNotificationCount(newItems, state.currentWorkspaceId),
        };
      });
    } catch (error) {
      console.error('Failed to delete inbox item from Firestore:', error);
      throw error;
    }
  },

  /**
   * Mark a Reddit message as read
   * For DM conversations, marks all messages in the conversation as read
   */
  markMessageAsRead: async (id) => {
    try {
      const item = get().inboxItems.find(i => i.id === id);

      if (!item) {
        console.error('Message not found:', id);
        return;
      }

      const metadata = (item as any).metadata || {};

      // Check if this is a DM conversation (has allMessageIds)
      if (metadata.allMessageIds && Array.isArray(metadata.allMessageIds)) {
        // Mark all messages in the conversation as read
        console.log(`📬 [InboxStore] Marking ${metadata.allMessageIds.length} messages as read...`);
        for (const msgId of metadata.allMessageIds) {
          await RedditAPIService.markMessageAsRead(msgId);
        }
      } else {
        // Single message - extract Reddit message ID
        const redditMessageId = metadata.redditMessageId || id.replace('reddit_', '');
        await RedditAPIService.markMessageAsRead(redditMessageId);
      }

      // Update local state
      await get().updateInboxItem(id, {
        status: 'resolved',
        completed: true,
      });
    } catch (error) {
      console.error('Failed to mark message as read:', error);
    }
  },

  /**
   * Mark a message as responded
   */
  markAsResponded: async (id) => {
    try {
      await get().updateInboxItem(id, {
        status: 'responded',
        respondedAt: new Date(),
      });
    } catch (error) {
      console.error('Failed to mark as responded:', error);
    }
  },

  /**
   * Send a reply to a Reddit message
   */
  sendReply: async (messageId, text) => {
    try {
      // Extract the parent thing ID from metadata
      const item = get().inboxItems.find(i => i.id === messageId);

      if (!item || !(item as any).metadata) {
        console.error('Message not found or missing metadata');
        return false;
      }

      const { metadata } = item as any;
      const parentId = metadata.parentId || metadata.redditMessageId;

      if (!parentId) {
        console.error('No parent ID found for reply');
        return false;
      }

      // Send reply via Reddit API
      const response = await RedditAPIService.sendReply(parentId, text);

      if (response.success) {
        // Mark as completed
        await get().updateInboxItem(messageId, {
          status: 'resolved',
          completed: true,
        });

        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to send reply:', error);
      return false;
    }
  },

  /**
   * Add a new inbox item
   */
  addInboxItem: async (itemData) => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    try {
      const newItem = await BackendService.createDocument<InboxItem>('inbox', {
        ...itemData,
        userId: user.uid,
        createdAt: new Date(),
      });

      set(state => {
        const newItems = [newItem, ...state.inboxItems];
        return {
          inboxItems: newItems,
          notificationCount: computeNotificationCount(newItems, state.currentWorkspaceId),
        };
      });
    } catch (error) {
      console.error('Failed to create inbox item in Firestore:', error);
      throw error;
    }
  },

  getInboxByWorkspace: (workspaceId) => {
    return get().inboxItems.filter(item => item.workspaceId === workspaceId);
  },

  getActiveInboxItems: (workspaceId) => {
    const items = get().inboxItems.filter(item => !item.completed);

    if (workspaceId) {
      return items.filter(item => item.workspaceId === workspaceId);
    }

    return items;
  },

  getPendingItems: (workspaceId) => {
    const items = get().inboxItems.filter(item => item.status === 'pending');
    return workspaceId ? items.filter(item => item.workspaceId === workspaceId) : items;
  },

  getAgentQuestions: (workspaceId) => {
    const items = get().inboxItems.filter(
      item => item.type === 'agent_question' && item.status === 'pending',
    );
    return workspaceId ? items.filter(item => item.workspaceId === workspaceId) : items;
  },

  getAgentActivities: (workspaceId) => {
    const items = get().inboxItems.filter(item => item.type === 'reddit_message');
    return workspaceId ? items.filter(item => item.workspaceId === workspaceId) : items;
  },

  /**
   * Clear all inbox items
   */
  clearAllInboxItems: async () => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    try {
      console.log('🗑️  Starting deletion of all inbox items...');

      // Query all items for the current user
      const items = await BackendService.queryCollection<{ id: string }>('inbox', {
        where: [{ field: 'userId', operator: '==', value: user.uid }],
      });

      // Delete each item
      let totalDeleted = 0;
      for (const item of items) {
        try {
          await BackendService.deleteDocument('inbox', item.id);
          totalDeleted++;
        } catch (error) {
          console.error(`   ⚠️  Failed to delete item ${item.id}:`, error);
        }
      }

      console.log(`✅ Total items deleted: ${totalDeleted}`);

      // Clear local state
      set({ inboxItems: [], notificationCount: 0 });

      return totalDeleted;
    } catch (error) {
      console.error('❌ Error deleting inbox items:', error);
      throw error;
    }
  },

  // Memory management functions
  loadMemories: async (workspaceId) => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) return;

    try {
      const memories = await BackendService.queryCollection<Memory>('memories', {
        where: [
          { field: 'userId', operator: '==', value: user.uid },
          { field: 'workspaceId', operator: '==', value: workspaceId },
        ],
      });

      memories.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      set({ memories });
    } catch (error) {
      console.error('Failed to load memories from Firestore:', error);
    }
  },

  addMemory: async (memoryData) => {
    const user = AuthenticationService.getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    try {
      const newMemory = await BackendService.createDocument<Memory>('memories', {
        ...memoryData,
        userId: user.uid,
        createdAt: new Date(),
      });

      set(state => ({
        memories: [newMemory, ...state.memories],
      }));
    } catch (error) {
      console.error('Failed to create memory in Firestore:', error);
      throw error;
    }
  },

  updateMemory: async (id, updates) => {
    try {
      await BackendService.updateDocument<Memory>('memories', id, updates);

      set(state => ({
        memories: state.memories.map(memory =>
          memory.id === id ? { ...memory, ...updates } : memory,
        ),
      }));
    } catch (error) {
      console.error('Failed to update memory in Firestore:', error);
      throw error;
    }
  },

  deleteMemory: async (id) => {
    try {
      await BackendService.deleteDocument('memories', id);

      set(state => ({
        memories: state.memories.filter(memory => memory.id !== id),
      }));
    } catch (error) {
      console.error('Failed to delete memory from Firestore:', error);
      throw error;
    }
  },

  getMemoriesByWorkspace: (workspaceId) => {
    return get().memories.filter(memory => memory.workspaceId === workspaceId);
  },

  // Multi-select actions
  enableMultiSelect: () => {
    set({ isMultiSelectMode: true, selectedItemIds: [] });
  },

  disableMultiSelect: () => {
    set({ isMultiSelectMode: false, selectedItemIds: [] });
  },

  toggleItemSelection: (id) => {
    set(state => {
      const isSelected = state.selectedItemIds.includes(id);
      return {
        selectedItemIds: isSelected
          ? state.selectedItemIds.filter(itemId => itemId !== id)
          : [...state.selectedItemIds, id],
      };
    });
  },

  selectAllItems: (items) => {
    const selectableItems = items.filter(
      item => (item.type === 'approval_request' || item.type === 'agent_question') && item.status === 'pending',
    );
    set({ selectedItemIds: selectableItems.map(item => item.id) });
  },

  clearSelection: () => {
    set({ selectedItemIds: [] });
  },

  massApproveSelected: async () => {
    const { selectedItemIds, disableMultiSelect } = get();

    try {
      console.log(`📋 Mass approving ${selectedItemIds.length} items...`);

      // For Reddit messages, just mark as read
      for (const id of selectedItemIds) {
        try {
          if (id.startsWith('reddit_')) {
            await get().markMessageAsRead(id);
          }
        } catch (error) {
          console.error(`Failed to approve item ${id}:`, error);
        }
      }

      console.log('✅ Mass approval complete');
      disableMultiSelect();
    } catch (error) {
      console.error('❌ Mass approval failed:', error);
      throw error;
    }
  },

  massRejectSelected: async () => {
    const { selectedItemIds, disableMultiSelect } = get();

    try {
      console.log(`📋 Mass rejecting ${selectedItemIds.length} items...`);

      // For Reddit messages, just remove from local state
      for (const id of selectedItemIds) {
        try {
          await get().deleteInboxItem(id);
        } catch (error) {
          console.error(`Failed to reject item ${id}:`, error);
        }
      }

      console.log('✅ Mass rejection complete');
      disableMultiSelect();
    } catch (error) {
      console.error('❌ Mass rejection failed:', error);
      throw error;
    }
  },

  /**
   * Approve a comment - calls the cloud function to post to Reddit
   */
  approveComment: async (pendingCommentId: string) => {
    try {
      console.log('✅ Approving comment:', pendingCommentId);

      // Import functions dynamically to avoid circular dependencies
      const { functions } = await import('../config/firebase');
      const { httpsCallable } = await import('firebase/functions');

      const approveAndPostComment = httpsCallable(functions, 'approveAndPostComment');
      const result = await approveAndPostComment({ pendingCommentId });

      console.log('✅ Comment approved and posted:', result.data);

      // Remove the comment from inbox after approval
      const inboxItem = get().inboxItems.find(item => item.pendingCommentId === pendingCommentId);
      if (inboxItem) {
        await get().deleteInboxItem(inboxItem.id);
      }

      return true;
    } catch (error) {
      console.error('❌ Failed to approve comment:', error);
      throw error;
    }
  },

  /**
   * Reject a comment - marks it as rejected
   */
  rejectComment: async (pendingCommentId: string) => {
    try {
      console.log('❌ Rejecting comment:', pendingCommentId);

      // Import functions dynamically to avoid circular dependencies
      const { functions } = await import('../config/firebase');
      const { httpsCallable } = await import('firebase/functions');

      const rejectCommentFn = httpsCallable(functions, 'rejectComment');
      await rejectCommentFn({ pendingCommentId });

      console.log('❌ Comment rejected:', pendingCommentId);

      // Remove the comment from inbox after rejection
      const inboxItem = get().inboxItems.find(item => item.pendingCommentId === pendingCommentId);
      if (inboxItem) {
        await get().deleteInboxItem(inboxItem.id);
      }

      return true;
    } catch (error) {
      console.error('❌ Failed to reject comment:', error);
      throw error;
    }
  },

  // Legacy compatibility methods (no-ops for backward compatibility)
  answerAgentQuestion: async () => {
    console.warn('answerAgentQuestion is deprecated - Cloud Functions handles everything automatically');
  },

  approveRequest: async () => {
    console.warn('approveRequest is deprecated - Cloud Functions handles everything automatically');
  },

  submitLearningFeedback: async () => {
    console.warn('submitLearningFeedback is deprecated - Cloud Functions handles everything automatically');
  },
}));

export default useInboxStore;
