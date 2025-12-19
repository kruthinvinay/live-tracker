
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ControlDockProps {
    roomCode: string;
    onPing: () => void;
    onSos: () => void;
    onChat: () => void;
}

export const ControlDock = ({ roomCode, onPing, onSos, onChat }: ControlDockProps) => {
    return (
        <View style={styles.controlPanel}>
            <Text style={styles.roomBadge}>SECURE CHANNEL: {roomCode}</Text>

            <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.iconButton} onPress={onPing}>
                    <Text style={styles.iconButtonText}>📡 PING</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconButton, { backgroundColor: '#E53935' }]} onPress={onSos}>
                    <Text style={styles.iconButtonText}>⚠️ SOS</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconButton, { backgroundColor: '#FF9800' }]} onPress={onChat}>
                    <Text style={styles.iconButtonText}>💬 CHAT</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.statusText}>
                Background Tracking Active 🟢
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    controlPanel: {
        position: 'absolute',
        bottom: 40,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(255,255,255,0.95)',
        padding: 25,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.6)'
    },
    roomBadge: {
        position: 'absolute',
        top: -12,
        backgroundColor: '#2D3748',
        color: 'white',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        fontWeight: '700',
        fontSize: 12,
        overflow: 'hidden',
        letterSpacing: 0.5,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 15,
        width: '100%',
        justifyContent: 'space-between'
    },
    iconButton: {
        flex: 1,
        backgroundColor: '#48BB78',
        paddingVertical: 15,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 3
    },
    iconButtonText: {
        color: 'white',
        fontWeight: '800',
        fontSize: 14,
        letterSpacing: 1
    },
    statusText: {
        textAlign: 'center',
        marginTop: 10,
        color: '#888',
        fontSize: 10
    }
});
