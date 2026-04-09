// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, get, remove, update } from "firebase/database";
import {
    getAuth,
    initializeAuth,
    browserLocalPersistence,
    indexedDBLocalPersistence,
    browserPopupRedirectResolver,
    OAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    signOut,
    onAuthStateChanged,
    onIdTokenChanged
} from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyA9kyRUTxDGTZfsZ4dePNcH9WqNCdIf3ro",
    authDomain: "poop-counter-a4309.firebaseapp.com",
    databaseURL: "https://poop-counter-a4309-default-rtdb.firebaseio.com",
    projectId: "poop-counter-a4309",
    storageBucket: "poop-counter-a4309.firebasestorage.app",
    messagingSenderId: "579899130559",
    appId: "1:579899130559:web:dcd8b948ae485c5279bc0a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

/** 用 indexedDB 優先，部分環境比預設 session 更不易丟 redirect 狀態（仍建議手機只用 popup、勿 fallback redirect） */
function createAuth(appInstance) {
    try {
        return initializeAuth(appInstance, {
            persistence: [indexedDBLocalPersistence, browserLocalPersistence],
            popupRedirectResolver: browserPopupRedirectResolver
        });
    } catch {
        return getAuth(appInstance);
    }
}

const auth = createAuth(app);
const lineProviderId = import.meta.env.VITE_LINE_PROVIDER_ID || "oidc.line";
const lineProvider = new OAuthProvider(lineProviderId);

const signInWithLinePopup = () => signInWithPopup(auth, lineProvider);
const signInWithLineRedirect = () => signInWithRedirect(auth, lineProvider);
const getLineRedirectResult = () => getRedirectResult(auth);
const signOutAuth = () => signOut(auth);

export {
    database,
    ref,
    onValue,
    set,
    get,
    remove,
    update,
    auth,
    onAuthStateChanged,
    onIdTokenChanged,
    signInWithLinePopup,
    signInWithLineRedirect,
    getLineRedirectResult,
    signOutAuth
};