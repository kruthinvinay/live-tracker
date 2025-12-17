import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database'; // Switch to RTDB
import { getStorage } from 'firebase/storage'; // Images/Videos

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDMAcnLpl26qeapIZwcg5l0ZTkoPLmwbjE",
    authDomain: "spyglass-451db.firebaseapp.com",
    databaseURL: "https://spyglass-451db-default-rtdb.firebaseio.com", // Added RTDB URL
    projectId: "spyglass-451db",
    storageBucket: "spyglass-451db.firebasestorage.app",
    messagingSenderId: "3480665648",
    appId: "1:3480665648:web:7dbaf5ea16d1232f7ab7f5",
    measurementId: "G-B263TSV1E9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services
export const auth = getAuth(app);
export const db = getDatabase(app); // RTDB Instance
export const storage = getStorage(app);
