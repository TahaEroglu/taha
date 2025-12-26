// Simple Express backend for FitAdvisor (users, trainers, messages, notifications)
// Not production-ready: replace with a real database and auth before going live.
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const DATA_FILE = path.join(__dirname, 'data.json');

function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    // ensure new collections exist
    if (!parsed.dailyLogs) parsed.dailyLogs = [];
    if (!parsed.foodLogs) parsed.foodLogs = []; // optional: to sum intake if exists
    return parsed;
  } catch (e) {
    return { users: [], trainers: [], messages: [], notifications: [], dailyLogs: [], foodLogs: [] };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

const PORT = process.env.PORT || 4000;
const CALORIES_PER_STEP = Number(process.env.CALORIES_PER_STEP || 0.04);
const SCALER_JSON = path.join(__dirname, '..', 'App_Data', 'kmeans_scaler.json');
const CENTROIDS_JSON = path.join(__dirname, '..', 'App_Data', 'kmeans_centroids.json');

function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

// Register user
app.post('/api/users/register', (req, res) => {
  const { name, username, password, age, goalType, height, weight, gender, programId, profilePhoto } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const data = loadData();
  if (data.users.find((u) => u.username === username)) {
    return res.status(400).json({ error: 'username already exists' });
  }
  const salt = crypto.randomBytes(8).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const user = {
    id: `u-${Date.now()}`,
    name: name || '',
    username,
    age: age || '',
    goalType: goalType || 'maintain',
    height: height || '',
    weight: weight || '',
    gender: gender || '',
    programId: programId || null,
    profilePhoto: profilePhoto || null,
    assignedTrainerId: null,
    salt,
    passwordHash,
  };
  data.users.push(user);
  saveData(data);
  res.json({ ok: true, user });
});

// Register trainer
app.post('/api/trainers/register', (req, res) => {
  const { name, username, password, specialty, bio, profilePhoto } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const data = loadData();
  if (data.trainers.find((t) => t.username === username)) {
    return res.status(400).json({ error: 'username already exists' });
  }
  const salt = crypto.randomBytes(8).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const trainer = {
    id: `t-${Date.now()}`,
    name: name || '',
    username,
    specialty: specialty || '',
    bio: bio || '',
    profilePhoto: profilePhoto || null,
    salt,
    passwordHash,
  };
  data.trainers.push(trainer);
  saveData(data);
  res.json({ ok: true, trainer });
});

// Login (user or trainer by role param)
app.post('/api/login', (req, res) => {
  const { username, password, role } = req.body;
  const data = loadData();
  const collection = role === 'trainer' ? data.trainers : data.users;
  const found = collection.find((x) => x.username === username);
  if (!found) return res.status(400).json({ error: 'not found' });
  const candidate = hashPassword(password, found.salt);
  if (candidate !== found.passwordHash) return res.status(400).json({ error: 'invalid credentials' });
  res.json({ ok: true, user: found });
});

// List trainers
app.get('/api/trainers', (_req, res) => {
  const data = loadData();
  res.json({ ok: true, trainers: data.trainers });
});

// List users (optionally by assignedTrainerId)
app.get('/api/users', (req, res) => {
  const { assignedTrainerId } = req.query;
  const data = loadData();
  let users = data.users;
  if (assignedTrainerId) {
    users = users.filter((u) => u.assignedTrainerId === assignedTrainerId);
  }
  res.json({ ok: true, users });
});

// Assign trainer to user
app.post('/api/users/:userId/assign-trainer', (req, res) => {
  const { userId } = req.params;
  const { trainerId } = req.body;
  const data = loadData();
  const user = data.users.find((u) => u.id === userId);
  if (!user) return res.status(404).json({ error: 'user not found' });
  user.assignedTrainerId = trainerId;
  saveData(data);
  // create notification
  data.notifications.push({
    id: `n-${Date.now()}`,
    trainerId,
    userId,
    userName: user.name,
    userGoal: user.goalType,
    createdAt: new Date().toISOString(),
    type: 'assign_request',
  });
  saveData(data);
  res.json({ ok: true });
});

// Notifications for trainer
app.get('/api/trainers/:trainerId/notifications', (req, res) => {
  const { trainerId } = req.params;
  const data = loadData();
  const items = data.notifications.filter((n) => n.trainerId === trainerId);
  res.json({ ok: true, notifications: items });
});

// Messages list between trainer and student
app.get('/api/messages', (req, res) => {
  const { userId, trainerId } = req.query;
  const data = loadData();
  const items = data.messages
    .filter(
      (m) =>
        (m.senderId === userId && m.receiverId === trainerId) ||
        (m.senderId === trainerId && m.receiverId === userId)
    )
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  res.json({ ok: true, messages: items });
});

// Send message
app.post('/api/messages', (req, res) => {
  const { senderId, receiverId, senderType, text } = req.body;
  if (!senderId || !receiverId || !text) return res.status(400).json({ error: 'missing fields' });
  const data = loadData();
  const msg = {
    id: `m-${Date.now()}`,
    senderId,
    receiverId,
    senderType: senderType === 'trainer' ? 'trainer' : 'user',
    text,
    createdAt: new Date().toISOString(),
  };
  data.messages.push(msg);
  saveData(data);
  res.json({ ok: true, message: msg });
});

// Messages for a trainer (any student)
app.get('/api/trainers/:trainerId/messages', (req, res) => {
  const { trainerId } = req.params;
  const { limit = 20 } = req.query;
  const data = loadData();
  const trainerMsgs = data.messages
    .filter((m) => m.senderId === trainerId || m.receiverId === trainerId)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, Number(limit) || 20);
  res.json({ ok: true, messages: trainerMsgs });
});

