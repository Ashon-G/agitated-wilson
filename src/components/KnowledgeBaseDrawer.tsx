import React, { useState } from 'react';
import { View, Text, Modal, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { KnowledgeUploadTab } from './KnowledgeUploadTab';
import { KnowledgeURLTab } from './KnowledgeURLTab';
import { KnowledgePlainTextTab } from './KnowledgePlainTextTab';
import { FileUpload, URLPreview } from '../types/knowledge';

interface KnowledgeBaseDrawerProps {
  isVisible: boolean;
  onClose: () => void;
  onFileUpload: (file: FileUpload) => void;
  onURLSubmit: (url: string, preview: URLPreview) => void;
  onTextSubmit: (title: string, content: string, tags: string[]) => void;
  isProcessing?: boolean;
}

type TabType = 'upload' | 'url' | 'text';

const tabs = [
  { id: 'upload' as TabType, label: 'Upload', icon: 'cloud-upload-outline' },
  { id: 'url' as TabType, label: 'URL', icon: 'link-outline' },
  { id: 'text' as TabType, label: 'Text', icon: 'document-text-outline' },
];

export const KnowledgeBaseDrawer: React.FC<KnowledgeBaseDrawerProps> = ({
  isVisible,
  onClose,
  onFileUpload,
  onURLSubmit,
  onTextSubmit,
  isProcessing = false,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('upload');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'upload':
        return (
          <KnowledgeUploadTab
            onFileSelected={onFileUpload}
            isUploading={isProcessing}
          />
        );
      case 'url':
        return (
          <KnowledgeURLTab
            onURLSelected={onURLSubmit}
            isProcessing={isProcessing}
          />
        );
      case 'text':
        return (
          <KnowledgePlainTextTab
            onTextSubmitted={onTextSubmit}
            isProcessing={isProcessing}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color="#374151" />
          </Pressable>
          <Text style={styles.headerTitle}>Add to Knowledge Base</Text>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[
                styles.tab,
                {
                  borderBottomWidth: activeTab === tab.id ? 2 : 0,
                  borderBottomColor: '#22C55E',
                },
              ]}
            >
              <Ionicons
                name={tab.icon as any}
                size={20}
                color={activeTab === tab.id ? '#22C55E' : '#6B7280'}
                style={{ marginRight: 8 }}
              />
              <Text
                style={[
                  styles.tabText,
                  {
                    color: activeTab === tab.id ? '#22C55E' : '#6B7280',
                  },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Tab Content */}
        <View style={styles.content}>
          {renderTabContent()}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
    backgroundColor: 'white',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tabText: {
    fontWeight: '500',
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
});