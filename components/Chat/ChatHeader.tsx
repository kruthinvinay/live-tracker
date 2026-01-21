import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ChatHeaderProps {
    onClose: () => void;
    partnerName: string;
    partnerTyping: boolean;
}

const COLORS = {
    primary: '#6366f1',
    green: '#22c55e',
    text: '#1f2937',
};

export const ChatHeader = ({ onClose, partnerName, partnerTyping }: ChatHeaderProps) => {
    return (
        <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color="#1f2937" />
            </TouchableOpacity>

            <View style={styles.headerContent}>
                <View style={styles.avatarContainer}>
                    <View style={styles.avatarUser}>
                        <Ionicons name="person" size={20} color={COLORS.primary} />
                    </View>
                    {/* Green Dot if Partner Name is Known */}
                    {partnerName !== "Secure Channel" && <View style={styles.onlineDot} />}
                </View>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.headerTitle}>{partnerName}</Text>
                    <Text style={[styles.headerStatus, { color: partnerTyping ? COLORS.primary : COLORS.green }]}>
                        {partnerTyping ? "typing..." : (partnerName === "Secure Channel" ? "Waiting..." : "Online")}
                    </Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 60 : 50,
        paddingBottom: 12,
        paddingHorizontal: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        elevation: 4,
        zIndex: 10,
    },
    backButton: {
        marginRight: 12,
    },
    headerContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarContainer: {
        position: 'relative',
        width: 40,
        height: 40,
        marginRight: 12,
    },
    avatarUser: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#e0e7ff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    onlineDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 12,
        height: 12,
        backgroundColor: COLORS.green,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#fff',
    },
    headerTextContainer: {
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.text,
        lineHeight: 20,
    },
    headerStatus: {
        fontSize: 12,
        fontWeight: '500',
    },
});
