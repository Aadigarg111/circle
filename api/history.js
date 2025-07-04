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
  if (req.method !== 'GET') return res.status(405).end();
  const { username } = req.query;
  if (!username) return res.status(400).send('Missing username');
  const { db } = await connectToDatabase(process.env.MONGODB_URI);
  const history = await db.collection('attempts').find({ username }).sort({ timestamp: -1 }).limit(10).toArray();
  res.json(history);
}; 