const { MongoClient } = require('mongodb');

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase(uri) {
  if (cachedClient && cachedDb) return { client: cachedClient, db: cachedDb };
  const client = await MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = client.db('circleGame');
  cachedClient = client;
  cachedDb = db;
  return { client, db };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const { username, percentage } = req.body;
  if (!username || typeof percentage !== 'number') return res.status(400).send('Invalid');
  const { db } = await connectToDatabase(process.env.MONGODB_URI);
  await db.collection('attempts').insertOne({ username, percentage, timestamp: new Date() });
  res.json({ success: true });
}; 