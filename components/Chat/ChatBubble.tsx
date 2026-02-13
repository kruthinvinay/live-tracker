import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Bubble, BubbleProps, IMessage } from 'react-native-gifted-chat';

const COLORS = {
    mine: '#6366f1',
    ai: '#ffffff',
    textLeft: '#1f2937',
    textRight: '#ffffff',
    timestampLeft: '#9ca3af',
    timestampRight: '#e0e7ff',
    senderName: '#6366f1',
};

export const ChatBubble = (props: BubbleProps<IMessage>) => {
    return (
        <Bubble
            {...props}
            wrapperStyle={{
                right: styles.bubbleRight,
                left: styles.bubbleLeft,
            }}
            textStyle={{
                right: styles.textRight,
                left: styles.textLeft,
            }}
            renderUsername={() => {
                // Only show sender name on left (partner) bubbles
                if (props.position === 'left' && props.currentMessage?.user?.name) {
                    return (
                        <Text style={styles.senderName}>
                            {props.currentMessage.user.name}
                        </Text>
                    );
                }
                return null;
            }}
            renderTime={(timeProps) => (
                <View style={styles.timeContainer}>
                    <Text style={[
                        styles.timeText,
                        { color: timeProps.position === 'right' ? COLORS.timestampRight : COLORS.timestampLeft }
                    ]}>
                        {timeProps.currentMessage?.createdAt
                            ? new Date(timeProps.currentMessage.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()
                            : ''}
                    </Text>
                    {timeProps.position === 'right' && (
                        <Ionicons name="checkmark-done" size={14} color="#e0e7ff" />
                    )}
                </View>
            )}
        />
    );
};

const styles = StyleSheet.create({
    bubbleRight: {
        backgroundColor: COLORS.mine,
        borderTopRightRadius: 0, // Tail emulation
        borderRadius: 12,
        elevation: 1,
        marginBottom: 4,
    },
    bubbleLeft: {
        backgroundColor: COLORS.ai,
        borderTopLeftRadius: 0, // Tail emulation
        borderRadius: 12,
        elevation: 1,
        marginLeft: 0,
        marginBottom: 4,
    },
    textRight: {
        color: COLORS.textRight,
        fontSize: 14.5,
        lineHeight: 20,
    },
    textLeft: {
        color: COLORS.textLeft,
        fontSize: 14.5,
        lineHeight: 20,
    },
    senderName: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.senderName,
        marginLeft: 10,
        marginTop: 4,
        marginBottom: 2,
    },
    timeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingRight: 6,
        paddingBottom: 4,
    },
    timeText: {
        fontSize: 10,
        marginRight: 4,
    },
});

