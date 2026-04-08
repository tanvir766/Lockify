import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  User as FirebaseUser
} from 'firebase/auth';
import { auth } from '../firebase';
import { userService } from './fileService';

const googleProvider = new GoogleAuthProvider();

export const authService = {
  registerWithEmail: async (name: string, email: string, pass: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, pass);
      const user = result.user;
      await updateProfile(user, { displayName: name });
      
      // Create user profile in Firestore
      const role = email === 'mariaparvez100@gmail.com' ? 'admin' : 'user';
      await userService.createUserProfile(user.uid, email, role);
      
      // Save email for "Password-only" login
      localStorage.setItem('locker_email', email);
      return user;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  },

  loginWithEmail: async (email: string, pass: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, pass);
      localStorage.setItem('locker_email', email);
      return result.user;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  loginWithGoogle: async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      const profile = await userService.getUserProfile(user.uid);
      if (!profile) {
        const role = user.email === 'mariaparvez100@gmail.com' ? 'admin' : 'user';
        await userService.createUserProfile(user.uid, user.email || '', role);
      }
      localStorage.setItem('locker_email', user.email || '');
      return user;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  logout: async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  },

  onAuthChange: (callback: (user: FirebaseUser | null) => void) => {
    return onAuthStateChanged(auth, callback);
  }
};
