import { cors, json, streamJson } from './_lib.js';
import { selfTestAndStore } from './_engines.js';
export const config = { runtime: 'edge' };
export default async function handler(req) {
  const h = cors(req), s = process.env.CRON_SECRET;
  if (s && req.headers.get('authorization') !== 'Bearer ' + s) return json({ error: 'unauthorized' }, 401, h);
  return streamJson(h, () => selfTestAndStore());
}
