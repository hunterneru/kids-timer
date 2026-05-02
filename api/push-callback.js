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
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { timerId, subKey, name } = req.body;

    // Check if timer still exists and hasn't been notified already
    const timerRaw = await redis.get('timer:' + timerId);
    if (!timerRaw) return res.status(200).json({ skipped: 'timer deleted' });

    const timer = typeof timerRaw === 'string' ? JSON.parse(timerRaw) : timerRaw;
    if (timer.notified) return res.status(200).json({ skipped: 'already notified' });

    // Get push subscription
    const subRaw = await redis.get(subKey);
    if (!subRaw) return res.status(200).json({ skipped: 'no subscription' });

    const subscription = typeof subRaw === 'string' ? JSON.parse(subRaw) : subRaw;

    const payload = JSON.stringify({
      title: 'Время вышло!',
      body: `${name || 'Ребёнок'} — пора забирать!`,
      tag: 'timer-' + timerId,
    });

    await webpush.sendNotification(subscription, payload);

    // Mark as notified
    timer.notified = true;
    await redis.set('timer:' + timerId, JSON.stringify(timer));

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