// --- AI + Daily Log helpers ---
function loadModelJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (_e) {
    return null;
  }
}

const modelScaler = loadModelJson(SCALER_JSON);
const modelCentroids = loadModelJson(CENTROIDS_JSON);

function getIntakeCalories(data, userId, date) {
  // foodLogs formatı: { userId, date: 'YYYY-MM-DD', items: [{ calories }], totalCalories }
  const records = (data.foodLogs || []).filter((f) => f.userId === userId && f.date === date);
  if (records.length === 0) return 0;
  let total = 0;
  records.forEach((r) => {
    if (typeof r.totalCalories === 'number') total += r.totalCalories;
    else if (Array.isArray(r.items)) total += r.items.reduce((s, it) => s + (Number(it.calories) || 0), 0);
  });
  return total;
}

function predictCluster(steps, sleepMinutes, burned) {
  if (!modelScaler || !modelCentroids) return { clusterId: null };
  const features = [steps, sleepMinutes, burned];
  const mean = modelScaler.mean || modelScaler.mean_;
  const scale = modelScaler.scale || modelScaler.scale_;
  if (!mean || !scale) return { clusterId: null };
  const normalized = features.map((v, idx) => (v - mean[idx]) / (scale[idx] || 1));
  const centroids = modelCentroids.centroids;
  if (!Array.isArray(centroids) || centroids.length === 0) return { clusterId: null };
  let bestIdx = null;
  let bestDist = Number.POSITIVE_INFINITY;
  centroids.forEach((c, idx) => {
    const dist = Math.sqrt(c.reduce((sum, val, i) => sum + Math.pow(normalized[i] - val, 2), 0));
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = idx;
    }
  });
  return { clusterId: bestIdx };
}

function labelArchetype(centroid) {
  if (!Array.isArray(centroid)) return 'Balanced';
  const [steps, sleepMin, burned] = centroid;
  const sleepHours = sleepMin / 60;
  const highActivity = steps > 10000 || burned > 2300;
  const lowActivity = steps < 5000 || burned < 1800;
  const poorSleep = sleepHours < 6;
  const greatSleep = sleepHours >= 7.5;

  if (poorSleep) return 'PoorSleep';
  if (highActivity && greatSleep) return 'HighBurn';
  if (lowActivity) return 'LowActivity';
  return 'Balanced';
}

function buildRecommendations(archetype, netCalories) {
  const rec = {
    summary: '',
    recommendations: [],
    challenges: [],
  };

  const netNote =
    netCalories >= 300
      ? 'Yarın intake’i ~300 kcal azaltmaya odaklan.'
      : netCalories <= -300
      ? 'Enerji açığındasın, ~200 kcal kaliteli ekle.'
      : 'Dengeye yakınsın, aynı düzeni sürdür.';

  if (archetype === 'LowActivity') {
    rec.summary = 'Aktivite düşük; küçük adım artışlarıyla toparla.';
    rec.recommendations = ['Günde +1500 adım ekle', 'Kısa yürüyüşler (10-15 dk) planla', netNote];
    rec.challenges = ['Bugün 10 dakikalık tempolu yürüyüş yap'];
  } else if (archetype === 'PoorSleep') {
    rec.summary = 'Uyku süresi/kalitesi düşük; toparlanmaya odaklan.';
    rec.recommendations = ['Uyku öncesi ekran/kafein azalt', '7+ saat uyku hedefle', netNote];
    rec.challenges = ['Bu gece yatmadan 30 dk önce ekran bırak'];
  } else if (archetype === 'HighBurn') {
    rec.summary = 'Aktivite yüksek; toparlanma ve beslenme dengesini koru.';
    rec.recommendations = ['Yeterli su/elektrolit al', 'Hafif mobilite/germe ekle', netNote];
    rec.challenges = ['Bugün 5 dakikalık mobilite rutini yap'];
  } else {
    rec.summary = 'Denge iyi; küçük iyileştirmelerle sürdürülebilirlik önemli.';
    rec.recommendations = ['Rutinini koru', 'Haftalık küçük hedefler koy', netNote];
    rec.challenges = ['Bugün 1 küçük alışkanlık ekle (su/germe)'];
  }

  return rec;
}

