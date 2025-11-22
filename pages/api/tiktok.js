import axios from "axios";
import NodeCache from "node-cache";

const CACHE_TTL = parseInt(process.env.CACHE_TTL_SECONDS || "86400", 10); // 24h
const cache = new NodeCache({ stdTTL: CACHE_TTL });

function unescapeUnicode(str) {
  try { return str.replace(/\\u([\dA-Fa-f]{4})/g, (m, g) => String.fromCharCode(parseInt(g, 16))); }
  catch { return str; }
}

function parseTikTokHtml(html) {
  if (!html) return null;
  let cleaned = html.replace(/\\u0026/g, "&");
  cleaned = unescapeUnicode(cleaned);

  const downloadMatch = cleaned.match(/"downloadAddr":"(https?:\\\/\\\/[^"]+)"/) || cleaned.match(/"downloadAddr":"(https?:\/\/[^"]+)"/);
  const audioMatch = cleaned.match(/"music":{[^}]*"playUrl":"(https?:\\\/\\\/[^"]+)"/) || cleaned.match(/"music":{[^}]*"playUrl":"(https?:\/\/[^"]+)"/);
  const thumbMatch = cleaned.match(/property="og:image" content="([^"]+)"/) || cleaned.match(/property='og:image' content='([^']+)'/);
  const titleMatch = cleaned.match(/property="og:title" content="([^"]+)"/) || cleaned.match(/property='og:title' content='([^']+)'/);

  function cleanUrl(raw) { if (!raw) return null; return raw.replace(/\\\//g, "/"); }

  const video = cleanUrl(downloadMatch ? downloadMatch[1] : null);
  const audio = cleanUrl(audioMatch ? audioMatch[1] : null);
  const thumbnail = thumbMatch ? thumbMatch[1] : null;
  const title = titleMatch ? titleMatch[1] : null;

  if (!video) return null;
  return { video, audio, thumbnail, title };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  const cacheKey = `tiktok:${url}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.status(200).json({ ...cached, cached: true });

  const apiKey = process.env.SCRAPERAPI_KEY;
  if (!apiKey) return res.status(500).json({ error: "Missing SCRAPERAPI_KEY env var" });

  async function callScraper(params = {}) {
    const r = await axios.get("https://api.scraperapi.com", { params: { api_key: apiKey, ...params }, timeout: 20000 });
    return r;
  }

  try {
    const r1 = await callScraper({ url, render: false });
    const credit1 = r1.headers["sa-credit-cost"] || r1.headers["sa-credit-cost".toLowerCase()] || "1";
    const parsed1 = parseTikTokHtml(r1.data);
    if (parsed1 && parsed1.video) {
      cache.set(cacheKey, { ...parsed1, creditUsed: credit1 });
      console.log(`[scrape] basic success, credits: ${credit1}`);
      return res.status(200).json({ ...parsed1, creditUsed: credit1 });
    }
    console.warn("[scrape] basic parse failed, falling back to render");
  } catch (err) {
    console.warn("[scrape] basic request error:", err.message || err.toString());
  }

  try {
    const maxCost = 10;
    const r2 = await callScraper({ url, render: true, max_cost: maxCost });
    const credit2 = r2.headers["sa-credit-cost"] || String(maxCost);
    const parsed2 = parseTikTokHtml(r2.data);
    if (parsed2 && parsed2.video) {
      cache.set(cacheKey, { ...parsed2, creditUsed: credit2 });
      console.log(`[scrape] render success, credits: ${credit2}`);
      return res.status(200).json({ ...parsed2, creditUsed: credit2 });
    } else {
      return res.status(502).json({ error: "Could not extract video from TikTok page" });
    }
  } catch (err) {
    console.error("[scrape] render request failed:", err.message || err.toString());
    return res.status(500).json({ error: "ScraperAPI render failed" });
  }
}
