import { Ionicons } from '@expo/vector-icons';
import { Dimensions, Image, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ImageViewerProps {
    imageUri: string | null;
    visible: boolean;
    onClose: () => void;
}

export const ChatImageViewer = ({ imageUri, visible, onClose }: ImageViewerProps) => {
    if (!imageUri) return null;

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent={true}
        >
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                    <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>

                <Image
                    source={{ uri: imageUri }}
                    style={styles.fullImage}
                    resizeMode="contain"
                />
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        zIndex: 10,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 20,
        padding: 8,
    },
    fullImage: {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT * 0.75,
    },
});
