import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, Alert, Dimensions, TextInput, TouchableOpacity, Switch, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback, Linking, Animated } from 'react-native';
import stdMapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import MapView from 'react-native-maps'; // default expert
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import { io, Socket } from 'socket.io-client';

import * as TaskManager from 'expo-task-manager';

// CLOUD SERVER (Works Anywhere)
const SERVER_URL = 'https://spyglass-server-h7pe.onrender.com';
const LOCATION_TASK_NAME = 'LOCATION_TRACKING';

// === BACKGROUND TASK (Runs even when app is closed) ===
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("Background Task Error:", error);
    return;
  }
  if (data) {
    const { locations } = data as any;
    const loc = locations[0]; // Get latest location

    if (loc) {
      console.log("Background Location:", loc.coords.latitude, loc.coords.longitude);

      // We need a fresh socket here because the UI socket might be paused
      const bgSocket = io(SERVER_URL, { transports: ['websocket'] });
      bgSocket.emit('bg_location_update', {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude
      });
    }
  }
});

// === CUSTOM TOAST COMPONENT ===
const Toast = ({ message, visible, type = 'info' }: { message: string, visible: boolean, type?: 'info' | 'success' | 'error' }) => {
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
    <Animated.View style={[styles.toastContainer, { opacity: fadeAnim, backgroundColor: bgColors[type] }]}>
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
};

export default function HomeScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [friendLocation, setFriendLocation] = useState<{ latitude: number, longitude: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Connection State
  const [isConnected, setIsConnected] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(''); // Stores MY phone number
  // Removed isTracker state. Everyone is both.
  const [socket, setSocket] = useState<Socket | null>(null);

  // Toast State
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' as 'info' | 'success' | 'error' });

  const mapRef = useRef<MapView>(null);

  const showToast = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ visible: true, message: msg, type });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  // 1. Initial Location (Just to center map)
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission denied');
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
    })();
  }, []);

  // 2. Connect to Server
  const connectToServer = () => {
    if (!roomCode) return showToast("Please Enter Room Code", "error");

    showToast("Connecting to Satellite...", "info");

    const newSocket = io(SERVER_URL, {
      transports: ['websocket'], // Force WebSocket (better for Android)
      reconnection: true,
    });
    setSocket(newSocket);

    newSocket.on('connect_error', (err) => {
      console.log("Connection Error:", err.message);
      showToast(`Connection Failed: ${err.message}`, "error");
    });

    newSocket.on('connect', async () => {
      console.log('Connected to server');
      newSocket.emit('join', roomCode);

      // START BACKGROUND TRACKING (High Frequency Mode)
      const { status } = await Location.requestBackgroundPermissionsAsync();
      if (status === 'granted') {
        // Verify if task is defined before starting
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.BestForNavigation, // Highest Power
          timeInterval: 2000, // Every 2 Seconds
          distanceInterval: 0, // Every Movement
          foregroundService: {
            notificationTitle: "SpyGlass Live",
            notificationBody: "Broadcasting High-Speed Location..."
          },
          pausesUpdatesAutomatically: false, // Don't stop when still
          activityType: Location.ActivityType.AutomotiveNavigation,
        });
        console.log("Background Service Started");
      }
    });

    newSocket.on('join_success', () => {
      setIsConnected(true);
    });

    newSocket.on('error', (msg: string) => {
      showToast(msg, "error");
      newSocket.disconnect();
      setIsConnected(false); // Kick back to login
    });

    newSocket.on('partner_connected', () => {
      setIsConnected(true); // CONFIRM connection only when joined? Or keep current logic
      showToast("Partner Connected! 🟢", "success");
    });

    // LISTENER: If I am the tracker, update map when friend sends loc
    newSocket.on('update_map', (coords) => {
      console.log('Friend moved:', coords);
      setFriendLocation(coords);
      showToast("Target Moved! Updating Map...", "info");
      // Animate map to friend
      mapRef.current?.animateToRegion({
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 1000);
    });

    // LISTENER: If I am the target, wake up!
    newSocket.on('wake_up_and_send_location', async () => {
      console.log('WAKE UP RECEIVED! Sending location...');
      showToast("Tracker pinged you! Sending location...", "info");
      // Fetch fresh location
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      // Send back
      newSocket.emit('send_location', {
        roomCode,
        location: {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude
        }
      });
    });

    // LISTENER: Emergency Alert Received!
    newSocket.on('receive_alert', ({ location, phoneNumber: friendsPhone }) => {
      Alert.alert(
        "🚨 EMERGENCY 🚨",
        `Friend needs help!\nLat: ${location.latitude}\nLng: ${location.longitude}`,
        [
          { text: "Call Now 📞", onPress: () => Linking.openURL(`tel:${friendsPhone}`) },
          { text: "Cancel", style: "cancel" }
        ]
      );
      // Also update map to show where they are
      setFriendLocation(location);
      mapRef.current?.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 1000);
    });
  };

  // 3. (Tracker Only) Request Location
  const requestFriendLocation = () => {
    socket?.emit('request_location', roomCode);
    showToast("📡  Ping Sent! Waiting for response...", "success");
  };

  // 4. (Target Only) Stop Tracking (Manual)
  // const stopSharing = () => {
  //   socket?.emit('stop_tracking', roomCode);
  //   setIsConnected(false);
  //   setSocket(null);
  // }

  const sendEmergencyAlert = async () => {
    if (!location) return showToast("Wait for GPS lock...", "error");

    socket?.emit('emergency_alert', {
      roomCode,
      location: { latitude: location.coords.latitude, longitude: location.coords.longitude },
      phoneNumber // Send my number so they can call me
    });
    showToast("🚨 SOS Distress Signal Sent!", "error");
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

          <TouchableOpacity style={styles.connectButton} onPress={connectToServer}>
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
        {/* Friend Marker (Custom Avatar) */}
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

      <View style={styles.controlPanel}>
        <Text style={styles.roomBadge}>SECURE CHANNEL: {roomCode}</Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.iconButton} onPress={requestFriendLocation}>
            <Text style={styles.iconButtonText}>📡 PING</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconButton, { backgroundColor: '#E53935' }]} onPress={sendEmergencyAlert}>
            <Text style={styles.iconButtonText}>⚠️ SOS</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ textAlign: 'center', marginTop: 10, color: '#888', fontSize: 10 }}>
          Background Tracking Active 🟢
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },

  // === PREMIUM LOGIN SCREEN ===
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#F5F7FA', // Soft gray-blue background
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
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 30,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2
  },
  roleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4A5568'
  },
  connectButton: {
    backgroundColor: '#3182CE', // Production Blue
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
  ipText: { marginTop: 30, color: '#CBD5E0', fontSize: 11, fontWeight: '600' },

  // === MAP CONTROLS (DOCK) ===
  controlPanel: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.95)', // Glass effect
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
  pingButton: {
    backgroundColor: '#48BB78', // Success Green
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#48BB78',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3
  },
  pingButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },
  listenMode: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#F0FFF4',
    borderRadius: 12,
    width: '100%',
    marginBottom: 10
  },
  // === NEW STYLES ===
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
  targetContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 10
  },
  pulsingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#48BB78',
    shadowColor: '#48BB78',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 5
  },
  // MARKER STYLES
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#48BB78', // WhatsApp Green
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  markerText: {
    fontSize: 20,
  },
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
