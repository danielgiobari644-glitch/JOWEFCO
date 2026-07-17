// Firebase Configuration - Jowefco Project
const firebaseConfig = {
  apiKey: "AIzaSyB0KdLj5TnV_9k0jWFz_-2kHSAYHyG8dq0",
  authDomain: "jowefco.firebaseapp.com",
  projectId: "jowefco",
  storageBucket: "jowefco.firebasestorage.app",
  messagingSenderId: "698975205460",
  appId: "1:698975205460:web:1e7539da1fc748932115c1",
  measurementId: "G-5NE7NQQBQE"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Services
const auth = firebase.auth();
const db = firebase.firestore();

// Auth state observer
auth.onAuthStateChanged((user) => {
  if (user) {
    window.currentUser = user;
    if (typeof onUserLoggedIn === 'function') onUserLoggedIn(user);
  } else {
    window.currentUser = null;
    if (typeof onUserLoggedOut === 'function') onUserLoggedOut();
  }
  if (typeof onAuthStateReady === 'function') onAuthStateReady(user);
});