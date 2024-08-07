// const { initializeApp } = require("firebase/app");
// const { getFirestore, collection } = require("firebase/firestore");

import { initializeApp } from "firebase/app";
import { getFirestore, collection } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyADOZPUKx4n35jLIi3SAUs6AeR8w8fLwXE",
  authDomain: "open-graph-posts.firebaseapp.com",
  projectId: "open-graph-posts",
  storageBucket: "open-graph-posts.appspot.com",
  messagingSenderId: "291067224210",
  appId: "1:291067224210:web:68ed4966f98d184d7bc64b",
  measurementId: "G-GL81PX22D6",
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);
const storage = getStorage(app);

const UserPosts = collection(db, "UserPosts");
// module.exports = UserPosts;

export { db, UserPosts, storage };
