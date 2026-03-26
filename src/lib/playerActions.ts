import { db, storage } from '../firebase';
import {
  doc, setDoc, updateDoc, deleteDoc, addDoc, collection, writeBatch,
  arrayRemove, increment, deleteField
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Player, Category } from '../types';

export async function uploadImage(file: File, path: string): Promise<string> {
  const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export function normalizeCategory(raw: string): Category {
  const s = (raw || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  if (s.includes('wicket') || s.includes('keeper') || s === 'wk') return 'Wicket-Keeper';
  if (s.includes('all') || s.includes('rounder')) return 'All-Rounder';
  if (s.includes('bowl')) return 'Bowler';
  return 'Batsman';
}

export async function addPlayer(formData: FormData): Promise<void> {
  const imageFile = formData.get('imageFile') as File;
  let imageUrl = formData.get('imageUrl') as string;
  if (imageFile && imageFile.size > 0) imageUrl = await uploadImage(imageFile, 'players');

  await addDoc(collection(db, 'players'), {
    name: formData.get('name') as string,
    category: formData.get('category') as Category,
    basePrice: parseInt(formData.get('basePrice') as string),
    imageUrl,
    status: 'Available',
    stats: {
      matches: parseInt(formData.get('matches') as string),
      runs: formData.get('runs') ? parseInt(formData.get('runs') as string) : null,
      wickets: formData.get('wickets') ? parseInt(formData.get('wickets') as string) : null,
      strikeRate: formData.get('strikeRate') ? parseFloat(formData.get('strikeRate') as string) : null,
      economy: formData.get('economy') ? parseFloat(formData.get('economy') as string) : null,
    }
  });
}

export async function editPlayer(id: string, formData: FormData): Promise<void> {
  const imageFile = formData.get('imageFile') as File;
  let imageUrl = formData.get('imageUrl') as string;
  if (imageFile && imageFile.size > 0) imageUrl = await uploadImage(imageFile, 'players');

  await updateDoc(doc(db, 'players', id), {
    name: formData.get('name') as string,
    category: formData.get('category') as Category,
    basePrice: parseInt(formData.get('basePrice') as string),
    imageUrl,
    stats: {
      matches: parseInt(formData.get('matches') as string),
      runs: formData.get('runs') ? parseInt(formData.get('runs') as string) : null,
      wickets: formData.get('wickets') ? parseInt(formData.get('wickets') as string) : null,
      strikeRate: formData.get('strikeRate') ? parseFloat(formData.get('strikeRate') as string) : null,
      economy: formData.get('economy') ? parseFloat(formData.get('economy') as string) : null,
    }
  });
}

export async function deletePlayer(id: string, players: Player[]): Promise<void> {
  const p = players.find(pl => pl.id === id);
  if (!p) return;
  const batch = writeBatch(db);
  batch.delete(doc(db, 'players', id));
  if (p.soldTo) {
    batch.update(doc(db, 'teams', p.soldTo), {
      players: arrayRemove(id),
      remainingBudget: increment(p.soldPrice || 0)
    });
  }
  await batch.commit();
}

export async function bulkDeletePlayers(ids: string[], players: Player[]): Promise<void> {
  for (let i = 0; i < ids.length; i += 500) {
    const batch = writeBatch(db);
    ids.slice(i, i + 500).forEach(id => {
      const p = players.find(pl => pl.id === id);
      batch.delete(doc(db, 'players', id));
      if (p?.soldTo) {
        batch.update(doc(db, 'teams', p.soldTo), {
          players: arrayRemove(id),
          remainingBudget: increment(p.soldPrice || 0)
        });
      }
    });
    await batch.commit();
  }
}

export async function bulkMarkUnsold(ids: string[], players: Player[]): Promise<void> {
  for (let i = 0; i < ids.length; i += 500) {
    const batch = writeBatch(db);
    ids.slice(i, i + 500).forEach(id => {
      const p = players.find(pl => pl.id === id);
      batch.update(doc(db, 'players', id), {
        status: 'Unsold',
        soldTo: deleteField(),
        soldPrice: deleteField()
      });
      if (p?.soldTo) {
        batch.update(doc(db, 'teams', p.soldTo), {
          players: arrayRemove(id),
          remainingBudget: increment(p.soldPrice || 0)
        });
      }
    });
    await batch.commit();
  }
}
