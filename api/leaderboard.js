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
  const { db } = await connectToDatabase(process.env.MONGODB_URI);
  const pipeline = [
    { $sort: { percentage: -1 } },
    { $group: { _id: "$username", best: { $max: "$percentage" } } },
    { $sort: { best: -1 } },
    { $limit: 10 }
  ];
  const leaderboard = await db.collection('attempts').aggregate(pipeline).toArray();
  res.json(leaderboard);
}; 