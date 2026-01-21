import React from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { styles } from './styles';

interface EditModalProps {
  editingField: string | null;
  editValue: string;
  setEditValue: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  bottomInset: number;
}

export function EditModal({
  editingField,
  editValue,
  setEditValue,
  onSave,
  onCancel,
  bottomInset,
}: EditModalProps) {
  if (!editingField) return null;

  const getFieldTitle = (field: string) => {
    switch (field) {
      case 'businessName': return 'Business Name';
      case 'targetMarket': return 'Target Market';
      case 'productDescription': return 'Product Description';
      default: return 'Edit';
    }
  };

  return (
    <View style={[styles.editModal, { paddingBottom: bottomInset + 24 }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.editModalContent}
      >
        <Text style={styles.editModalTitle}>Edit {getFieldTitle(editingField)}</Text>
        <TextInput
          style={styles.editInput}
          value={editValue}
          onChangeText={setEditValue}
          autoFocus
          multiline={editingField !== 'businessName'}
          placeholder="Enter value..."
          placeholderTextColor="#9CA3AF"
        />
        <View style={styles.editModalButtons}>
          <Pressable style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.saveButton} onPress={onSave}>
            <Text style={styles.saveButtonText}>Save</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
