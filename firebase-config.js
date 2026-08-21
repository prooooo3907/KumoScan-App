import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAHEYcV6825oJ2ea2yAvlBpjIZQ4JlpnGI",
  authDomain: "kumoscan-9a38c.firebaseapp.com",
  databaseURL: "https://kumoscan-9a38c-default-rtdb.firebaseio.com",
  projectId: "kumoscan-9a38c",
  storageBucket: "kumoscan-9a38c.firebasestorage.app",
  messagingSenderId: "701087394999",
  appId: "1:701087394999:web:82b21c0e7b38d7a1d4f132"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { auth, db };
