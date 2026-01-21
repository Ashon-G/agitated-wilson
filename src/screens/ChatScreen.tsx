import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import useChatStore from '../state/chatStore';
import useWorkspaceStore from '../state/workspaceStore';
import useProfileStore from '../state/profileStore';
import useInboxStore from '../state/inboxStore';
import useQuestStore from '../state/questStore';
import GlobalHeader from '../components/GlobalHeader';
import FloatingLeadAvatar from '../components/FloatingLeadAvatar';
import { safeErrorLog } from '../utils/errorLogger';
import { toastManager } from '../utils/toastManager';
import { useTheme } from '../contexts/ThemeContext';
import { useWorkspaceColor } from '../hooks/useWorkspaceColor';
import { hapticFeedback } from '../utils/hapticFeedback';
import { Camera, Mic, Send, X, CheckCheck, Clock } from 'lucide-react-native';
import { getAgent, AgentId } from '../data/agentPersonalities';
import { UserResponse, InboxItem } from '../types/app';
import { personalizeQuestion, BusinessContext } from '../data/questContent';
import GeminiService from '../services/GeminiService';
import BackendService from '../services/BackendService';
import AuthenticationService from '../services/AuthenticationService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Chat types supported by this unified screen
type ChatMode = 'general' | 'inbox' | 'quest';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  agentName?: string;
  messageType?: 'question' | 'response' | 'comment' | 'reply';
}