// Daily log ekle/güncelle
app.post('/api/daily-log', (req, res) => {
  const { userId, date, steps = 0, sleepHours = 0 } = req.body;
  if (!userId || !date) return res.status(400).json({ error: 'userId ve date gerekli' });
  const data = loadData();
  const intakeCalories = getIntakeCalories(data, userId, date);
  const burnedCalories = Number(steps) * CALORIES_PER_STEP;
  const netCalories = intakeCalories - burnedCalories;

  const existingIdx = data.dailyLogs.findIndex((d) => d.userId === userId && d.date === date);
  const payload = {
    userId,
    date,
    steps: Number(steps) || 0,
    sleepHours: Number(sleepHours) || 0,
    intakeCalories,
    burnedCaloriesEstimated: burnedCalories,
    netCalories,
    clusterId: null,
  };
  if (existingIdx >= 0) data.dailyLogs[existingIdx] = { ...data.dailyLogs[existingIdx], ...payload };
  else data.dailyLogs.push(payload);
  saveData(data);
  res.json({ ok: true, log: payload });
});

// Günlük log oku
app.get('/api/daily-log', (req, res) => {
  const { userId, date } = req.query;
  if (!userId || !date) return res.status(400).json({ error: 'userId ve date gerekli' });
  const data = loadData();
  const found = data.dailyLogs.find((d) => d.userId === userId && d.date === date);
  if (!found) return res.json({ ok: true, log: null });
  res.json({ ok: true, log: found });
});

// Günlük öneri / tahmin
app.get('/api/recommendations/daily', (req, res) => {
  const { userId, date } = req.query;
  if (!userId || !date) return res.status(400).json({ error: 'userId ve date gerekli' });
  const data = loadData();
  const intakeCalories = getIntakeCalories(data, userId, date);
  const log = data.dailyLogs.find((d) => d.userId === userId && d.date === date);
  const steps = log?.steps || 0;
  const sleepHours = log?.sleepHours || 0;
  const sleepMinutes = sleepHours * 60;
  const burnedCalories = log?.burnedCaloriesEstimated != null ? log.burnedCaloriesEstimated : steps * CALORIES_PER_STEP;
  const netCalories = intakeCalories - burnedCalories;

  let clusterId = null;
  let archetype = 'Balanced';
  if (modelScaler && modelCentroids) {
    const pred = predictCluster(steps, sleepMinutes, burnedCalories);
    clusterId = pred.clusterId;
    if (clusterId != null && Array.isArray(modelCentroids.centroids)) {
      const centroid = modelCentroids.centroids[clusterId];
      archetype = labelArchetype(centroid);
    }
  }

  const rec = buildRecommendations(archetype, netCalories);

  // Logu güncelle (cluster + net)
  const existingIdx = data.dailyLogs.findIndex((d) => d.userId === userId && d.date === date);
  const mergedLog = {
    userId,
    date,
    steps,
    sleepHours,
    intakeCalories,
    burnedCaloriesEstimated: burnedCalories,
    netCalories,
    clusterId,
  };
  if (existingIdx >= 0) data.dailyLogs[existingIdx] = { ...data.dailyLogs[existingIdx], ...mergedLog };
  else data.dailyLogs.push(mergedLog);
  saveData(data);

  res.json({
    ok: true,
    date,
    inputs: {
      steps,
      sleepHours,
      intakeCalories,
      burnedCalories,
      netCalories,
    },
    clusterId,
    summary: rec.summary,
    recommendations: rec.recommendations,
    challenges: rec.challenges,
  });
});

app.listen(PORT, () => {
  console.log(`FitAdvisor backend running on http://localhost:${PORT}`);
});
