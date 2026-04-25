import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { initializeFirestore, doc, setDoc, getDoc, collection, addDoc, query, orderBy, limit, onSnapshot, getDocFromServer, FirestoreError } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use auto-detect long-polling to avoid gRPC connection issues in some environments (reduces 'unavailable' errors)
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

export const googleProvider = new GoogleAuthProvider();

// Auth Helpers
let isSigningIn = false;

export const signInWithGoogle = async () => {
  if (isSigningIn) return null;
  isSigningIn = true;
  
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Create/Update user profile in Firestore
    const userRef = doc(db, 'users', user.uid);
    let userSnap;
    
    // Add retries for potentially flaky Firestore connection
    const maxRetries = 2; // Reduced from 3
    for (let i = 0; i < maxRetries; i++) {
      try {
        // Shorter internal timeout for the getDoc
        userSnap = await getDoc(userRef);
        break;
      } catch (e) {
        if (i === maxRetries - 1) throw e;
        console.warn(`Firestore getDoc retry ${i + 1}/${maxRetries}...`);
        await new Promise(r => setTimeout(r, 1000)); // Reduced from 2s
      }
    }
    
    if (userSnap && !userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        name: user.displayName,
        role: 'user',
        createdAt: new Date().toISOString()
      });
    }
    
    return user;
  } catch (error: any) {
    // Handle specific Firebase errors
    if (error.code === 'auth/cancelled-popup-request') {
      console.warn("Sign-in popup request was cancelled by a newer request.");
      return null;
    }
    if (error.code === 'auth/popup-closed-by-user') {
      console.warn("Sign-in popup was closed by the user.");
      return null;
    }
    
    console.error("Error signing in with Google:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const logout = () => signOut(auth);

// Error Handling Spec for Firestore Operations
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();
