import { db } from './firebase';
import { collection, doc, getDocs, updateDoc, query, where } from 'firebase/firestore';

export async function getApplicationByRefId(refId) {
  const q = query(collection(db, 'applications'), where('id', '==', refId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { docId: d.id, ...d.data() };
}

export async function updateApplicationFields(docId, fields) {
  await updateDoc(doc(db, 'applications', docId), fields);
}
