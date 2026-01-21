import React from 'react';
import { View, TextInput, TextInputProps, StyleSheet } from 'react-native';

interface AuroraInputProps extends TextInputProps {
  hasError?: boolean;
}

export const AuroraInput = React.forwardRef<TextInput, AuroraInputProps>(
  ({ hasError, style, ...props }, ref) => {
    return (
      <View style={styles.container}>
        <View
          style={[
            styles.inputContainer,
            hasError && styles.inputContainerError,
          ]}
        >
          <TextInput
            ref={ref}
            style={[styles.input, style]}
            placeholderTextColor="rgba(255, 255, 255, 0.5)"
            {...props}
          />
        </View>
      </View>
    );
  },
);

AuroraInput.displayName = 'AuroraInput';

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  inputContainer: {
    position: 'relative',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  inputContainerError: {
    borderColor: 'rgba(248, 113, 113, 0.2)',
    backgroundColor: 'rgba(248, 113, 113, 0.05)',
  },
  input: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '400',
  },
});
