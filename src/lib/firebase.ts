import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  getDocs,
  Unsubscribe 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { AuditEntry } from '../types';
import { DEFAULT_FLEET_STATE, DEFAULT_WMS_STATE } from '../store';

// Initialize Firebase App singleton
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// CRITICAL: The app will break without specifying the firestoreDatabaseId
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

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
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// CRITICAL: Validate connection to Firestore on initialization
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration or network status.");
    }
    return false;
  }
}

// Immediately initiate background connection test
testConnection();

// Sign In with Google via Popup
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    // Persist user record in users/{uid}
    if (result.user) {
      const userRef = doc(db, 'users', result.user.uid);
      await setDoc(userRef, {
        uid: result.user.uid,
        email: result.user.email || '',
        displayName: result.user.displayName || 'SupplyGuard Operator',
        photoURL: result.user.photoURL || '',
        role: 'operator',
        createdAt: new Date().toISOString()
      }, { merge: true }).catch(err => {
        console.warn('User profile sync skipped:', err);
      });
    }
    return result.user;
  } catch (error) {
    console.error('Sign-in failed:', error);
    throw error;
  }
}

// Sign out
export async function logOut(): Promise<void> {
  await signOut(auth);
}

// Seed initial WMS and Fleet data if collections are freshly provisioned
export async function seedInitialFirestoreData(): Promise<void> {
  if (!auth.currentUser) return;

  try {
    // Check WMS nodes collection
    const wmsSnap = await getDocs(collection(db, 'wms_nodes'));
    if (wmsSnap.empty) {
      console.log('Seeding initial WMS nodes to Cloud Firestore...');
      for (const node of DEFAULT_WMS_STATE) {
        await setDoc(doc(db, 'wms_nodes', node.id), node);
      }
    }

    // Check Fleet summary
    const fleetSummaryRef = doc(db, 'fleet_summary', 'current');
    await setDoc(fleetSummaryRef, {
      ocean: DEFAULT_FLEET_STATE.ocean,
      air: DEFAULT_FLEET_STATE.air,
      ground: DEFAULT_FLEET_STATE.ground,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // Check Fleet routes
    const routesSnap = await getDocs(collection(db, 'fleet_routes'));
    if (routesSnap.empty) {
      console.log('Seeding active fleet routes to Cloud Firestore...');
      for (const route of DEFAULT_FLEET_STATE.activeRoutes) {
        await setDoc(doc(db, 'fleet_routes', route.id), route);
      }
    }

    // Check System Config
    const configRef = doc(db, 'system_config', 'global');
    await setDoc(configRef, {
      maxCost: 5000,
      maxDelay: 24,
      autoMode: true,
      avoidRedSea: false,
      avoidPanamaCanal: false,
      strictCarbon: false,
      updatedAt: new Date().toISOString()
    }, { merge: true });

  } catch (err) {
    console.warn('Seeding check note:', err);
  }
}

// Real-time synchronization listeners

export function subscribeToAuditLogs(
  onUpdate: (audits: AuditEntry[]) => void, 
  onError?: (err: any) => void
): Unsubscribe | null {
  if (!auth.currentUser) return null;
  const path = 'audit_logs';
  try {
    const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(50));
    return onSnapshot(q, (snapshot) => {
      const logs: AuditEntry[] = [];
      snapshot.forEach((doc) => {
        logs.push(doc.data() as AuditEntry);
      });
      onUpdate(logs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
      if (onError) onError(error);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return null;
  }
}

export function subscribeToWmsNodes(
  onUpdate: (nodes: any[]) => void,
  onError?: (err: any) => void
): Unsubscribe | null {
  if (!auth.currentUser) return null;
  const path = 'wms_nodes';
  try {
    return onSnapshot(collection(db, path), (snapshot) => {
      if (!snapshot.empty) {
        const nodes: any[] = [];
        snapshot.forEach((doc) => {
          nodes.push(doc.data());
        });
        onUpdate(nodes);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
      if (onError) onError(error);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return null;
  }
}

export function subscribeToFleetData(
  onUpdate: (fleet: any) => void,
  onError?: (err: any) => void
): Unsubscribe | null {
  if (!auth.currentUser) return null;
  const path = 'fleet_routes';
  try {
    const unsubRoutes = onSnapshot(collection(db, path), (snapshot) => {
      if (!snapshot.empty) {
        const routes: any[] = [];
        snapshot.forEach((d) => routes.push(d.data()));
        onUpdate((prev: any) => ({
          ...prev,
          activeRoutes: routes
        }));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
      if (onError) onError(error);
    });
    return unsubRoutes;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return null;
  }
}

export function subscribeToSystemConfig(
  onUpdate: (config: any) => void,
  onError?: (err: any) => void
): Unsubscribe | null {
  if (!auth.currentUser) return null;
  const path = 'system_config';
  try {
    return onSnapshot(doc(db, path, 'global'), (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data());
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `${path}/global`);
      if (onError) onError(error);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${path}/global`);
    return null;
  }
}

// Database Mutators with Strict Error Catching & Typing
export async function recordAuditEntryInFirestore(entry: AuditEntry): Promise<void> {
  if (!auth.currentUser) {
    console.warn('Audit record saved locally only (user not signed in to Firebase)');
    return;
  }
  const path = 'audit_logs';
  try {
    const docRef = doc(db, path, entry.audit_id);
    await setDoc(docRef, {
      ...entry,
      userId: auth.currentUser.uid,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${path}/${entry.audit_id}`);
  }
}

export async function updateWmsNodeInFirestore(nodeId: string, updates: Partial<any>): Promise<void> {
  if (!auth.currentUser) return;
  const path = 'wms_nodes';
  try {
    const nodeRef = doc(db, path, nodeId);
    await updateDoc(nodeRef, {
      ...updates,
      last_updated: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${path}/${nodeId}`);
  }
}

export async function saveSystemConfigInFirestore(config: any): Promise<void> {
  if (!auth.currentUser) return;
  const path = 'system_config';
  try {
    const configRef = doc(db, path, 'global');
    await setDoc(configRef, {
      ...config,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${path}/global`);
  }
}
