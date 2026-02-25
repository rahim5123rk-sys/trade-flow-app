// @ts-nocheck
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDXRxI8i81-vaFtr7cSpbTehHashXj1d0g",
  authDomain: "tradeflow-70e4b.firebaseapp.com",
  projectId: "tradeflow-70e4b",
  storageBucket: "tradeflow-70e4b.firebasestorage.app",
  messagingSenderId: "869934630194",
  appId: "1:869934630194:web:da4a4a2f0ea753f6e6832b",
  measurementId: "G-MX0KW54J1R"
};

// EXPLICITLY TYPE AS ANY TO STOP ERRORS
let app: any;
let auth: any;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  // @ts-ignore
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} else {
  app = getApp();
  auth = getAuth(app);
}

const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
