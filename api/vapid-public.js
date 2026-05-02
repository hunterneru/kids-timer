// Returns the VAPID public key so the frontend can subscribe to push
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY });
}
