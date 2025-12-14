import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  UserCredential,
} from 'firebase/auth';

import { firebaseAuth, firebaseDb } from './config';

type Role = 'user' | 'trainer';

export type UserProfile = {
  id: string;
  name: string;
  username: string;
  age?: string;
  goalType?: string;
  height?: string;
  weight?: string;
  gender?: string;
  programId?: string | null;
  assignedTrainerId?: string | null;
  profilePhoto?: string | null;
  role: Role;
  createdAt?: number;
};

export type TrainerProfile = {
  id: string;
  name: string;
  username: string;
  specialty?: string;
  bio?: string;
  profilePhoto?: string | null;
  role: Role;
  createdAt?: number;
};

export type MessageRow = {
  id: string;
  conversationId: string;
  participants: string[];
  senderId: string;
  receiverId: string;
  senderType: Role;
  text: string;
  createdAt: number;
};

export type NotificationRow = {
  id: string;
  trainerId: string;
  userId: string;
  userName: string;
  userGoal: string;
  type: 'assign_request';
  createdAt: number;
};

const usersCol = collection(firebaseDb, 'users');
const trainersCol = collection(firebaseDb, 'trainers');
const messagesCol = collection(firebaseDb, 'messages');
const notificationsCol = collection(firebaseDb, 'notifications');

const usernameToEmail = (username: string) => `${username.trim().toLowerCase()}@fitadvisor.local`;

const timestampNow = () => Date.now();

const buildUserSession = (user: any) => ({
  userId: user.id,
  name: user.name,
  username: user.username,
  goal: user.goalType || '',
  programId: user.programId ?? null,
  assignedTrainerId: user.assignedTrainerId ?? null,
  profilePhoto: user.profilePhoto || null,
});

export const registerUser = async (payload: {
  name: string;
  username: string;
  password: string;
  age?: string;
  goalType?: string;
  programId?: string | null;
  profilePhoto?: string | null;
}) => {
  try {
    const email = usernameToEmail(payload.username);
    const cred = await createUserWithEmailAndPassword(firebaseAuth, email, payload.password);
    const userDoc: UserProfile = {
      id: cred.user.uid,
      name: payload.name,
      username: payload.username.trim().toLowerCase(),
      age: payload.age || '',
      goalType: payload.goalType || 'maintain',
      programId: payload.programId ?? null,
      profilePhoto: payload.profilePhoto || null,
      assignedTrainerId: null,
      role: 'user',
      createdAt: timestampNow(),
    };
    await setDoc(doc(usersCol, cred.user.uid), userDoc);
    return { ok: true, user: userDoc, session: buildUserSession(userDoc) };
  } catch (error: any) {
    const code = error?.code || '';
    if (code === 'auth/email-already-in-use') {
      throw new Error('Bu kullanıcı adı zaten kayıtlı.');
    }
    if (code === 'auth/weak-password') {
      throw new Error('Şifre çok zayıf (en az 6 karakter).');
    }
    throw new Error(error?.message || 'Kayıt sırasında hata oluştu.');
  }
};

export const registerTrainer = async (payload: {
  name: string;
  username: string;
  password: string;
  specialty?: string;
  bio?: string;
  profilePhoto?: string | null;
}) => {
  try {
    const email = usernameToEmail(payload.username);
    const cred = await createUserWithEmailAndPassword(firebaseAuth, email, payload.password);
    const trainerDoc: TrainerProfile = {
      id: cred.user.uid,
      name: payload.name,
      username: payload.username.trim().toLowerCase(),
      specialty: payload.specialty || '',
      bio: payload.bio || '',
      profilePhoto: payload.profilePhoto || null,
      role: 'trainer',
      createdAt: timestampNow(),
    };
    await setDoc(doc(trainersCol, cred.user.uid), trainerDoc);
    return { ok: true, trainer: trainerDoc };
  } catch (error: any) {
    const code = error?.code || '';
    if (code === 'auth/email-already-in-use') {
      throw new Error('Bu trainer kullanıcı adı zaten kayıtlı.');
    }
    if (code === 'auth/weak-password') {
      throw new Error('Şifre çok zayıf (en az 6 karakter).');
    }
    throw new Error(error?.message || 'Kayıt sırasında hata oluştu.');
  }
};

export const loginWithUsername = async (username: string, password: string, role: Role) => {
  try {
    const email = usernameToEmail(username);
    const cred: UserCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
    const col = role === 'trainer' ? trainersCol : usersCol;
    const snap = await getDoc(doc(col, cred.user.uid));
    if (!snap.exists()) {
      throw new Error('Kullanıcı kaydı bulunamadı');
    }
    const data = snap.data() as any;
    if (role === 'trainer') {
      return { ok: true, trainer: data as TrainerProfile };
    }
    return { ok: true, user: data as UserProfile, session: buildUserSession(data) };
  } catch (error: any) {
    const code = error?.code || '';
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
      throw new Error('Kullanıcı adı veya şifre yanlış.');
    }
    if (code === 'auth/user-not-found') {
      throw new Error('Kullanıcı bulunamadı.');
    }
    throw new Error(error?.message || 'Giriş sırasında hata oluştu.');
  }
};

