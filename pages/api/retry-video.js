import axios from "axios";
import NodeCache from "node-cache";

const CACHE_TTL = parseInt(process.env.CACHE_TTL_SECONDS || "86400", 10);
const cache = new NodeCache({ stdTTL: CACHE_TTL });

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.117 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
];

function unescapeUnicode(str) {
  try { 
    return str.replace(/\\u([\dA-Fa-f]{4})/g, (m, g) => String.fromCharCode(parseInt(g, 16))); 
  } catch { return str; }
}

function parseTikTokHtml(html) {
  if (!html) return null;
  let cleaned = html.replace(/\\u0026/g, "&");
  cleaned = unescapeUnicode(cleaned);

  const downloadMatch = cleaned.match(/"downloadAddr":"(https?:\\\/\\\/[^"]+)"/) || cleaned.match(/"downloadAddr":"(https?:\/\/[^"]+)"/);
  function cleanUrl(raw) { if (!raw) return null; return raw.replace(/\\\//g, "/"); }
  return downloadMatch ? cleanUrl(downloadMatch[1]) : null;
}

async function validateUrl(url, userAgent) {
  try {
    const res = await axios.head(url, { timeout: 15000, headers: { "User-Agent": userAgent } });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function callScraperAPI(url, render = true, userAgent) {
  const apiKey = process.env.SCRAPERAPI_KEY;
  if (!apiKey) throw new Error("Missing SCRAPERAPI_KEY env var");

  const params = { 
    api_key: apiKey, 
    url, 
    render, 
    max_cost: 20, 
    custom_headers: { "User-Agent": userAgent }
  };
  const res = await axios.get("https://api.scraperapi.com", { params, timeout: 90000 });
  return res.data;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  const cacheKey = `tiktok-video:${url}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.status(200).json({ video: cached, cached: true });

  // Parallel attempts for max success
  const attempts = USER_AGENTS.map(async (ua) => {
    try {
      const html = await callScraperAPI(url, true, ua);
      const video = parseTikTokHtml(html);
      if (video && await validateUrl(video, ua)) return video;
    } catch {}
    return null;
  });

  const results = await Promise.all(attempts);
  const video = results.find(v => v !== null);

  if (video) {
    cache.set(cacheKey, video);
    return res.status(200).json({ video });
  } else {
    return res.status(502).json({ error: "Video retry failed. Please try again later." });
  }
}
