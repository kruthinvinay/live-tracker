import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { signInAnonymously } from 'firebase/auth';
import { onValue, ref } from 'firebase/database';
import { ChatModal } from '../../components/ChatModal';
import { ControlDock } from '../../components/ControlDock';
import { auth, db } from '../../firebaseConfig';
import { clearSession, getDeviceId, loadSession, saveSession } from '../../hooks/sessionStorage';
import { sendChatNotification, useNotificationSetup } from '../../hooks/useNotifications';
import { ToastType, useTrackerSocket } from '../../hooks/useTrackerSocket';

// === CUSTOM TOAST COMPONENT ===
const Toast = ({ message, visible, type = 'info' }: { message: string, visible: boolean, type?: ToastType }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(2500),
        Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true })
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const bgColors = {
    info: '#3182CE',
    success: '#48BB78',
    error: '#E53935'
  };

  return (
    <Animated.View style={[styles.toastContainer, { opacity: fadeAnim, backgroundColor: bgColors[type as keyof typeof bgColors] }]}>
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
};

export default function HomeScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [userName, setUserName] = useState('');
  const [chatVisible, setChatVisible] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const mapRef = useRef<MapView>(null);

  // Toast State
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' as ToastType });
  const showToast = (msg: string, type: ToastType = 'info') => {
    setToast({ visible: true, message: msg, type });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  // HOOK: Notification setup
  useNotificationSetup();

  // HOOK: Tracker Socket Logic
  const { isConnected, isPartnerOnline, friendLocation, connect, disconnect, requestFriendLocation, sendEmergencyAlert } = useTrackerSocket({
    onToast: showToast
  });

  // Background chat notification listener (fires when chat modal is closed)
  useEffect(() => {
    if (!isConnected || !roomCode || chatVisible) return;

    let lastMessageCount = 0;
    let isFirstLoad = true;

    const setup = async () => {
      const myId = await getDeviceId();

      // Ensure Firebase is authenticated before listening
      if (!auth.currentUser) {
        try { await signInAnonymously(auth); } catch (e) { console.error('BG auth failed:', e); return; }
      }

      const chatRef = ref(db, `chats/${roomCode}/messages`);

      const unsubscribe = onValue(chatRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        const allMessages = Object.values(data) as any[];
        const currentCount = allMessages.length;

        // Skip the initial load (don't notify for existing messages)
        if (isFirstLoad) {
          lastMessageCount = currentCount;
          isFirstLoad = false;
          return;
        }

        // Only notify if there are NEW messages
        if (currentCount > lastMessageCount) {
          // Get the newest message
          const sorted = allMessages.sort((a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          const newest = sorted[0];

          // Only notify if the newest message is from the partner
          if (newest?.user?._id !== myId) {
            sendChatNotification(
              newest?.user?.name || 'Partner',
              newest?.text || 'New message'
            );
          }
        }
        lastMessageCount = currentCount;
      });

      return unsubscribe;
    };

    let cleanup: (() => void) | undefined;
    setup().then(unsub => { cleanup = unsub; });

    return () => {
      if (cleanup) cleanup();
    };
  }, [isConnected, roomCode, chatVisible]);

  // Load saved session on mount
  useEffect(() => {
    (async () => {
      const session = await loadSession();
      if (session) {
        setUserName(session.userName);
        setRoomCode(session.roomCode);
        setPhoneNumber(session.phoneNumber);
      }
      setSessionLoaded(true);
    })();
  }, []);

  // Auto-connect once session is loaded and we have saved data
  useEffect(() => {
    if (sessionLoaded && userName && roomCode && !isConnected) {
      connect(roomCode);
    }
  }, [sessionLoaded]);

  // Effect: Animate Map when Friend Moves
  useEffect(() => {
    if (friendLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: friendLocation.latitude,
        longitude: friendLocation.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 1000);
    }
  }, [friendLocation]);

  // Initial Location
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission denied');
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);

      // Animate map to actual location once GPS locks in
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);
      }
    })();
  }, []);

  const handleConnect = () => {
    // VIP Logic (Vinnie & Paddu Private Channel)
    const normalizedPhone = phoneNumber.replace(/\s+/g, '').replace(/-/g, '');
    let finalName = userName.trim();
    let finalRoom = roomCode.trim();

    if (normalizedPhone === '+918925126949') {
      finalName = "Vinnie";
      finalRoom = "infinity"; // Permanent VIP Channel
      showToast("VIP Mode: Welcome Vinnie! 💖", "success");
    } else if (normalizedPhone === '+916309710493') {
      finalName = "Paddu";
      finalRoom = "infinity"; // Permanent VIP Channel
      showToast("VIP Mode: Welcome Paddu! 💖", "success");
    }

    if (!finalName) {
      showToast("Please enter your name", "error");
      return;
    }
    // Only check room code if not VIP (VIPs get auto-assigned)
    if (!finalRoom) {
      showToast("Please enter a room code", "error");
      return;
    }

    // Update state to reflect overrides if any
    setUserName(finalName);
    setRoomCode(finalRoom);

    connect(finalRoom);
    saveSession({ userName: finalName, roomCode: finalRoom, phoneNumber: phoneNumber.trim() });
  };

  const handleDisconnect = async () => {
    await clearSession();
    disconnect();
    setUserName('');
    setRoomCode('');
    setPhoneNumber('');
  };

  // RENDER: Login Screen
  if (!isConnected) {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.loginContainer}>
          <Toast message={toast.message} visible={toast.visible} type={toast.type} />
          <StatusBar style="dark" />
          <Text style={styles.loginTitle}>Spy Glass 🛰️</Text>
          <Text style={styles.loginSubtitle}>Real-time Remote Tracker</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Your Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Kruthin"
              value={userName}
              onChangeText={setUserName}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Room Code</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 007"
              value={roomCode}
              onChangeText={setRoomCode}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>My Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. +91..."
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
            />
          </View>

          <TouchableOpacity
            style={styles.generateButton}
            onPress={() => setRoomCode(Math.floor(100 + Math.random() * 900).toString())}
          >
            <Text style={styles.generateButtonText}>🎲 Generate Random Code</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.connectButton} onPress={handleConnect}>
            <Text style={styles.connectButtonText}>Connect to Satellite</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    );
  }

  // RENDER: Map Screen
  return (
    <View style={styles.container}>
      <Toast message={toast.message} visible={toast.visible} type={toast.type} />
      <StatusBar style="dark" backgroundColor="transparent" translucent />

      {/* Disconnect Button */}
      <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect}>
        <Text style={styles.disconnectText}>✕</Text>
      </TouchableOpacity>

      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: location?.coords.latitude || 37.78825,
          longitude: location?.coords.longitude || -122.4324,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={true}
      >
        {friendLocation && (
          <Marker coordinate={friendLocation} title="Partner">
            <View style={styles.markerContainer}>
              <View style={styles.markerCircle}>
                <Text style={styles.markerText}>👤</Text>
              </View>
              <View style={styles.markerArrow} />
            </View>
          </Marker>
        )}
      </MapView>

      <ControlDock
        roomCode={roomCode}
        onPing={() => requestFriendLocation(roomCode)}
        onSos={() => sendEmergencyAlert(roomCode, phoneNumber)}
        onChat={() => setChatVisible(true)}
      />

      <ChatModal
        visible={chatVisible}
        onClose={() => setChatVisible(false)}
        roomCode={roomCode}
        userName={userName}
        isPartnerOnline={isPartnerOnline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },

  // Disconnect Button
  disconnectButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disconnectText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },

  // === PREMIUM LOGIN SCREEN ===
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#F5F7FA',
  },
  loginTitle: {
    fontSize: 36,
    fontWeight: '800',
    marginBottom: 5,
    color: '#1A202C',
    letterSpacing: -1
  },
  loginSubtitle: {
    fontSize: 16,
    color: '#718096',
    marginBottom: 40,
    fontWeight: '500'
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
    backgroundColor: 'white',
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2
  },
  label: {
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#A0AEC0',
    marginBottom: 4,
    letterSpacing: 0.5
  },
  input: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748'
  },
  generateButton: {
    backgroundColor: '#E2E8F0',
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#CBD5E0'
  },
  generateButtonText: {
    color: '#4A5568',
    fontWeight: '600',
    fontSize: 14,
  },
  connectButton: {
    backgroundColor: '#3182CE',
    paddingVertical: 18,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#3182CE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  connectButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 0.5
  },

  // TOAST
  toastContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    padding: 15,
    borderRadius: 12,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
    alignItems: 'center'
  },
  toastText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.5
  },

  // MARKER
  markerContainer: { alignItems: 'center', justifyContent: 'center' },
  markerCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#48BB78',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  markerText: { fontSize: 20 },
  markerArrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#48BB78',
    transform: [{ rotate: '180deg' }],
    marginTop: -2,
  }
});
