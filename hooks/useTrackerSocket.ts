
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useCallback, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { io, Socket } from 'socket.io-client';

const SERVER_URL = 'https://spyglass-server-h7pe.onrender.com';
const LOCATION_TASK_NAME = 'LOCATION_TRACKING';

// Define the background task globally
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
        console.error("Background Task Error:", error);
        return;
    }
    if (data) {
        const { locations } = data as any;
        const loc = locations[0];
        if (loc) {
            console.log("Background Location:", loc.coords.latitude, loc.coords.longitude);
            // Fresh socket for background execution
            const bgSocket = io(SERVER_URL, { transports: ['websocket'] });
            bgSocket.emit('bg_location_update', {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude
            });
        }
    }
});

export type ToastType = 'info' | 'success' | 'error';

interface UseTrackerSocketProps {
    onToast: (msg: string, type: ToastType) => void;
}

export const useTrackerSocket = ({ onToast }: UseTrackerSocketProps) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [friendLocation, setFriendLocation] = useState<{ latitude: number, longitude: number } | null>(null);

    const connect = useCallback((roomCode: string) => {
        if (!roomCode) return onToast("Please Enter Room Code", "error");

        onToast("Connecting to Satellite...", "info");

        const newSocket = io(SERVER_URL, {
            transports: ['websocket'],
            reconnection: true,
        });
        setSocket(newSocket);

        newSocket.on('connect_error', (err) => {
            console.log("Connection Error:", err.message);
            onToast(`Connection Failed: ${err.message}`, "error");
        });

        newSocket.on('connect', async () => {
            console.log('Connected to server');
            newSocket.emit('join', roomCode);

            // Start Background Tracking
            const { status } = await Location.requestBackgroundPermissionsAsync();
            if (status === 'granted') {
                await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
                    accuracy: Location.Accuracy.BestForNavigation,
                    timeInterval: 2000,
                    distanceInterval: 0,
                    foregroundService: {
                        notificationTitle: "SpyGlass Live",
                        notificationBody: "Broadcasting High-Speed Location..."
                    },
                    pausesUpdatesAutomatically: false,
                    activityType: Location.ActivityType.AutomotiveNavigation,
                });
                console.log("Background Service Started");
            }
        });

        newSocket.on('join_success', () => {
            setIsConnected(true);
        });

        newSocket.on('error', (msg: string) => {
            onToast(msg, "error");
            newSocket.disconnect();
            setIsConnected(false);
        });

        newSocket.on('partner_connected', () => {
            setIsConnected(true);
            onToast("Partner Connected! 🟢", "success");
        });

        newSocket.on('update_map', (coords: { latitude: number; longitude: number }) => {
            console.log('Friend moved:', coords);
            setFriendLocation(coords);
            onToast("Target Moved! Updating Map...", "info");
        });

        newSocket.on('wake_up_and_send_location', async () => {
            console.log('WAKE UP RECEIVED!');
            onToast("Tracker pinged you! Sending location...", "info");
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            newSocket.emit('send_location', {
                roomCode,
                location: {
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude
                }
            });
        });

        newSocket.on('receive_alert', ({ location, phoneNumber }) => {
            Alert.alert(
                "🚨 EMERGENCY 🚨",
                `Friend needs help!\nLat: ${location.latitude}\nLng: ${location.longitude}`,
                [
                    { text: "Call Now 📞", onPress: () => Linking.openURL(`tel:${phoneNumber}`) },
                    { text: "Cancel", style: "cancel" }
                ]
            );
            setFriendLocation(location);
        });

    }, [onToast]);

    const requestFriendLocation = useCallback((roomCode: string) => {
        socket?.emit('request_location', roomCode);
        onToast("📡  Ping Sent! Waiting for response...", "success");
    }, [socket, onToast]);

    const sendEmergencyAlert = useCallback(async (roomCode: string, myPhone: string) => {
        const loc = await Location.getCurrentPositionAsync({});
        if (!loc) return onToast("Wait for GPS lock...", "error");

        socket?.emit('emergency_alert', {
            roomCode,
            location: { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
            phoneNumber: myPhone
        });
        onToast("🚨 SOS Distress Signal Sent!", "error");
    }, [socket, onToast]);

    return {
        socket,
        isConnected,
        friendLocation,
        connect,
        requestFriendLocation,
        sendEmergencyAlert
    };
};
