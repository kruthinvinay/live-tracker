import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { signInAnonymously } from 'firebase/auth';
import { onValue, push, ref, set } from 'firebase/database';
import { getDownloadURL, ref as storageRef, uploadBytesResumable } from 'firebase/storage';
import { useCallback, useEffect, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Dimensions, Image, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GiftedChat, IMessage, InputToolbar, Send } from 'react-native-gifted-chat';
import { auth, db, storage } from '../firebaseConfig';
import { getDeviceId } from '../hooks/sessionStorage';

// Modular Components
import { ChatBubble } from './Chat/ChatBubble';
import { ChatHeader } from './Chat/ChatHeader';
import { ChatImageViewer } from './Chat/ChatImageViewer';
import { ChatKeyboardWrapper } from './Chat/ChatKeyboardWrapper';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ChatModalProps {
    visible: boolean;
    onClose: () => void;
    roomCode: string;
    userName: string;
    isPartnerOnline: boolean;
}

const COLORS = {
    bg: '#f1f5f9',
    primary: '#6366f1',
    inputBg: '#f3f4f6',
    placeholder: '#9ca3af',
};

export const ChatModal = ({ visible, onClose, roomCode, userName, isPartnerOnline }: ChatModalProps) => {
    const [messages, setMessages] = useState<IMessage[]>([]);
    const [user, setUser] = useState<any>(null);
    const [deviceId, setDeviceId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const [partnerName, setPartnerName] = useState<string>("Secure Channel");
    const [partnerTyping, setPartnerTyping] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [viewerImage, setViewerImage] = useState<string | null>(null);

    // 1. Auth & Device ID
    useEffect(() => {
        const init = async () => {
            // Get persistent device ID
            const id = await getDeviceId();
            setDeviceId(id);

            // Firebase auth (for DB access)
            if (auth.currentUser) {
                setUser(auth.currentUser);
            } else {
                try {
                    const cred = await signInAnonymously(auth);
                    setUser(cred.user);
                } catch (error) {
                    console.error("Chat Login Error:", error);
                }
            }
            setLoading(false);
        };
        init();
    }, []);

    useEffect(() => {
        if (!roomCode || !user || !deviceId) return;

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

                const partnerMsg = parsedMessages.find((m: any) => m.user?._id !== deviceId);
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
                const otherTyping = Object.keys(data).some(key => key !== deviceId && data[key] === true);
                setPartnerTyping(otherTyping);
            } else {
                setPartnerTyping(false);
            }
        });

        return () => {
            unsubscribeMsg();
            unsubscribeTyping();
            if (deviceId) {
                set(ref(db, `chats/${roomCode}/typing/${deviceId}`), false);
            }
        };
    }, [roomCode, user, deviceId]);

    // 2. Handlers
    const handleInputChanged = useCallback((text: string) => {
        if (!roomCode || !deviceId) return;
        set(ref(db, `chats/${roomCode}/typing/${deviceId}`), text.length > 0);
    }, [roomCode, deviceId]);

    const onSend = useCallback((newMessages: IMessage[] = []) => {
        setMessages(previousMessages => GiftedChat.append(previousMessages, newMessages));
        const { _id, createdAt, text, user: msgUser, image } = newMessages[0];

        const messageData: any = {
            _id,
            createdAt: new Date().toISOString(),
            text: text || '',
            user: msgUser
        };
        if (image) {
            messageData.image = image;
        }

        push(ref(db, `chats/${roomCode}/messages`), messageData);

        if (deviceId) {
            set(ref(db, `chats/${roomCode}/typing/${deviceId}`), false);
        }
    }, [roomCode, deviceId]);

    // 2b. Image Upload
    const uploadImage = async (uri: string) => {
        try {
            setUploading(true);
            setUploadProgress(0);

            // Fetch blob using XMLHttpRequest (more reliable on Android)
            const blob = await new Promise<Blob>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.onload = function () {
                    resolve(xhr.response);
                };
                xhr.onerror = function (e) {
                    console.error('XHR Error:', e);
                    reject(new TypeError('Network request failed'));
                };
                xhr.responseType = 'blob';
                xhr.open('GET', uri, true);
                xhr.send(null);
            });

            const filename = `chat_images/${roomCode}/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
            const imageRef = storageRef(storage, filename);

            const uploadTask = uploadBytesResumable(imageRef, blob);

            return new Promise<string>((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        setUploadProgress(progress);
                    },
                    (error) => {
                        console.error('Upload failed:', error);
                        setUploading(false);
                        reject(error);
                    },
                    async () => {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        setUploading(false);
                        resolve(downloadURL);
                    }
                );
            });
        } catch (error) {
            console.error('Upload error:', error);
            setUploading(false);
            throw error;
        }
    };

    const pickImage = async (useCamera: boolean) => {
        try {
            const permResult = useCamera
                ? await ImagePicker.requestCameraPermissionsAsync()
                : await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (permResult.status !== 'granted') {
                Alert.alert('Permission needed', `Please allow ${useCamera ? 'camera' : 'photo library'} access.`);
                return;
            }

            const result = useCamera
                ? await ImagePicker.launchCameraAsync({
                    mediaTypes: ['images'],
                    quality: 0.7,
                    allowsEditing: false, // Fix: Disable crop screen
                })
                : await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ['images'],
                    quality: 0.7,
                    allowsEditing: false, // Fix: Disable crop screen
                });

            if (!result.canceled && result.assets[0]) {
                const imageUri = result.assets[0].uri;
                const downloadURL = await uploadImage(imageUri);

                // Send as image message
                const imageMessage: IMessage = {
                    _id: Date.now().toString(),
                    createdAt: new Date(),
                    text: '',
                    image: downloadURL,
                    user: {
                        _id: deviceId || 'unknown',
                        name: userName || 'Me',
                    },
                };
                onSend([imageMessage]);
            }
        } catch (error) {
            console.error('Image pick error:', error);
            Alert.alert('Error', 'Failed to send image. Please try again.');
        }
    };

    const showAttachmentOptions = () => {
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: ['Cancel', '📷 Camera', '🖼️ Gallery'],
                    cancelButtonIndex: 0,
                },
                (buttonIndex) => {
                    if (buttonIndex === 1) pickImage(true);
                    if (buttonIndex === 2) pickImage(false);
                }
            );
        } else {
            // Android: simple Alert as action sheet
            Alert.alert(
                'Send Image',
                'Choose an option',
                [
                    { text: '📷 Camera', onPress: () => pickImage(true) },
                    { text: '🖼️ Gallery', onPress: () => pickImage(false) },
                    { text: 'Cancel', style: 'cancel' },
                ]
            );
        }
    };

    // 2c. Custom Message Image Renderer (WhatsApp-style)
    const renderMessageImage = (props: any) => {
        const { currentMessage } = props;
        return (
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setViewerImage(currentMessage.image)}
            >
                <Image
                    source={{ uri: currentMessage.image }}
                    style={{
                        width: SCREEN_WIDTH * 0.6,
                        height: SCREEN_WIDTH * 0.6,
                        borderRadius: 13,
                        margin: 3,
                    }}
                    resizeMode="cover"
                />
            </TouchableOpacity>
        );
    };

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
                    isPartnerOnline={isPartnerOnline}
                />

                <ChatKeyboardWrapper>
                    {loading ? (
                        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />
                    ) : (
                        <GiftedChat
                            messages={messages}
                            onSend={onSend}
                            user={{
                                _id: deviceId || 'unknown',
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
                            renderUsernameOnMessage={true}
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

                            // Image message rendering
                            renderMessageImage={renderMessageImage}

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

                            // Actions (attachment button)
                            renderActions={() => (
                                <TouchableOpacity
                                    style={{
                                        justifyContent: 'center',
                                        height: 56,
                                        paddingLeft: 4,
                                        paddingRight: 4,
                                    }}
                                    onPress={showAttachmentOptions}
                                >
                                    <Ionicons name="attach" size={24} color={COLORS.primary} />
                                </TouchableOpacity>
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

                {/* Upload Progress */}
                {uploading && (
                    <View style={styles.uploadOverlay}>
                        <View style={styles.uploadBox}>
                            <ActivityIndicator size="large" color={COLORS.primary} />
                            <Text style={styles.uploadText}>Sending image... {Math.round(uploadProgress)}%</Text>
                            <View style={styles.progressBar}>
                                <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
                            </View>
                        </View>
                    </View>
                )}

                {/* Fullscreen Image Viewer */}
                <ChatImageViewer
                    imageUri={viewerImage}
                    visible={!!viewerImage}
                    onClose={() => setViewerImage(null)}
                />
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    uploadOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    uploadBox: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        width: '70%',
    },
    uploadText: {
        marginTop: 12,
        fontSize: 15,
        color: '#333',
        fontWeight: '500',
    },
    progressBar: {
        width: '100%',
        height: 4,
        backgroundColor: '#e5e7eb',
        borderRadius: 2,
        marginTop: 12,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: COLORS.primary,
        borderRadius: 2,
    },
});
