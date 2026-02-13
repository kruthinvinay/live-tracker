import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
// @ts-ignore
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDMAcnLpl26qeapIZwcg5l0ZTkoPLmwbjE",
    authDomain: "spyglass-451db.firebaseapp.com",
    databaseURL: "https://spyglass-451db-default-rtdb.firebaseio.com",
    projectId: "spyglass-451db",
    storageBucket: "spyglass-451db.firebasestorage.app",
    messagingSenderId: "3480665648",
    appId: "1:3480665648:web:7dbaf5ea16d1232f7ab7f5",
    measurementId: "G-B263TSV1E9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with persistence (AsyncStorage)
export const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
});

export const db = getDatabase(app);
export const storage = getStorage(app);
