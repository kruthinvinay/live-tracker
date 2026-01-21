import { Ionicons } from '@expo/vector-icons';
import { signInAnonymously } from 'firebase/auth';
import { onValue, push, ref, set } from 'firebase/database';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, View } from 'react-native';
import { GiftedChat, IMessage, InputToolbar, Send } from 'react-native-gifted-chat';
import { auth, db } from '../firebaseConfig';

// Modular Components
import { ChatBubble } from './Chat/ChatBubble';
import { ChatHeader } from './Chat/ChatHeader';
import { ChatKeyboardWrapper } from './Chat/ChatKeyboardWrapper';

interface ChatModalProps {
    visible: boolean;
    onClose: () => void;
    roomCode: string;
    userName: string;
}

const COLORS = {
    bg: '#f1f5f9',
    primary: '#6366f1',
    inputBg: '#f3f4f6',
    placeholder: '#9ca3af',
};

export const ChatModal = ({ visible, onClose, roomCode, userName }: ChatModalProps) => {
    const [messages, setMessages] = useState<IMessage[]>([]);
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [partnerName, setPartnerName] = useState<string>("Secure Channel");
    const [partnerTyping, setPartnerTyping] = useState(false);

    // 1. Auth & Data
    useEffect(() => {
        // If already signed in, use existing user
        if (auth.currentUser) {
            setUser(auth.currentUser);
            setLoading(false);
            return;
        }

        // Otherwise sign in anonymously
        signInAnonymously(auth).then((userCredential) => {
            setUser(userCredential.user);
            setLoading(false);
        }).catch((error) => {
            console.error("Chat Login Error:", error);
            setLoading(false);
        });
    }, []);

    useEffect(() => {
        if (!roomCode || !user) return;

        const chatRef = ref(db, `chats/${roomCode}/messages`);
        const unsubscribeMsg = onValue(chatRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const parsedMessages = Object.keys(data).map(key => ({
                    _id: key,
                    ...data[key],
                    createdAt: new Date(data[key].createdAt)
                })).sort((a: IMessage, b: IMessage) => (b.createdAt as number) - (a.createdAt as number));
                setMessages(parsedMessages);

                const partnerMsg = parsedMessages.find((m: any) => m.user?._id !== user?.uid);
                if (partnerMsg && partnerMsg.user?.name) {
                    setPartnerName(partnerMsg.user.name);
                }
            } else {
                setMessages([]);
            }
        });

        const typingRef = ref(db, `chats/${roomCode}/typing`);
        const unsubscribeTyping = onValue(typingRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const otherTyping = Object.keys(data).some(key => key !== user?.uid && data[key] === true);
                setPartnerTyping(otherTyping);
            } else {
                setPartnerTyping(false);
            }
        });

        return () => {
            unsubscribeMsg();
            unsubscribeTyping();
            if (user) {
                set(ref(db, `chats/${roomCode}/typing/${user.uid}`), false);
            }
        };
    }, [roomCode, user]);

    // 2. Handlers
    const handleInputChanged = useCallback((text: string) => {
        if (!roomCode || !user) return;
        set(ref(db, `chats/${roomCode}/typing/${user.uid}`), text.length > 0);
    }, [roomCode, user]);

    const onSend = useCallback((newMessages: IMessage[] = []) => {
        setMessages(previousMessages => GiftedChat.append(previousMessages, newMessages));
        const { _id, createdAt, text, user: msgUser } = newMessages[0];

        push(ref(db, `chats/${roomCode}/messages`), {
            _id,
            createdAt: new Date().toISOString(),
            text,
            user: msgUser
        });

        if (user) {
            set(ref(db, `chats/${roomCode}/typing/${user.uid}`), false);
        }
    }, [roomCode, user]);

    // 3. Render
    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={false}
            presentationStyle="fullScreen"
            statusBarTranslucent={true} // Allow modal to cover status bar area
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <ChatHeader
                    onClose={onClose}
                    partnerName={partnerName}
                    partnerTyping={partnerTyping}
                />

                <ChatKeyboardWrapper>
                    {loading ? (
                        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />
                    ) : (
                        <GiftedChat
                            messages={messages}
                            onSend={onSend}
                            user={{
                                _id: user?.uid || 1,
                                name: userName || 'Me',
                            }}
                            renderAvatar={null}
                            alwaysShowSend
                            scrollToBottom
                            listViewProps={{
                                style: { backgroundColor: COLORS.bg },
                                keyboardDismissMode: 'interactive',
                            }}

                            // Bubbles
                            renderBubble={props => <ChatBubble {...props} />}
                            isTyping={partnerTyping}
                            onInputTextChanged={handleInputChanged}

                            // STABLE PROPS-BASED STYLING
                            textInputStyle={{
                                backgroundColor: COLORS.inputBg,
                                borderRadius: 20,
                                paddingTop: 10,
                                paddingBottom: 10,
                                paddingHorizontal: 12,
                                marginRight: 10,
                                color: '#000000', // Black Text
                                fontSize: 15,
                                lineHeight: 20,
                                marginTop: 6,
                                marginBottom: 6,
                            }}
                            textInputProps={{
                                style: { color: '#000000' }
                            }}
                            minInputToolbarHeight={56}

                            // Input Toolbar Overrides
                            renderInputToolbar={props => (
                                <InputToolbar
                                    {...props}
                                    containerStyle={{
                                        backgroundColor: 'white',
                                        borderTopColor: '#f3f4f6',
                                        borderTopWidth: 1,
                                        paddingHorizontal: 8,
                                    }}
                                    primaryStyle={{ alignItems: 'center' }}
                                />
                            )}

                            // Send Button
                            renderSend={props => (
                                <View style={{ justifyContent: 'center', height: 56, marginRight: 4 }}>
                                    {props.text && props.text.trim().length > 0 ? (
                                        <Send {...props} containerStyle={{ justifyContent: 'center' }}>
                                            <View style={{
                                                backgroundColor: COLORS.primary,
                                                width: 40,
                                                height: 40,
                                                borderRadius: 20,
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                            }}>
                                                <Ionicons name="send" size={18} color="#fff" style={{ marginLeft: 3 }} />
                                            </View>
                                        </Send>
                                    ) : (
                                        <View style={{
                                            backgroundColor: '#f3f4f6',
                                            width: 40,
                                            height: 40,
                                            borderRadius: 20,
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                        }}>
                                            <Ionicons name="send" size={18} color={COLORS.placeholder} style={{ marginLeft: 3 }} />
                                        </View>
                                    )}
                                </View>
                            )}
                        />
                    )}
                </ChatKeyboardWrapper>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
});
