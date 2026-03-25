import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function fixAdminRole() {
  const userId = 'EqrGlWJ5DXX18azrN4cDGTj7gVD3';
  const userRef = doc(db, 'users', userId);
  
  try {
    // Check if user document exists
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      console.log('Current user data:', userDoc.data());
      
      // Update to admin role
      await setDoc(userRef, { role: 'admin' }, { merge: true });
      console.log('✓ User role updated to admin');
    } else {
      console.log('User document does not exist. Creating...');
      
      // Create user document with admin role
      await setDoc(userRef, { role: 'admin' });
      console.log('✓ User document created with admin role');
    }
    
    // Verify the change
    const updatedDoc = await getDoc(userRef);
    console.log('Updated user data:', updatedDoc.data());
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

fixAdminRole();
