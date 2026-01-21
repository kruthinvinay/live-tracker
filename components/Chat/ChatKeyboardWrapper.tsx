import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

interface ChatKeyboardWrapperProps {
    children: React.ReactNode;
    headerHeight?: number;
}

export const ChatKeyboardWrapper = ({ children, headerHeight = 0 }: ChatKeyboardWrapperProps) => {
    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={headerHeight}
        >
            {children}
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    }
});
