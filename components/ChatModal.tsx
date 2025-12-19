
import { signInAnonymously } from 'firebase/auth';
import { off, onValue, push, ref } from 'firebase/database';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Bubble, GiftedChat, IMessage } from 'react-native-gifted-chat';
import { auth, db } from '../firebaseConfig';

interface ChatModalProps {
    visible: boolean;
    onClose: () => void;
    roomCode: string;
}

export const ChatModal = ({ visible, onClose, roomCode }: ChatModalProps) => {
    const [messages, setMessages] = useState<IMessage[]>([]);
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Auth
    useEffect(() => {
        signInAnonymously(auth).then((userCredential) => {
            setUser(userCredential.user);
            setLoading(false);
        }).catch((error) => {
            console.error("Chat Login Error:", error);
            setLoading(false);
        });
    }, []);

    // Listen for Messages
    useEffect(() => {
        if (!roomCode) return;
        const chatRef = ref(db, `chats/${roomCode}`);
        const unsubscribe = onValue(chatRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const parsedMessages = Object.keys(data).map(key => ({
                    _id: key,
                    ...data[key],
                    createdAt: new Date(data[key].createdAt)
                })).sort((a: IMessage, b: IMessage) => (b.createdAt as number) - (a.createdAt as number));
                setMessages(parsedMessages);
            } else {
                setMessages([]);
            }
        });

        return () => off(chatRef);
    }, [roomCode]);

    const onSend = useCallback((newMessages: IMessage[] = []) => {
        setMessages(previousMessages => GiftedChat.append(previousMessages, newMessages));
        const { _id, createdAt, text, user: msgUser } = newMessages[0];
        const chatRef = ref(db, `chats/${roomCode}`);
        push(chatRef, {
            _id,
            createdAt: new Date().toISOString(),
            text,
            user: msgUser
        });
    }, [roomCode]);

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
            <View style={styles.container}>
                {/* HEADER */}
                <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 50 : 20 }]}>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Text style={styles.closeText}>✕</Text>
                    </TouchableOpacity>
                    <View style={styles.headerTitle}>
                        <Text style={styles.titleText}>SECURE CHANNEL</Text>
                        <View style={styles.statusRow}>
                            <View style={styles.statusDot} />
                            <Text style={styles.statusText}>ENCRYPTED • {roomCode}</Text>
                        </View>
                    </View>
                    <View style={{ width: 30 }} />
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#000" style={{ marginTop: 20 }} />
                ) : (
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                        style={{ flex: 1 }}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                    >
                        <GiftedChat
                            messages={messages}
                            onSend={msgs => onSend(msgs)}
                            user={{
                                _id: user?.uid || 1,
                                name: 'Agent',
                            }}
                            renderAvatar={null}
                            alwaysShowSend
                            scrollToBottom
                            renderBubble={props => (
                                <Bubble
                                    {...props}
                                    wrapperStyle={{
                                        right: { backgroundColor: '#3182CE' },
                                        left: { backgroundColor: '#fff' }
                                    }}
                                    textStyle={{
                                        right: { color: '#fff' },
                                        left: { color: '#000' }
                                    }}
                                />
                            )}
                        />
                    </KeyboardAvoidingView>
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    header: {
        paddingTop: Platform.OS === 'android' ? 40 : 20,
        paddingBottom: 15,
        paddingHorizontal: 15,
        backgroundColor: '#263238',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        elevation: 5
    },
    closeBtn: { padding: 5 },
    closeText: { fontSize: 24, color: '#fff', fontWeight: 'bold' },
    headerTitle: { alignItems: 'center' },
    titleText: { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: 1 },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00E676', marginRight: 4 },
    statusText: { fontSize: 10, color: '#B0BEC5' }
});
