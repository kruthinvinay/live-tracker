import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = 'SPYGLASS_SESSION';
const DEVICE_ID_KEY = 'SPYGLASS_DEVICE_ID';

interface SessionData {
    userName: string;
    roomCode: string;
    phoneNumber: string;
}

export const saveSession = async (data: SessionData): Promise<void> => {
    try {
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch (e) {
        console.error('Failed to save session:', e);
    }
};

export const loadSession = async (): Promise<SessionData | null> => {
    try {
        const raw = await AsyncStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        console.error('Failed to load session:', e);
        return null;
    }
};

export const clearSession = async (): Promise<void> => {
    try {
        await AsyncStorage.removeItem(SESSION_KEY);
    } catch (e) {
        console.error('Failed to clear session:', e);
    }
};

// Generate a unique, persistent device ID (never changes across restarts)
export const getDeviceId = async (): Promise<string> => {
    try {
        let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (!id) {
            id = 'device_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
            await AsyncStorage.setItem(DEVICE_ID_KEY, id);
        }
        return id;
    } catch (e) {
        console.error('Failed to get device ID:', e);
        return 'fallback_' + Date.now();
    }
};

