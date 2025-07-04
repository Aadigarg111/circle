const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb+srv://aadileetcode:3PyPy3AbgYSbTtrZ@cluster0.ppfyozj.mongodb.net/';
const DB_NAME = 'circleGame';
const COLLECTION = 'attempts';

const app = express();
app.use(cors());
app.use(express.json());

let db, attempts;

MongoClient.connect(MONGO_URI, { useUnifiedTopology: true })
  .then(client => {
    db = client.db(DB_NAME);
    attempts = db.collection(COLLECTION);
    app.listen(3000, () => console.log('Server running on http://localhost:3000'));
  })
  .catch(err => console.error(err));

// Save a new attempt
app.post('/api/submit', async (req, res) => {
  const { username, percentage } = req.body;
  if (!username || typeof percentage !== 'number') return res.status(400).send('Invalid');
  const doc = { username, percentage, timestamp: new Date() };
  await attempts.insertOne(doc);
  res.json({ success: true });
});

// Get user history
app.get('/api/history', async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).send('Missing username');
  const history = await attempts.find({ username }).sort({ timestamp: -1 }).limit(10).toArray();
  res.json(history);
});

// Get leaderboard (top 10 best attempts)
app.get('/api/leaderboard', async (req, res) => {
  const pipeline = [
    { $sort: { percentage: -1 } },
    { $group: { _id: "$username", best: { $max: "$percentage" } } },
    { $sort: { best: -1 } },
    { $limit: 10 }
  ];
  const leaderboard = await attempts.aggregate(pipeline).toArray();
  res.json(leaderboard);
});