export const logout = async () => signOut(firebaseAuth);

export const listTrainers = async () => {
  const q = query(trainersCol, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  const trainers: TrainerProfile[] = [];
  snap.forEach((docSnap) => trainers.push({ id: docSnap.id, ...(docSnap.data() as any) }));
  return trainers;
};

export const listUsers = async (assignedTrainerId?: string) => {
  let q;
  if (assignedTrainerId) {
    q = query(usersCol, where('assignedTrainerId', '==', assignedTrainerId));
  } else {
    q = query(usersCol, orderBy('createdAt', 'desc'));
  }
  const snap = await getDocs(q);
  const users: UserProfile[] = [];
  snap.forEach((docSnap) => users.push({ id: docSnap.id, ...(docSnap.data() as any) }));
  return users;
};

export const assignTrainerToUser = async (userId: string, trainerId: string) => {
  const userSnap = await getDoc(doc(usersCol, userId));
  const trainerSnap = await getDoc(doc(trainersCol, trainerId));
  if (!userSnap.exists()) throw new Error('Kullanıcı bulunamadı');
  if (!trainerSnap.exists()) throw new Error('Eğitmen bulunamadı');

  await updateDoc(doc(usersCol, userId), { assignedTrainerId: trainerId });

  const user = userSnap.data() as UserProfile;
  await addDoc(notificationsCol, {
    trainerId,
    userId,
    userName: user.name,
    userGoal: user.goalType || '',
    type: 'assign_request',
    createdAt: serverTimestamp(),
  });
  return { ok: true };
};

export const updateUserProfile = async (
  userId: string,
  payload: Partial<Pick<UserProfile, 'age' | 'height' | 'weight' | 'gender' | 'goalType' | 'profilePhoto'>>
) => {
  await updateDoc(doc(usersCol, userId), {
    ...payload,
  });
  return { ok: true };
};

export const updateTrainerProfile = async (
  trainerId: string,
  payload: Partial<Pick<TrainerProfile, 'name' | 'specialty' | 'bio' | 'profilePhoto'>>
) => {
  await updateDoc(doc(trainersCol, trainerId), {
    ...payload,
  });
  return { ok: true };
};

export const getNotificationsForTrainer = async (trainerId: string) => {
  const q = query(
    notificationsCol,
    where('trainerId', '==', trainerId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  const items: NotificationRow[] = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data() as any;
    items.push({
      id: docSnap.id,
      trainerId: data.trainerId,
      userId: data.userId,
      userName: data.userName,
      userGoal: data.userGoal,
      type: data.type || 'assign_request',
      createdAt: data.createdAt?.toMillis?.() ?? data.createdAt ?? timestampNow(),
    });
  });
  return items;
};

const buildConversationId = (userId: string, trainerId: string) =>
  [userId, trainerId].sort().join('__');

export const sendMessage = async (payload: {
  senderId: string;
  receiverId: string;
  senderType: Role;
  text: string;
}) => {
  const conversationId = buildConversationId(payload.senderId, payload.receiverId);
  const msg = {
    conversationId,
    participants: [payload.senderId, payload.receiverId],
    senderId: payload.senderId,
    receiverId: payload.receiverId,
    senderType: payload.senderType === 'trainer' ? 'trainer' : 'user',
    text: payload.text,
    createdAt: timestampNow(),
  };
  const ref = await addDoc(messagesCol, msg);
  return { ok: true, message: { id: ref.id, ...msg } as MessageRow };
};

export const getMessagesForConversation = async (userId: string, trainerId: string) => {
  const conversationId = buildConversationId(userId, trainerId);
  const q = query(messagesCol, where('conversationId', '==', conversationId), orderBy('createdAt'));
  const snap = await getDocs(q);
  const items: MessageRow[] = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data() as any;
    items.push({
      id: docSnap.id,
      conversationId: data.conversationId,
      participants: data.participants || [],
      senderId: data.senderId,
      receiverId: data.receiverId,
      senderType: data.senderType,
      text: data.text,
      createdAt: data.createdAt,
    });
  });
  return items;
};

export const getTrainerMessages = async (trainerId: string, take: number = 20) => {
  const q = query(
    messagesCol,
    where('participants', 'array-contains', trainerId),
    orderBy('createdAt', 'desc'),
    limit(take)
  );
  const snap = await getDocs(q);
  const items: MessageRow[] = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data() as any;
    items.push({
      id: docSnap.id,
      conversationId: data.conversationId,
      participants: data.participants || [],
      senderId: data.senderId,
      receiverId: data.receiverId,
      senderType: data.senderType,
      text: data.text,
      createdAt: data.createdAt,
    });
  });
  return items;
};
