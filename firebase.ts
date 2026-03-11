
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/functions';
import 'firebase/compat/storage';

// Explicitly define config to avoid type inference issues
const firebaseConfig = {
  apiKey: "AIzaSyDpXoQHUiR3Xu9uOJyiXzQnTdLPl7WyvaA",
  authDomain: "gteamgr-506ff.firebaseapp.com",
  projectId: "gteamgr-506ff",
  storageBucket: "gteamgr-506ff.firebasestorage.app",
  messagingSenderId: "189906605208",
  appId: "1:189906605208:web:c91bfe6d9f5c107778eced",
  measurementId: "G-1YG3E28SS3"
};

// Singleton pattern to prevent multiple initializations
let app;
if (!firebase.apps.length) {
  app = firebase.initializeApp(firebaseConfig);
} else {
  app = firebase.app(); 
}

// Export services with explicit casting if necessary to satisfy strict linters
export const auth = firebase.auth();
export const db = firebase.firestore();
export const functions = firebase.functions();
export const storage = firebase.storage();

// Default export for compatibility
export { firebase };
export default app;
