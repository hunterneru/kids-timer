import { Redis } from '@upstash/redis';
import { Client } from '@upstash/qstash';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const qstash = new Client({ token: process.env.QSTASH_TOKEN });

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Get the base URL for callbacks
  const host = req.headers.host;
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  try {
    if (req.method === 'POST') {
      const { timerId, name, description, endTime, subKey } = req.body;
      if (!timerId || !endTime || !subKey) {
        return res.status(400).json({ error: 'Missing fields' });
      }

      const timer = {
        timerId,
        name: name || 'Ребёнок',
        description: description || '',
        endTime,
        subKey,
        notified: false,
      };

      await redis.set('timer:' + timerId, JSON.stringify(timer));
      await redis.sadd('active_timers', 'timer:' + timerId);

      // Schedule delayed push via QStash
      const delaySeconds = Math.max(0, Math.floor((endTime - Date.now()) / 1000));

      await qstash.publishJSON({
        url: `${baseUrl}/api/push-callback`,
        body: { timerId, subKey, name: timer.name },
        delay: delaySeconds,
      });

      return res.status(200).json({ ok: true, delay: delaySeconds });
    }

    if (req.method === 'DELETE') {
      const { timerId } = req.body;
      if (!timerId) return res.status(400).json({ error: 'Missing timerId' });

      await redis.del('timer:' + timerId);
      await redis.srem('active_timers', 'timer:' + timerId);

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
