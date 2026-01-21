import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Composer, ComposerProps, IMessage, InputToolbar, InputToolbarProps, Send, SendProps } from 'react-native-gifted-chat';

const COLORS = {
    primary: '#6366f1',
    inputBg: '#f3f4f6',
    text: '#000000', // Ensuring Black Text
    placeholder: '#9ca3af',
};

// 1. The Container Bar (White background, border top)
export const CustomInputToolbar = (props: InputToolbarProps<IMessage>) => {
    return (
        <InputToolbar
            {...props}
            containerStyle={styles.inputToolbarContainer}
            primaryStyle={styles.inputToolbarPrimary}
        />
    );
};

// 2. The Input Field (Gray Pill, Black Text)
export const CustomComposer = (props: ComposerProps) => {
    return (
        <Composer
            {...props}
            placeholder="Message..."
            placeholderTextColor={COLORS.placeholder}
            textInputStyle={styles.composerInput}
            textInputProps={{
                style: { color: '#000000' },
                placeholderTextColor: COLORS.placeholder
            }}
        />
    );
};

// 3. The Send Button (Floating Blue Circle)
export const CustomSend = (props: SendProps<IMessage>) => {
    const hasText = props.text && props.text.trim().length > 0;

    return (
        <View style={styles.sendContainer}>
            {hasText ? (
                <Send {...props} containerStyle={{ justifyContent: 'center' }}>
                    <View style={styles.sendButtonActive}>
                        <Ionicons name="send" size={20} color="#fff" style={{ marginLeft: 3 }} />
                    </View>
                </Send>
            ) : (
                <View style={styles.sendButtonInactive}>
                    <Ionicons name="send" size={20} color={COLORS.placeholder} style={{ marginLeft: 3 }} />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    inputToolbarContainer: {
        backgroundColor: 'white',
        borderTopColor: '#f3f4f6',
        borderTopWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 8,
        justifyContent: 'center',
    },
    inputToolbarPrimary: {
        alignItems: 'flex-end', // Ensure items align to bottom if multiline grows
    },
    // Merged Container + Input styles
    composerInput: {
        backgroundColor: COLORS.inputBg,
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 10,
        marginRight: 10,
        color: '#000000', // Explicit Black
        fontSize: 15,
        lineHeight: 20,
        // Ensure standard margins are reset if GiftedChat adds them
        marginLeft: 0,
        marginTop: 0,
        marginBottom: 0,
    },
    sendContainer: {
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonActive: {
        backgroundColor: COLORS.primary,
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 2,
    },
    sendButtonInactive: {
        backgroundColor: '#f3f4f6',
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
