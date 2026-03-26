import { db } from '../firebase';
import {
  doc, setDoc, updateDoc, deleteDoc, addDoc, collection, writeBatch,
  arrayRemove, increment, deleteField, getDoc
} from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Team, Player } from '../types';
import { uploadImage } from './playerActions';

export async function addTeam(formData: FormData): Promise<{ creds: { mobile: string; email: string; pass: string } } | { error: string }> {
  const mobileNumber = formData.get('mobileNumber') as string;
  const email = formData.get('email') as string;
  const password = Math.random().toString(36).slice(-8);
  const imageFile = formData.get('imageFile') as File;
  let logoUrl = formData.get('logoUrl') as string;

  if (imageFile && imageFile.size > 0) logoUrl = await uploadImage(imageFile, 'teams');

  const captainId = formData.get('captainId') as string;
  const viceCaptainId = formData.get('viceCaptainId') as string;
  if (!captainId || !viceCaptainId) return { error: 'Both Captain and Vice Captain must be selected.' };
  if (captainId === viceCaptainId) return { error: 'Captain and Vice Captain cannot be the same player.' };

  const apiKey = firebaseConfig.apiKey;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: false }),
    }
  );
  if (!res.ok) {
    const err = await res.json();
    if (err.error?.message !== 'EMAIL_EXISTS') {
      return { error: err.error?.message || 'Failed to create auth account' };
    }
  }

  const teamData = {
    name: formData.get('name') as string,
    totalBudget: parseInt(formData.get('totalBudget') as string),
    remainingBudget: parseInt(formData.get('totalBudget') as string),
    color: formData.get('color') as string,
    logoUrl,
    mobileNumber,
    email,
    players: [],
    captainId,
    viceCaptainId
  };

  const newTeamRef = doc(collection(db, 'teams'));
  await setDoc(newTeamRef, teamData);
  await setDoc(doc(db, 'teams', newTeamRef.id, 'private', 'contact'), { email, password });

  return { creds: { mobile: mobileNumber, email, pass: password } };
}

export async function editTeam(
  id: string,
  formData: FormData,
  isAdmin: boolean
): Promise<string | null> {
  const imageFile = formData.get('imageFile') as File;
  let logoUrl = formData.get('logoUrl') as string;
  if (imageFile && imageFile.size > 0) logoUrl = await uploadImage(imageFile, 'teams');

  const captainId = formData.get('captainId') as string;
  const viceCaptainId = formData.get('viceCaptainId') as string;
  if (!captainId || !viceCaptainId) return 'Both Captain and Vice Captain must be selected.';
  if (captainId === viceCaptainId) return 'Captain and Vice Captain cannot be the same player.';

  const emailVal = formData.get('email') as string;
  await updateDoc(doc(db, 'teams', id), {
    name: formData.get('name') as string,
    totalBudget: parseInt(formData.get('totalBudget') as string),
    color: formData.get('color') as string,
    logoUrl,
    mobileNumber: formData.get('mobileNumber') as string,
    captainId,
    viceCaptainId,
    ...(emailVal ? { email: emailVal } : {}),
  });

  if (emailVal && isAdmin) {
    await setDoc(doc(db, 'teams', id, 'private', 'contact'), { email: emailVal }, { merge: true });
  }
  return null;
}

export async function deleteTeam(id: string, teams: Team[], players: Player[]): Promise<void> {
  const team = teams.find(t => t.id === id);

  if (team?.email && team?.password) {
    try {
      const secondaryApp = initializeApp(firebaseConfig, `del-${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);
      const { deleteUser } = await import('firebase/auth');
      const cred = await signInWithEmailAndPassword(secondaryAuth, team.email, team.password);
      await deleteUser(cred.user);
      await deleteApp(secondaryApp);
    } catch (_) {}
  }

  try {
    await deleteDoc(doc(db, 'teams', id, 'private', 'contact'));
  } catch (_) {}

  const batch = writeBatch(db);
  batch.delete(doc(db, 'teams', id));
  players.filter(p => p.soldTo === id).forEach(player => {
    batch.update(doc(db, 'players', player.id), {
      status: 'Available',
      soldTo: deleteField(),
      soldPrice: deleteField()
    });
  });
  await batch.commit();
}

export async function resetTeamPassword(
  team: Team
): Promise<{ creds: { name: string; email: string; password: string } } | { error: string }> {
  const email = team.email;
  if (!email) return { error: 'No email on record for this team.' };

  const newPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4);
  const apiKey = firebaseConfig.apiKey;

  try {
    if (!team.password) {
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: newPassword, returnSecureToken: false }),
        }
      );
      if (!res.ok) {
        const errData = await res.json();
        if (errData.error?.message === 'EMAIL_EXISTS') {
          return { creds: { name: team.name, email, password: '(reset email sent to team)' } };
        }
        throw new Error(errData.error?.message || 'Failed to reset auth account');
      }
    } else {
      const secondaryApp = initializeApp(firebaseConfig, `reset-${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);
      const { updatePassword } = await import('firebase/auth');
      const cred = await signInWithEmailAndPassword(secondaryAuth, email, team.password);
      await updatePassword(cred.user, newPassword);
      await deleteApp(secondaryApp);
    }

    await setDoc(doc(db, 'teams', team.id, 'private', 'contact'), { email, password: newPassword }, { merge: true });
    return { creds: { name: team.name, email, password: newPassword } };
  } catch (err: any) {
    return { error: 'Password reset failed: ' + err.message };
  }
}

export async function applyBudgetAdjust(
  teamId: string,
  teams: Team[],
  amount: number,
  mode: 'add' | 'subtract' | 'set',
  target: 'both' | 'remaining'
): Promise<string | null> {
  const team = teams.find(t => t.id === teamId);
  if (!team) return 'Team not found';

  const newRemaining = mode === 'set' ? amount
    : mode === 'add' ? team.remainingBudget + amount
    : team.remainingBudget - amount;

  if (newRemaining < 0) return 'Remaining budget cannot go below ₹0L';

  let updates: Record<string, any> = {};
  if (mode === 'set') {
    updates.remainingBudget = amount;
    if (target === 'both') updates.totalBudget = amount;
  } else {
    const delta = mode === 'add' ? amount : -amount;
    updates.remainingBudget = increment(delta);
    if (target === 'both') updates.totalBudget = increment(delta);
  }

  await updateDoc(doc(db, 'teams', teamId), updates);
  return null;
}
