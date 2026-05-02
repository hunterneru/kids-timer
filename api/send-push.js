import { Redis } from '@upstash/redis';
import webpush from 'web-push';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

webpush.setVapidDetails(
  'mailto:' + (process.env.VAPID_EMAIL || 'noreply@example.com'),
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { subKey, title, body } = req.body;
    if (!subKey) return res.status(400).json({ error: 'Missing subKey' });

    const subRaw = await redis.get(subKey);
    if (!subRaw) return res.status(404).json({ error: 'Subscription not found' });

    const subscription = typeof subRaw === 'string' ? JSON.parse(subRaw) : subRaw;

    const payload = JSON.stringify({
      title: title || 'Время вышло!',
      body: body || 'Пора забирать ребёнка!',
      tag: 'kids-timer-' + Date.now(),
    });

    await webpush.sendNotification(subscription, payload);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
