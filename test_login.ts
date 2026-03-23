import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function testLogin() {
  const email = '8690065830@auction.com';
  const password = 'c8ek9tk5';
  
  try {
    console.log(`Testing login for: ${email}`);
    await signInWithEmailAndPassword(auth, email, password);
    console.log('Login successful!');
  } catch (err: any) {
    console.log('Login failed!');
    console.log('Error Code:', err.code);
    console.log('Error Message:', err.message);
  }
  process.exit(0);
}

testLogin().catch(err => {
  console.error(err);
  process.exit(1);
});
