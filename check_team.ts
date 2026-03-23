import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function checkTeam() {
  const mobile = '8690065830';
  const q = query(collection(db, 'teams'), where('mobileNumber', '==', mobile));
  const snap = await getDocs(q);
  
  if (snap.empty) {
    console.log(`No team found with mobile number: ${mobile}`);
  } else {
    console.log(`Found ${snap.size} team(s) with mobile number: ${mobile}`);
    snap.forEach(doc => {
      console.log('Team ID:', doc.id);
      console.log('Team Data:', JSON.stringify(doc.data(), null, 2));
    });
  }
  process.exit(0);
}

checkTeam().catch(err => {
  console.error(err);
  process.exit(1);
});
