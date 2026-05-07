
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/functions';
import 'firebase/compat/storage';
import 'firebase/compat/app-check';

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
let app: firebase.app.App;
if (!firebase.apps.length) {
  app = firebase.initializeApp(firebaseConfig);
} else {
  app = firebase.app(); 
}

// === App Check Setup ===
if (typeof window !== 'undefined') {
  if (import.meta.env.DEV) {
    // For local development, enable the debug token
    (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  if (siteKey) {
    try {
      const appCheck = firebase.appCheck();
      appCheck.activate(
        new firebase.appCheck.ReCaptchaEnterpriseProvider(siteKey),
        true // isTokenAutoRefreshEnabled
      );
      console.log("Firebase App Check initialized successfully.", import.meta.env.DEV ? "Running in debug mode." : "");
    } catch (err) {
      console.error("Failed to initialize Firebase App Check:", err);
    }
  } else {
    console.warn("VITE_RECAPTCHA_SITE_KEY is missing. App Check will not be activated.");
  }
}

// Export services with explicit casting if necessary to satisfy strict linters
export const auth = firebase.auth();
export const db = firebase.firestore();
export const functions = firebase.functions();
export const storage = firebase.storage();

export async function getAppCheckToken(): Promise<string | undefined> {
  try {
    // Add a 2 second timeout to prevent hanging if Recaptcha is misconfigured
    const tokenResult = await Promise.race([
      firebase.appCheck().getToken(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("App Check token timeout")), 2000))
    ]) as any;
    return tokenResult?.token;
  } catch (error) {
    console.warn("App Check token generation failed or timed out:", error);
    return undefined;
  }
}

// Default export for compatibility
export { firebase };
export default app;
