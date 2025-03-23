// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set } from "firebase/database";
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

export { database, ref, onValue, set };