import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  deleteDoc, 
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, auth } from '../firebase';

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

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
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

export const fileService = {
  uploadFile: async (encryptedBlob: Blob, metadata: any, onProgress?: (progress: number) => void) => {
    const path = `files/${metadata.ownerId}/${metadata.id}`;
    console.log('[FileService] Starting upload to:', path);
    try {
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, encryptedBlob);

      return new Promise((resolve, reject) => {
        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`[FileService] Upload is ${progress}% done`);
            if (onProgress) onProgress(progress);
          }, 
          (error) => {
            console.error('[FileService] Upload error details:', error);
            reject(error);
          }, 
          async () => {
            console.log('[FileService] Upload successful');
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            
            const fileDoc = {
              ...metadata,
              storagePath: path,
              downloadURL,
              createdAt: Timestamp.now()
            };
            
            try {
              await setDoc(doc(db, 'files', metadata.id), fileDoc);
              console.log('[FileService] Metadata saved to Firestore');
              resolve(fileDoc);
            } catch (firestoreError) {
              console.error('[FileService] Firestore error:', firestoreError);
              reject(firestoreError);
            }
          }
        );
      });
    } catch (error: any) {
      console.error('[FileService] General error:', error);
      handleFirestoreError(error, OperationType.WRITE, `files/${metadata.id}`);
    }
  },

  getUserFiles: (userId: string, callback: (files: any[]) => void) => {
    const q = query(collection(db, 'files'), where('ownerId', '==', userId));
    return onSnapshot(q, (snapshot) => {
      const files = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(files);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'files');
    });
  },

  deleteFile: async (fileId: string, storagePath: string) => {
    try {
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
      await deleteDoc(doc(db, 'files', fileId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `files/${fileId}`);
    }
  },

  // Admin functions
  getAllFilesMetadata: (callback: (files: any[]) => void, onError?: (error: any) => void) => {
    return onSnapshot(collection(db, 'files'), (snapshot) => {
      const files = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(files);
    }, (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, 'files');
    });
  }
};

export const userService = {
  createUserProfile: async (uid: string, email: string, role: 'user' | 'admin' = 'user') => {
    try {
      await setDoc(doc(db, 'users', uid), {
        uid,
        email,
        role,
        createdAt: Timestamp.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
    }
  },

  getUserProfile: async (uid: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      return userDoc.exists() ? userDoc.data() : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${uid}`);
    }
  },

  getAllUsers: (callback: (users: any[]) => void, onError?: (error: any) => void) => {
    return onSnapshot(collection(db, 'users'), (snapshot) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(users);
    }, (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, 'users');
    });
  },

  deleteUser: async (uid: string) => {
    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
    }
  }
};
