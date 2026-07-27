import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyACVwVXRB_5nTFozs0PV22zd6wSpZuBVqE",
  authDomain: "reakweb.firebaseapp.com",
  databaseURL: "https://reakweb-default-rtdb.firebaseio.com",
  projectId: "reakweb",
  storageBucket: "reakweb.firebasestorage.app",
  messagingSenderId: "228639861953",
  appId: "1:228639861953:web:2941663bb550703b61b840"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);