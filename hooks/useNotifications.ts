import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

// Set up Android notification channel for priority
if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('spyglass-alerts', {
        name: 'SpyGlass Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
    });

    Notifications.setNotificationChannelAsync('spyglass-chat', {
        name: 'SpyGlass Chat',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
    });
}

export async function requestNotificationPermissions(): Promise<boolean> {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    return finalStatus === 'granted';
}

export async function sendChatNotification(senderName: string, messageText: string) {
    await Notifications.scheduleNotificationAsync({
        content: {
            title: `💬 ${senderName}`,
            body: messageText,
            sound: 'default',
            ...(Platform.OS === 'android' && { channelId: 'spyglass-chat' }),
        },
        trigger: null, // Immediate
    });
}

export async function sendSOSNotification(senderName?: string) {
    await Notifications.scheduleNotificationAsync({
        content: {
            title: '🚨 EMERGENCY SOS ALERT!',
            body: `${senderName || 'Your partner'} has triggered an emergency alert!`,
            sound: 'default',
            priority: Notifications.AndroidNotificationPriority.MAX,
            ...(Platform.OS === 'android' && { channelId: 'spyglass-alerts' }),
        },
        trigger: null,
    });
}

export function useNotificationSetup() {
    useEffect(() => {
        // Request permissions on mount
        requestNotificationPermissions();

        // Listen for notification received while app is foregrounded
        const notifSub = Notifications.addNotificationReceivedListener(notification => {
            console.log('Notification received:', notification);
        });

        // Listen for user tapping on a notification
        const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
            console.log('Notification tapped:', response);
        });

        return () => {
            notifSub.remove();
            responseSub.remove();
        };
    }, []);
}