export default function ChatScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const scrollViewRef = useRef<ScrollView>(null);
  const webViewRef = useRef<WebView>(null);
  const inputRef = useRef<TextInput>(null);

  // Determine chat mode from route params
  const inboxItemId = route.params?.inboxItemId;
  const questId = route.params?.questId;
  const channelId = route.params?.channelId;
  const channelName = route.params?.channelName;
  const isChannel = route.params?.isChannel;

  const chatMode: ChatMode = questId ? 'quest' : inboxItemId ? 'inbox' : 'general';

  // General chat store
  const {
    chatInput,
    setChatInput,
    conversationHistory,
    isProcessing,
    submitChat,
    clearConversation,
  } = useChatStore();

  // Inbox store
  const { inboxItems, answerAgentQuestion, updateInboxItem, markAsResponded } = useInboxStore();

  // Quest store
  const { quests, completeQuest, skipQuest, isLoading: questLoading } = useQuestStore();

  const { currentWorkspace } = useWorkspaceStore();
  const { profile } = useProfileStore();
  const { isDark } = useTheme();
  const workspaceColor = useWorkspaceColor();

  // Animation values
  const screenOpacity = useSharedValue(0);
  const avatarScale = useSharedValue(0.8);
  const avatarTranslateY = useSharedValue(0);
  const inputTranslateY = useSharedValue(100);
  const messagesOpacity = useSharedValue(0);
  const headerOpacity = useSharedValue(0);

  // State
  const [agentId, setAgentId] = useState<AgentId | null>(null);
  const [avatarGender, setAvatarGender] = useState<'male' | 'female'>('male');
  const [isAvatarLoading, setIsAvatarLoading] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [localInput, setLocalInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedComment, setGeneratedComment] = useState<string | null>(null);
  const [isGeneratingComment, setIsGeneratingComment] = useState(false);
  const [awaitingDenialReason, setAwaitingDenialReason] = useState(false);
  const [messageSendStatus, setMessageSendStatus] = useState<'normal' | 'sending' | 'success'>('normal');

  // Get personality data for the agent
  const personality = agentId ? getAgent(agentId) : null;

  // Get inbox item if in inbox mode
  const inboxItem = chatMode === 'inbox'
    ? (isChannel
      ? inboxItems.filter(item => item.type === 'reddit_message' && ((item as any).platform || (item as any).source) === channelId)[0]
      : inboxItems.find(item => item.id === inboxItemId))
    : null;

  // Get quest if in quest mode
  const quest = chatMode === 'quest' ? quests.find(q => q.id === questId) : null;

  // Business context for personalizing questions
  const businessContext: BusinessContext = {
    businessName: profile?.onboardingData?.businessName,
    targetMarket: profile?.onboardingData?.targetMarket,
    productDescription: profile?.onboardingData?.productDescription,
  };

  // Personalized question for quests
  const personalizedQuestion = quest ? personalizeQuestion(quest.question, businessContext) : '';

  // Parse Reddit context from inbox item - check multiple possible sources
  const leadInfo = React.useMemo(() => {
    if (chatMode !== 'inbox' || !inboxItem) return null;

    let author = '';
    let authorAvatar = '';
    let postTitle = '';

    // Try to get from questionData.context first
    if (inboxItem.questionData?.context) {
      try {
        const context = JSON.parse(inboxItem.questionData.context);
        author = context.author || '';
        authorAvatar = context.authorAvatar || context.author_avatar || context.icon_img || '';
        postTitle = context.postTitle || '';
      } catch {
        // Fall through to other sources
      }
    }

    // Try to get from post data (for approval_request type)
    if (!author && inboxItem.post) {
      postTitle = inboxItem.post.title || '';
      const anyItem = inboxItem as any;
      author = anyItem.authorUsername || anyItem.author || '';
      authorAvatar = anyItem.authorAvatar || '';
    }

    // Try to get from activityData (for agent activities)
    if (!author && inboxItem.activityData) {
      author = inboxItem.activityData.targetUser || '';
      postTitle = inboxItem.activityData.targetPost || '';
    }

    // Fallback - just check if there's any author-like field on the item
    if (!author) {
      const anyItem = inboxItem as any;
      author = anyItem.author || anyItem.authorUsername || anyItem.targetUser || anyItem.characterName || '';
      authorAvatar = anyItem.authorAvatar || anyItem.icon_img || '';
      postTitle = anyItem.title || '';
    }

    // Final fallback - extract from content or title
    if (!author && inboxItem.content) {
      // Try to extract username from content like "u/username" or "@username"
      const match = inboxItem.content.match(/(?:u\/|@)(\w+)/);
      if (match) {
        author = match[1];
      }
    }

    // If still no author, use the agent name or a generic name
    if (!author) {
      author = inboxItem.agentName || 'Lead';
    }

    return {
      author,
      authorAvatar,
      postTitle,
    };
  }, [chatMode, inboxItem]);

  // Keep redditContext for backward compatibility in other parts of the code
  const redditContext = React.useMemo(() => {
    if (!leadInfo) return null;
    return {
      ...leadInfo,
      postContent: '',
      postUrl: '',
      subreddit: '',
      buyingIntent: 0,
      keySignals: [] as string[],
    };
  }, [leadInfo]);

  // Extract agent ID from profile
  useEffect(() => {
    if (profile?.onboardingData?.assignedAgentId) {
      const assignedAgent = profile.onboardingData.assignedAgentId as AgentId;
      setAgentId(assignedAgent);
      const agentData = getAgent(assignedAgent);
      if (agentData) {
        setAvatarGender(agentData.gender);
      }
    }
  }, [profile]);

  // Entrance animation
  useEffect(() => {
    screenOpacity.value = withTiming(1, { duration: 300 });
    avatarScale.value = withDelay(100, withSpring(1, { damping: 15, stiffness: 150 }));
    headerOpacity.value = withDelay(200, withTiming(1, { duration: 300 }));
    messagesOpacity.value = withDelay(300, withTiming(1, { duration: 300 }));
    inputTranslateY.value = withDelay(400, withSpring(0, { damping: 18, stiffness: 180 }));

    setTimeout(() => {
      inputRef.current?.focus();
    }, 600);
  }, []);

  // Keyboard listeners
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      event => {
        setKeyboardHeight(event.endCoordinates.height);
        const extraOffset = 100;
        avatarTranslateY.value = withTiming(-(event.endCoordinates.height * 0.3 + extraOffset), { duration: 250 });
      },
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        avatarTranslateY.value = withTiming(0, { duration: 250 });
      },
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    const messageCount = chatMode === 'general' ? conversationHistory.length : 0;
    if (messageCount > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [conversationHistory.length, chatMode]);

  // Real-time listener for inbox item updates
  useEffect(() => {
    if (chatMode !== 'inbox' || !inboxItemId || isChannel) return;

    const inboxItemRef = doc(db, 'inbox_items', inboxItemId);
    const unsubscribe = onSnapshot(
      inboxItemRef,
      docSnapshot => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          const { updateInboxItem } = useInboxStore.getState();
          updateInboxItem(inboxItemId, { agentResponse: data?.agentResponse });
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 300);
        }
      },
      error => {
        if (error.code !== 'permission-denied') {
          console.error('Error listening to inbox item:', error);
        }
      },
    );

    return () => unsubscribe();
  }, [chatMode, inboxItemId, isChannel]);

  // Switch avatar animation when processing
  useEffect(() => {
    if (isProcessing && webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify({ action: 'switchToTalking' }));
      setIsSpeaking(true);
    } else if (!isProcessing && isSpeaking && webViewRef.current) {
      const idleAnimUrl = avatarGender === 'male'
        ? 'https://raw.githubusercontent.com/readyplayerme/animation-library/master/masculine/glb/idle/M_Standing_Idle_Variations_003.glb'
        : 'https://raw.githubusercontent.com/readyplayerme/animation-library/master/feminine/glb/idle/F_Standing_Idle_Variations_003.glb';
      webViewRef.current.postMessage(JSON.stringify({ action: 'switchAnimation', animationUrl: idleAnimUrl }));
      setIsSpeaking(false);
    }
  }, [isProcessing, isSpeaking, avatarGender]);

  // Handle sending message based on chat mode
  const handleSendMessage = async () => {
    if (chatMode === 'general') {
      await handleGeneralChat();
    } else if (chatMode === 'inbox') {
      await handleInboxChat();
    } else if (chatMode === 'quest') {
      await handleQuestChat();
    }
  };

  // General chat handler
  const handleGeneralChat = async () => {
    if (!chatInput.trim() || isProcessing) return;
    hapticFeedback.light();

    try {
      await submitChat();
    } catch (error) {
      safeErrorLog({
        error: error as Error,
        context: 'ChatScreen',
        extra: { messageCount: conversationHistory.length, hasInput: !!chatInput.trim() },
      });
      toastManager.error('Failed to get AI response. Please try again.');
    }
  };

  // Quest chat handler
  const handleQuestChat = async () => {
    if (!quest || !localInput.trim() || isSubmitting) return;
    setIsSubmitting(true);
    hapticFeedback.medium();

    try {
      await completeQuest(quest.id, localInput.trim());
      toastManager.success('Got it! Thanks for sharing.');
      setTimeout(() => handleGoBack(), 500);
    } catch (error) {
      console.error('Error completing quest:', error);
      toastManager.error('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  // Inbox chat handler (simplified - main logic preserved)
  const handleInboxChat = async () => {
    if (!localInput.trim() || !inboxItem) return;

    const messageText = localInput.trim();
    setLocalInput('');
    Keyboard.dismiss();

    // Start sending animation
    setMessageSendStatus('sending');
    hapticFeedback.light();

    if (inboxItem.status === 'pending' && inboxItem.type !== 'approval_request') {
      await markAsResponded(inboxItem.id);
    }

    const userMessage = {
      id: `user_msg_${Date.now()}`,
      content: messageText,
      isUser: true,
      timestamp: new Date(),
    };

    // Helper to show success animation
    const showSuccessAnimation = () => {
      setMessageSendStatus('success');
      hapticFeedback.success();
      setTimeout(() => setMessageSendStatus('normal'), 2000);
    };

    try {
      // Handle learning state
      if (inboxItem.learningState?.isLearning) {
        await updateInboxItem(inboxItem.id, {
          conversationHistory: [...(inboxItem.conversationHistory || []), userMessage],
        });
        const { submitLearningFeedback } = useInboxStore.getState();
        await submitLearningFeedback(inboxItem.id, messageText);
        showSuccessAnimation();
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        return;
      }

      // Handle agent questions
      if (inboxItem.type === 'agent_question') {
        await updateInboxItem(inboxItem.id, {
          conversationHistory: [...(inboxItem.conversationHistory || []), userMessage],
        });
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 200);

        const userResponse: UserResponse = {
          content: messageText,
          action: 'answered',
          shouldLearnFromThis: true,
          timestamp: new Date(),
        };
        await answerAgentQuestion(inboxItem.id, userResponse);
        showSuccessAnimation();
        return;
      }

      // Handle approval requests (simplified)
      if (inboxItem.type === 'approval_request') {
        await handleApprovalRequest(inboxItem, userMessage, messageText);
        showSuccessAnimation();
        return;
      }

      // Handle Reddit messages - actually send the reply to Reddit
      if (inboxItem.type === 'reddit_message') {
        // Add message to conversation history first (optimistic update)
        await updateInboxItem(inboxItem.id, {
          conversationHistory: [...(inboxItem.conversationHistory || []), userMessage],
        });
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

        // Send reply to Reddit
        const { sendReply } = useInboxStore.getState();
        const success = await sendReply(inboxItem.id, messageText);

        if (success) {
          showSuccessAnimation();
          toastManager.success('Reply sent to Reddit!');
        } else {
          setMessageSendStatus('normal');
          toastManager.error('Failed to send reply to Reddit');
        }
        return;
      }

      // Default: add to conversation
      await updateInboxItem(inboxItem.id, {
        conversationHistory: [...(inboxItem.conversationHistory || []), userMessage],
        userResponse: { content: messageText, action: 'resolved', shouldLearnFromThis: false, timestamp: new Date() },
      });
      showSuccessAnimation();
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessageSendStatus('normal');
      toastManager.error('Failed to send message');
    }
  };

  // Handle approval request flow
  const handleApprovalRequest = async (item: InboxItem, userMessage: any, messageText: string) => {
    const messageLC = messageText.toLowerCase();
    const affirmationWords = ['yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'approve', 'post', 'go', 'looks good', 'perfect', 'great', 'do it'];
    const denialWords = ['no', 'nope', 'deny', 'decline', 'reject', 'skip', 'pass', 'cancel'];

    const isApproval = affirmationWords.some(word => messageLC.includes(word));
    const isDenial = denialWords.some(word => messageLC.includes(word));
    const hasGeneratedComment = item.conversationHistory?.some((msg: any) => msg.agentName === 'AI Comment Generator');

    // Check if user provided a reason along with their denial (more than just the denial word)
    const denialWordCount = messageText.trim().split(/\s+/).length;
    const hasReasonWithDenial = isDenial && denialWordCount > 3;

    // Stage 1: Initial approval
    if (item.status === 'pending' && !hasGeneratedComment) {
      if (isDenial) {
        // If user already provided a reason with their denial, don't ask again
        if (hasReasonWithDenial) {
          const thankYouMessage = {
            id: `ai_thanks_${Date.now()}`,
            content: "Got it, thanks for the feedback! I'll use this to find better leads for you.",
            isUser: false,
            timestamp: new Date(),
            agentName: 'AI Agent',
          };
          await updateInboxItem(item.id, {
            status: 'denied',
            completed: true,
            respondedAt: new Date(),
            conversationHistory: [...(item.conversationHistory || []), userMessage, thankYouMessage],
            userResponse: { content: messageText, action: 'denied', shouldLearnFromThis: true, timestamp: new Date() },
          });
          return;
        }

        // Otherwise ask for a reason
        const askReasonMessage = {
          id: `ai_ask_reason_${Date.now()}`,
          content: 'No problem! Could you tell me why? This helps me find better leads.',
          isUser: false,
          timestamp: new Date(),
          agentName: 'AI Agent',
        };
        await updateInboxItem(item.id, {
          conversationHistory: [...(item.conversationHistory || []), userMessage, askReasonMessage],
        });
        setAwaitingDenialReason(true);
        return;
      }

      if (isApproval) {
        setIsGeneratingComment(true);
        const generatingMessage = {
          id: `ai_generating_${Date.now()}`,
          content: 'Great! Let me craft a comment...',
          isUser: false,
          timestamp: new Date(),
          agentName: 'AI Agent',
        };
        await updateInboxItem(item.id, {
          status: 'responded',
          conversationHistory: [...(item.conversationHistory || []), userMessage, generatingMessage],
        });

        try {
          const user = AuthenticationService.getCurrentUser();
          let knowledgeContext = '';
          if (user) {
            const knowledge = await BackendService.queryCollection(`users/${user.uid}/knowledge`, {
              where: [{ field: 'workspaceId', operator: '==', value: item.workspaceId }],
              limit: 10,
            });
            knowledgeContext = knowledge.map((k: any) => k.content || k.description || '').filter(Boolean).join('\n\n');
          }

          const postData = {
            title: redditContext?.postTitle || item.title || '',
            content: redditContext?.postContent || item.content || '',
            subreddit: redditContext?.subreddit || '',
          };

          const result = await GeminiService.generateComment(postData, knowledgeContext);
          if (result.comment) {
            const commentMessage = {
              id: `ai_comment_${Date.now()}`,
              content: `Here's my draft:\n\n"${result.comment}"\n\nApprove?`,
              isUser: false,
              timestamp: new Date(),
              agentName: 'AI Comment Generator',
            };
            // Get latest conversation history to preserve user's "yes" message
            const latestItem = await BackendService.getDocument<InboxItem>('inbox', item.id);
            const currentHistory = latestItem?.conversationHistory || item.conversationHistory || [];
            await updateInboxItem(item.id, {
              generatedComment: result.comment,
              conversationHistory: [...currentHistory, commentMessage],
            });
            setGeneratedComment(result.comment);
          }
        } catch (error) {
          console.error('Error generating comment:', error);
        } finally {
          setIsGeneratingComment(false);
        }
        return;
      }
    }

    // Stage 2: Comment approval
    if (hasGeneratedComment && isApproval) {
      const storedComment = (item as any).generatedComment || generatedComment;
      try {
        if (item.pendingCommentId) {
          const { functions } = await import('../config/firebase');
          const { httpsCallable } = await import('firebase/functions');
          const approveAndPostComment = httpsCallable(functions, 'approveAndPostComment');
          await approveAndPostComment({ pendingCommentId: item.pendingCommentId });
        }

        const successMessage = {
          id: `ai_success_${Date.now()}`,
          content: "Posted! I'll watch for replies.",
          isUser: false,
          timestamp: new Date(),
          agentName: 'AI Agent',
        };
        await updateInboxItem(item.id, {
          status: 'approved',
          completed: true,
          respondedAt: new Date(),
          conversationHistory: [...(item.conversationHistory || []), userMessage, successMessage],
          userResponse: { content: messageText, action: 'approved', shouldLearnFromThis: true, timestamp: new Date() },
        });
      } catch (error) {
        console.error('Error posting comment:', error);
      }
    }

    // Stage 2: Comment denial - user rejected the generated comment
    if (hasGeneratedComment && isDenial) {
      // Check if user provided feedback with their denial
      const denialWordCount = messageText.trim().split(/\s+/).length;
      const hasFeedbackWithDenial = denialWordCount > 3;

      if (hasFeedbackWithDenial) {
        // User provided feedback, regenerate with their input
        await regenerateCommentWithFeedback(item, userMessage, messageText);
      } else {
        // Ask for feedback to improve the comment
        const askFeedbackMessage = {
          id: `ai_ask_feedback_${Date.now()}`,
          content: 'No problem! What would you like me to change?',
          isUser: false,
          timestamp: new Date(),
          agentName: 'AI Agent',
        };
        await updateInboxItem(item.id, {
          conversationHistory: [...(item.conversationHistory || []), userMessage, askFeedbackMessage],
        });
        setAwaitingDenialReason(true);
      }
      return;
    }

    // Stage 2b: User providing feedback after denying comment - regenerate with their input
    if (hasGeneratedComment && awaitingDenialReason && !isApproval && !isDenial) {
      setAwaitingDenialReason(false);
      await regenerateCommentWithFeedback(item, userMessage, messageText);
    }
  };

  // Helper to regenerate comment based on user feedback
  const regenerateCommentWithFeedback = async (item: InboxItem, userMessage: any, feedback: string) => {
    setIsGeneratingComment(true);
    const generatingMessage = {
      id: `ai_regenerating_${Date.now()}`,
      content: 'Got it, let me try again...',
      isUser: false,
      timestamp: new Date(),
      agentName: 'AI Agent',
    };
    await updateInboxItem(item.id, {
      conversationHistory: [...(item.conversationHistory || []), userMessage, generatingMessage],
    });

    try {
      const user = AuthenticationService.getCurrentUser();
      let knowledgeContext = '';
      if (user) {
        const knowledge = await BackendService.queryCollection(`users/${user.uid}/knowledge`, {
          where: [{ field: 'workspaceId', operator: '==', value: item.workspaceId }],
          limit: 10,
        });
        knowledgeContext = knowledge.map((k: any) => k.content || k.description || '').filter(Boolean).join('\n\n');
      }

      const postData = {
        title: redditContext?.postTitle || item.title || '',
        content: redditContext?.postContent || item.content || '',
        subreddit: redditContext?.subreddit || '',
      };

      // Get previous comment for context
      const previousComment = (item as any).generatedComment || generatedComment || '';

      // Include feedback in the generation request
      const feedbackContext = `\n\nPREVIOUS COMMENT (user rejected): "${previousComment}"\n\nUSER FEEDBACK: ${feedback}\n\nPlease generate a new comment that addresses the user's feedback.`;

      const result = await GeminiService.generateComment(postData, knowledgeContext + feedbackContext);
      if (result.comment) {
        const commentMessage = {
          id: `ai_comment_${Date.now()}`,
          content: `Here's my new draft:\n\n"${result.comment}"\n\nApprove?`,
          isUser: false,
          timestamp: new Date(),
          agentName: 'AI Comment Generator',
        };
        // Get latest conversation history
        const latestItem = await BackendService.getDocument<InboxItem>('inbox', item.id);
        const currentHistory = latestItem?.conversationHistory || item.conversationHistory || [];
        await updateInboxItem(item.id, {
          generatedComment: result.comment,
          conversationHistory: [...currentHistory, commentMessage],
        });
        setGeneratedComment(result.comment);
      }
    } catch (error) {
      console.error('Error regenerating comment:', error);
      const errorMessage = {
        id: `ai_error_${Date.now()}`,
        content: 'Sorry, I had trouble generating a new comment. Please try again.',
        isUser: false,
        timestamp: new Date(),
        agentName: 'AI Agent',
      };
      await updateInboxItem(item.id, {
        conversationHistory: [...(item.conversationHistory || []), errorMessage],
      });
    } finally {
      setIsGeneratingComment(false);
    }
  };

  const handleGoBack = () => {
    screenOpacity.value = withTiming(0, { duration: 200 });
    setTimeout(() => navigation.goBack(), 200);
  };

  const handleSkipQuest = async () => {
    if (!quest) return;
    hapticFeedback.light();
    await skipQuest(quest.id);
    toastManager.success('Skipped! You can answer this later.');
    handleGoBack();
  };

  // Animated styles
  const screenAnimatedStyle = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));
  const avatarAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [
        { translateY: avatarTranslateY.value },
        { scale: avatarScale.value },
      ] as const,
    };
  });
  const headerAnimatedStyle = useAnimatedStyle(() => ({ opacity: headerOpacity.value }));
  const messagesAnimatedStyle = useAnimatedStyle(() => ({ opacity: messagesOpacity.value }));
  const inputAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [{ translateY: inputTranslateY.value }] as const,
    };
  });

  // 3D Avatar HTML
  const agentUrl = personality?.modelUrl || '';
  const idleAnimationUrl = avatarGender === 'male'
    ? 'https://raw.githubusercontent.com/readyplayerme/animation-library/master/masculine/glb/idle/M_Standing_Idle_Variations_003.glb'
    : 'https://raw.githubusercontent.com/readyplayerme/animation-library/master/feminine/glb/idle/F_Standing_Idle_Variations_003.glb';
  const talkingAnimationUrl = 'https://cdn.jsdelivr.net/gh/readyplayerme/animation-library@master/masculine/glb/expression/M_Talking_Variations_001.glb';

  const avatarHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { width: 100vw; height: 100vh; overflow: hidden; background: transparent; }
        #avatar-container { width: 100%; height: 100%; }
      </style>
    </head>
    <body>
      <div id="avatar-container"></div>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
      <script>
        (function() {
          try {
            const container = document.getElementById('avatar-container');
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
            camera.position.set(0, 1.0, 3.8);
            const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            container.appendChild(renderer.domElement);
            const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
            scene.add(ambientLight);
            const frontLight = new THREE.DirectionalLight(0xffffff, 0.8);
            frontLight.position.set(0, 2, 5);
            scene.add(frontLight);
            const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
            fillLight.position.set(-3, 1, 2);
            scene.add(fillLight);
            const loader = new THREE.GLTFLoader();
            let mixer;
            let avatar;
            loader.load('${agentUrl}', function(gltf) {
              avatar = gltf.scene;
              avatar.scale.set(1, 1, 1);
              avatar.position.set(0, -0.5, 0);
              scene.add(avatar);
              window.ReactNativeWebView && window.ReactNativeWebView.postMessage('avatar_loaded');
              loader.load('${idleAnimationUrl}', function(animGltf) {
                if (animGltf.animations && animGltf.animations.length > 0) {
                  mixer = new THREE.AnimationMixer(avatar);
                  const action = mixer.clipAction(animGltf.animations[0]);
                  action.play();
                }
              });
            });
            const clock = new THREE.Clock();
            function animate() {
              requestAnimationFrame(animate);
              if (mixer) mixer.update(clock.getDelta());
              renderer.render(scene, camera);
            }
            animate();
            window.addEventListener('message', function(event) {
              try {
                const message = JSON.parse(event.data);
                if (message.action === 'switchAnimation' && message.animationUrl) {
                  loader.load(message.animationUrl, function(animGltf) {
                    if (animGltf.animations && animGltf.animations.length > 0 && mixer) {
                      mixer.stopAllAction();
                      const newAction = mixer.clipAction(animGltf.animations[0]);
                      newAction.play();
                    }
                  });
                } else if (message.action === 'switchToTalking') {
                  loader.load('${talkingAnimationUrl}', function(talkingGltf) {
                    if (talkingGltf.animations && talkingGltf.animations.length > 0 && mixer) {
                      mixer.stopAllAction();
                      const talkAction = mixer.clipAction(talkingGltf.animations[0]);
                      talkAction.play();
                    }
                  });
                }
              } catch (e) {}
            });
            window.addEventListener('resize', function() {
              camera.aspect = window.innerWidth / window.innerHeight;
              camera.updateProjectionMatrix();
              renderer.setSize(window.innerWidth, window.innerHeight);
            });
          } catch (error) {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage('error: ' + error.message);
          }
        })();
      </script>
    </body>
    </html>
  `;

  // Build chat messages based on mode
  const buildChatMessages = useCallback((): ChatMessage[] => {
    if (chatMode === 'general') {
      return conversationHistory;
    }

    if (chatMode === 'quest' && quest) {
      return [{
        id: 'quest-question',
        role: 'assistant',
        content: personalizedQuestion,
        timestamp: new Date(),
        agentName: 'AI Agent',
      }];
    }

    if (chatMode === 'inbox' && inboxItem) {
      const messages: ChatMessage[] = [];

      // Add initial message
      messages.push({
        id: `${inboxItem.id}-agent`,
        role: 'assistant',
        content: inboxItem.content || inboxItem.title,
        timestamp: inboxItem.createdAt,
        agentName: inboxItem.agentName || 'AI Agent',
        messageType: inboxItem.type === 'approval_request' || inboxItem.type === 'agent_question' ? 'question' : undefined,
      });

      // Add conversation history
      if (inboxItem.conversationHistory) {
        inboxItem.conversationHistory.forEach((msg, index) => {
          messages.push({
            id: `${inboxItem.id}-conv-${index}`,
            role: msg.isUser ? 'user' : 'assistant',
            content: msg.content,
            timestamp: new Date(msg.timestamp),
            agentName: msg.agentName,
            messageType: msg.isUser ? 'response' : 'comment',
          });
        });
      }

      return messages;
    }

    return [];
  }, [chatMode, conversationHistory, quest, personalizedQuestion, inboxItem]);

  const messages = buildChatMessages();
  const userName = profile?.name || profile?.onboardingData?.firstName || 'there';

  // Input value depends on mode
  const inputValue = chatMode === 'general' ? chatInput : localInput;
  const setInputValue = chatMode === 'general' ? setChatInput : setLocalInput;
  const isInputDisabled = isProcessing || isSubmitting || isGeneratingComment;

  // Get header title based on mode
  const getHeaderTitle = () => {
    if (chatMode === 'quest') return 'Quick Question';
    if (chatMode === 'inbox' && inboxItem) return inboxItem.agentName || 'AI Agent';
    return 'Chat';
  };

  // Check if input should be shown
  const showInput = chatMode !== 'inbox' || (inboxItem && !inboxItem.completed);

  // Get placeholder text
  const getPlaceholder = () => {
    if (chatMode === 'quest' && quest) return quest.placeholder || 'Type your answer...';
    if (chatMode === 'inbox' && inboxItem) {
      if (inboxItem.type === 'agent_question') return 'Type your answer...';
      if (inboxItem.type === 'approval_request') return 'Reply "yes" to approve or "no" to deny...';
    }
    return `Talk to ${userName}...`;
  };

  return (
    <Animated.View style={[{ flex: 1 }, screenAnimatedStyle]}>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1, backgroundColor: '#0C0C0E' }}>
        {/* Background Gradient - premium dark */}
        <LinearGradient
          colors={['#0C0C0E', '#141416', '#0C0C0E']}
          locations={[0, 0.5, 1]}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />

        {/* Subtle ambient glow */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.3 }}>
          <LinearGradient
            colors={['transparent', 'rgba(255, 255, 255, 0.02)', 'transparent']}
            locations={[0, 0.5, 1]}
            style={{ position: 'absolute', top: '30%', left: 0, right: 0, height: '40%' }}
          />
        </View>

        {/* Ground gradient - very subtle */}
        <LinearGradient
          colors={['transparent', 'rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.04)']}
          locations={[0.6, 0.85, 1]}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%' }}
        />

        {/* 3D Avatar Section - Show Lead Avatar for inbox mode, 3D model otherwise */}
        {chatMode === 'inbox' && leadInfo ? (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                left: -SCREEN_WIDTH * 0.15,
                bottom: SCREEN_HEIGHT * 0.15,
                width: SCREEN_WIDTH * 0.7,
                height: SCREEN_HEIGHT * 0.4,
                zIndex: 0,
                alignItems: 'center',
                justifyContent: 'center',
              },
              avatarAnimatedStyle,
            ]}
          >
            <FloatingLeadAvatar
              imageUrl={leadInfo.authorAvatar}
              username={leadInfo.author}
              size={140}
              animationState={messageSendStatus}
            />
          </Animated.View>
        ) : (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                left: -SCREEN_WIDTH * 0.4,
                bottom: 50,
                width: SCREEN_WIDTH * 1.1,
                height: SCREEN_HEIGHT * 0.85,
                zIndex: 0,
              },
              avatarAnimatedStyle,
            ]}
          >
            {agentId && (
              <WebView
                ref={webViewRef}
                source={{ html: avatarHtml }}
                style={{ flex: 1, backgroundColor: 'transparent' }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                allowFileAccess={true}
                originWhitelist={['*']}
                mixedContentMode="always"
                allowUniversalAccessFromFileURLs={true}
                onLoad={() => setIsAvatarLoading(false)}
                onMessage={event => {
                  if (event.nativeEvent.data === 'avatar_loaded') setIsAvatarLoading(false);
                }}
              />
            )}
          </Animated.View>
        )}

        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 }}>
              <Pressable
                onPress={handleGoBack}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={20} color="rgba(255, 255, 255, 0.8)" />
              </Pressable>

              <Text style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: 16, fontWeight: '500', letterSpacing: -0.3 }}>{getHeaderTitle()}</Text>

              {chatMode === 'quest' && (
                <Pressable
                  onPress={handleSkipQuest}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 14,
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 13, fontWeight: '500' }}>Skip</Text>
                </Pressable>
              )}
              {chatMode !== 'quest' && <View style={{ width: 38 }} />}
            </View>

            {/* Main Content */}
            <View style={{ flex: 1 }}>
              {/* Chat Messages */}
              <Animated.View style={[{ flex: 1, paddingTop: 8 }, messagesAnimatedStyle]}>
                <ScrollView
                  ref={scrollViewRef}
                  style={{ flex: 1 }}
                  contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingBottom: 20,
                    paddingTop: 40,
                    flexGrow: 1,
                    justifyContent: 'flex-start',
                  }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Date Header for general chat */}
                  {chatMode === 'general' && messages.length > 0 && (
                    <View style={{ alignItems: 'center', marginBottom: 16 }}>
                      <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
                        <Text style={{ color: '#fff', fontSize: 12 }}>
                          Today {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Quest badge */}
                  {chatMode === 'quest' && quest && (
                    <View style={{ marginLeft: SCREEN_WIDTH * 0.32, marginBottom: 8 }}>
                      <View style={{
                        backgroundColor: quest.color || workspaceColor.color,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 10,
                        alignSelf: 'flex-start',
                      }}>
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600', textTransform: 'uppercase' }}>
                          {quest.category}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Messages */}
                  {messages.map((message, index) => (
                    <View
                      key={message.id}
                      style={{
                        marginBottom: 16,
                        alignItems: message.role === 'user' ? 'flex-end' : 'flex-start',
                        marginLeft: message.role === 'assistant' ? SCREEN_WIDTH * 0.32 : 0,
                      }}
                    >
                      {message.role === 'assistant' && (
                        <View
                          style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.15)',
                            paddingHorizontal: 16,
                            paddingVertical: 14,
                            borderRadius: 20,
                            borderTopLeftRadius: 6,
                            maxWidth: SCREEN_WIDTH * 0.58,
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.25)',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.2,
                            shadowRadius: 12,
                            elevation: 5,
                          }}
                        >
                          <Text style={{ color: '#fff', fontSize: 15, lineHeight: 22 }}>
                            {message.content}
                          </Text>
                        </View>
                      )}
                      {message.role === 'user' && (
                        <View>
                          <View
                            style={{
                              backgroundColor: messageSendStatus === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.2)',
                              paddingHorizontal: 16,
                              paddingVertical: 14,
                              borderRadius: 20,
                              borderTopRightRadius: 6,
                              maxWidth: SCREEN_WIDTH * 0.7,
                              borderWidth: 1,
                              borderColor: messageSendStatus === 'success' ? 'rgba(34, 197, 94, 0.5)' : 'rgba(255, 255, 255, 0.3)',
                            }}
                          >
                            <Text style={{ color: '#fff', fontSize: 15, lineHeight: 22 }}>
                              {message.content}
                            </Text>
                          </View>
                          {/* Message delivery status - only show for the last user message in inbox mode */}
                          {chatMode === 'inbox' && index === messages.length - 1 && messageSendStatus !== 'normal' && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 6, gap: 4 }}>
                              {messageSendStatus === 'sending' ? (
                                <>
                                  <Clock size={12} color="rgba(255, 255, 255, 0.6)" />
                                  <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 11, fontWeight: '500' }}>Sending...</Text>
                                </>
                              ) : messageSendStatus === 'success' ? (
                                <>
                                  <CheckCheck size={14} color="rgba(34, 197, 94, 0.9)" strokeWidth={2.5} />
                                  <Text style={{ color: 'rgba(34, 197, 94, 0.9)', fontSize: 11, fontWeight: '600' }}>Sent</Text>
                                </>
                              ) : null}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  ))}

                  {/* Typing indicator */}
                  {(isProcessing || isGeneratingComment) && (
                    <View style={{ marginLeft: SCREEN_WIDTH * 0.32, marginBottom: 16 }}>
                      <View
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          paddingHorizontal: 16,
                          paddingVertical: 14,
                          borderRadius: 18,
                          borderTopLeftRadius: 6,
                          flexDirection: 'row',
                          alignItems: 'center',
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.06)',
                        }}
                      >
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255, 255, 255, 0.4)', marginRight: 4 }} />
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255, 255, 255, 0.4)', marginRight: 4 }} />
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255, 255, 255, 0.4)' }} />
                      </View>
                    </View>
                  )}

                  {/* Empty state welcome */}
                  {messages.length === 0 && !isProcessing && chatMode === 'general' && (
                    <View style={{ marginLeft: SCREEN_WIDTH * 0.32, marginTop: SCREEN_HEIGHT * 0.08 }}>
                      <View
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          paddingHorizontal: 18,
                          paddingVertical: 16,
                          borderRadius: 18,
                          borderTopLeftRadius: 6,
                          maxWidth: SCREEN_WIDTH * 0.62,
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.06)',
                        }}
                      >
                        <Text style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: 15, lineHeight: 22, letterSpacing: -0.2 }}>
                          Hey {profile?.name?.split(' ')[0] || 'there'}! How can I help you today?
                        </Text>
                      </View>
                    </View>
                  )}
                </ScrollView>
              </Animated.View>
            </View>

            {/* Input Area */}
            {showInput && (
              <Animated.View
                style={[
                  { paddingHorizontal: 16, paddingBottom: Platform.OS === 'ios' ? 8 : 16, paddingTop: 12, zIndex: 10 },
                  inputAnimatedStyle,
                ]}
              >
                <SafeAreaView edges={['bottom']}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: 'rgba(255, 255, 255, 0.06)',
                      borderRadius: 24,
                      paddingHorizontal: 6,
                      paddingVertical: 5,
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    {chatMode === 'general' && (
                      <Pressable
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 8,
                        }}
                      >
                        <Camera size={18} color="rgba(255, 255, 255, 0.5)" />
                      </Pressable>
                    )}

                    <TextInput
                      ref={inputRef}
                      style={{
                        flex: 1,
                        fontSize: 15,
                        color: 'rgba(255, 255, 255, 0.9)',
                        paddingVertical: 10,
                        paddingHorizontal: chatMode === 'general' ? 4 : 16,
                        maxHeight: 100,
                      }}
                      placeholder={getPlaceholder()}
                      placeholderTextColor="rgba(255, 255, 255, 0.35)"
                      value={inputValue}
                      onChangeText={setInputValue}
                      multiline
                      textAlignVertical="center"
                      editable={!isInputDisabled}
                      onSubmitEditing={handleSendMessage}
                      returnKeyType="send"
                    />

                    {inputValue.trim() && chatMode === 'general' && (
                      <Pressable
                        onPress={() => setInputValue('')}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: 'rgba(255, 255, 255, 0.2)',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 8,
                        }}
                      >
                        <Ionicons name="close" size={14} color="rgba(255, 255, 255, 0.8)" />
                      </Pressable>
                    )}

                    <Pressable
                      onPress={inputValue.trim() ? handleSendMessage : undefined}
                      disabled={!inputValue.trim() || isInputDisabled}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 22,
                        backgroundColor: inputValue.trim() ? (chatMode === 'quest' && quest?.color ? quest.color : workspaceColor.color) : 'rgba(255, 255, 255, 0.15)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : inputValue.trim() ? (
                        <Send size={18} color="#fff" />
                      ) : (
                        <Mic size={20} color="rgba(255, 255, 255, 0.6)" />
                      )}
                    </Pressable>
                  </View>
                </SafeAreaView>
              </Animated.View>
            )}

            {/* Completed state for inbox */}
            {chatMode === 'inbox' && inboxItem?.completed && (
              <View
                style={{
                  paddingVertical: 16,
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  alignItems: 'center',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons
                    name={inboxItem.status === 'denied' ? 'close-circle' : 'checkmark-circle'}
                    size={20}
                    color={inboxItem.status === 'denied' ? '#ef4444' : '#22c55e'}
                  />
                  <Text style={{ color: '#fff', marginLeft: 8 }}>
                    {inboxItem.status === 'approved' ? 'Approved' : inboxItem.status === 'denied' ? 'Denied' : 'Completed'}
                  </Text>
                </View>
              </View>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Animated.View>
  );
}
