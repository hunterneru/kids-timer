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
  try {
    const timerKeys = await redis.smembers('active_timers');
    if (!timerKeys || timerKeys.length === 0) {
      return res.status(200).json({ checked: 0 });
    }

    const now = Date.now();
    let sent = 0;

    for (const key of timerKeys) {
      const raw = await redis.get(key);
      if (!raw) {
        await redis.srem('active_timers', key);
        continue;
      }

      const timer = typeof raw === 'string' ? JSON.parse(raw) : raw;

      if (timer.notified) continue;
      if (timer.endTime > now) continue;

      // Timer expired — send push
      const subRaw = await redis.get(timer.subKey);
      if (!subRaw) {
        timer.notified = true;
        await redis.set(key, JSON.stringify(timer));
        continue;
      }

      const subscription = typeof subRaw === 'string' ? JSON.parse(subRaw) : subRaw;

      const payload = JSON.stringify({
        title: 'Время вышло!',
        body: `${timer.name} — пора забирать!`,
        tag: 'timer-' + timer.timerId,
      });

      try {
        await webpush.sendNotification(subscription, payload);
        sent++;
      } catch (e) {
        // Subscription might be expired, remove it
        if (e.statusCode === 410 || e.statusCode === 404) {
          await redis.del(timer.subKey);
        }
      }

      timer.notified = true;
      await redis.set(key, JSON.stringify(timer));
    }

    return res.status(200).json({ checked: timerKeys.length, sent });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
