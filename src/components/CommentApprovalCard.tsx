import React, { useState, useCallback, memo } from 'react';
import { View, Text, Pressable, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { formatRelativeTime } from '../utils/dateUtils';
import { hapticFeedback } from '../utils/hapticFeedback';
import { toastManager } from '../utils/toastManager';
import { functions } from '../config/firebase';
import { httpsCallable } from 'firebase/functions';

interface CommentApprovalCardProps {
  id: string;
  post: {
    title: string;
    content: string;
    subreddit: string;
    postId: string;
    url: string;
  };
  comment: {
    text: string;
    parentId?: string;
  };
  aiQualityCheck?: {
    approved: boolean;
    score: number;
    reason: string;
  };
  pendingCommentId: string;
  createdAt: Date | any;
  onApprove?: () => void;
  onReject?: () => void;
}

function CommentApprovalCard({
  id,
  post,
  comment,
  aiQualityCheck,
  pendingCommentId,
  createdAt,
  onApprove,
  onReject,
}: CommentApprovalCardProps) {
  const { isDark } = useTheme();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');

  const handleApprove = useCallback(async () => {
    try {
      setIsApproving(true);
      hapticFeedback.medium();

      const approveFunction = httpsCallable(functions, 'approveAndPostComment');
      const result = await approveFunction({ pendingCommentId });

      console.log('Comment approved and posted:', result.data);

      setStatus('approved');
      toastManager.success('Comment posted to Reddit!');
      onApprove?.();
    } catch (error: any) {
      console.error('Failed to approve comment:', error);
      toastManager.error(error.message || 'Failed to post comment');
    } finally {
      setIsApproving(false);
    }
  }, [pendingCommentId, onApprove]);

  const handleReject = useCallback(async () => {
    try {
      setIsRejecting(true);
      hapticFeedback.light();

      const rejectFunction = httpsCallable(functions, 'rejectComment');
      await rejectFunction({ pendingCommentId });

      console.log('Comment rejected');

      setStatus('rejected');
      toastManager.success('Comment rejected');
      onReject?.();
    } catch (error: any) {
      console.error('Failed to reject comment:', error);
      toastManager.error(error.message || 'Failed to reject comment');
    } finally {
      setIsRejecting(false);
    }
  }, [pendingCommentId, onReject]);

  const handleOpenPost = useCallback(() => {
    if (post.url) {
      Linking.openURL(post.url);
    }
  }, [post.url]);

  if (status === 'approved') {
    return (
      <View
        className={`mb-3 p-4 rounded-2xl border ${
          isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}
      >
        <View className="flex-row items-center">
          <View className="w-12 h-12 rounded-full bg-green-500 items-center justify-center mr-3">
            <Ionicons name="checkmark" size={24} color="#fff" />
          </View>
          <View className="flex-1">
            <Text className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Comment Posted
            </Text>
            <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Successfully posted to r/{post.subreddit}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (status === 'rejected') {
    return (
      <View
        className={`mb-3 p-4 rounded-2xl border ${
          isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}
      >
        <View className="flex-row items-center">
          <View className="w-12 h-12 rounded-full bg-gray-500 items-center justify-center mr-3">
            <Ionicons name="close" size={24} color="#fff" />
          </View>
          <View className="flex-1">
            <Text className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Comment Rejected
            </Text>
            <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Comment will not be posted
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      className={`mb-3 p-4 rounded-2xl border ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      }`}
    >
      {/* Header */}
      <View className="flex-row items-center mb-3">
        <View className="w-10 h-10 rounded-full bg-orange-500 items-center justify-center mr-3">
          <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
        </View>
        <View className="flex-1">
          <Text className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Comment Approval
          </Text>
          <Text className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {formatRelativeTime(createdAt)}
          </Text>
        </View>
        {aiQualityCheck && (
          <View
            className={`px-2 py-1 rounded ${
              aiQualityCheck.approved ? 'bg-green-100' : 'bg-yellow-100'
            }`}
          >
            <Text className="text-xs font-semibold text-green-800">
              AI Score: {Math.round(aiQualityCheck.score * 100)}%
            </Text>
          </View>
        )}
      </View>

      {/* Reddit Post */}
      <Pressable
        onPress={handleOpenPost}
        className={`mb-3 p-3 rounded-xl ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}
      >
        <View className="flex-row items-center mb-2">
          <Ionicons
            name="logo-reddit"
            size={16}
            color="#FF4500"
            style={{ marginRight: 6 }}
          />
          <Text className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            r/{post.subreddit}
          </Text>
          <Ionicons
            name="open-outline"
            size={14}
            color={isDark ? '#9CA3AF' : '#6B7280'}
            style={{ marginLeft: 'auto' }}
          />
        </View>
        <Text
          className={`text-sm font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}
          numberOfLines={2}
        >
          {post.title}
        </Text>
        {post.content && (
          <Text
            className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
            numberOfLines={2}
          >
            {post.content}
          </Text>
        )}
      </Pressable>

      {/* AI-Generated Comment */}
      <View className={`mb-3 p-3 rounded-xl ${isDark ? 'bg-gray-700' : 'bg-blue-50'}`}>
        <View className="flex-row items-center mb-2">
          <Ionicons
            name="sparkles"
            size={14}
            color="#3B82F6"
            style={{ marginRight: 6 }}
          />
          <Text className={`text-xs font-medium ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
            Generated Comment
          </Text>
        </View>
        <Text className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>
          {comment.text}
        </Text>
      </View>

      {/* AI Quality Check */}
      {aiQualityCheck && (
        <View className="mb-4">
          <Text
            className={`text-xs font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
          >
            AI Quality Check: {aiQualityCheck.reason}
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View className="flex-row gap-3">
        <Pressable
          onPress={handleReject}
          disabled={isRejecting || isApproving}
          className={`flex-1 py-3 rounded-xl items-center justify-center ${
            isDark ? 'bg-gray-700' : 'bg-gray-100'
          }`}
        >
          {isRejecting ? (
            <ActivityIndicator size="small" color={isDark ? '#fff' : '#000'} />
          ) : (
            <>
              <Text className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Reject
              </Text>
            </>
          )}
        </Pressable>
        <Pressable
          onPress={handleApprove}
          disabled={isRejecting || isApproving}
          className="flex-1 py-3 rounded-xl bg-blue-500 items-center justify-center"
        >
          {isApproving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <View className="flex-row items-center">
                <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text className="font-semibold text-white">Approve & Post</Text>
              </View>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// Memoize to prevent unnecessary re-renders
export default memo(CommentApprovalCard, (prevProps, nextProps) => {
  return (
    prevProps.id === nextProps.id &&
    prevProps.pendingCommentId === nextProps.pendingCommentId &&
    prevProps.post.postId === nextProps.post.postId &&
    prevProps.comment.text === nextProps.comment.text
  );
});
