import axios from "axios";
import NodeCache from "node-cache";

const CACHE_TTL = parseInt(process.env.CACHE_TTL_SECONDS || "86400", 10); // 24h
const cache = new NodeCache({ stdTTL: CACHE_TTL });

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
  const audioMatch = cleaned.match(/"music":{[^}]*"playUrl":"(https?:\\\/\\\/[^"]+)"/) || cleaned.match(/"music":{[^}]*"playUrl":"(https?:\/\/[^"]+)"/);
  const thumbMatch = cleaned.match(/property="og:image" content="([^"]+)"/) || cleaned.match(/property='og:image' content='([^']+)'/);
  const titleMatch = cleaned.match(/property="og:title" content="([^"]+)"/) || cleaned.match(/property='og:title' content='([^']+)'/);

  function cleanUrl(raw) { if (!raw) return null; return raw.replace(/\\\//g, "/"); }

  const video = cleanUrl(downloadMatch ? downloadMatch[1] : null);
  const audio = cleanUrl(audioMatch ? audioMatch[1] : null);
  const thumbnail = thumbMatch ? thumbMatch[1] : null;
  const title = titleMatch ? titleMatch[1] : null;

  if (!video && !audio) return null;
  return { video, audio, thumbnail, title };
}

async function validateUrl(url) {
  try {
    const res = await axios.head(url, { timeout: 10000 });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function callScraperAPI(url, render = false, maxCost = 10) {
  const apiKey = process.env.SCRAPERAPI_KEY;
  if (!apiKey) throw new Error("Missing SCRAPERAPI_KEY env var");

  const params = { api_key: apiKey, url, render, max_cost: maxCost };
  const res = await axios.get("https://api.scraperapi.com", { params, timeout: 40000 });
  const creditUsed = res.headers["sa-credit-cost"] || maxCost;
  return { html: res.data, creditUsed };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  const cacheKey = `tiktok:${url}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.status(200).json({ ...cached, cached: true });

  let lastError = null;

  // 1️⃣ Try non-rendered request first
  try {
    const { html, creditUsed } = await callScraperAPI(url, false);
    const parsed = parseTikTokHtml(html);
    if (parsed) {
      // validate URLs
      if (parsed.video && !(await validateUrl(parsed.video))) parsed.video = null;
      if (parsed.audio && !(await validateUrl(parsed.audio))) parsed.audio = null;

      cache.set(cacheKey, { ...parsed, creditUsed });
      return res.status(200).json({ ...parsed, creditUsed });
    }
  } catch (err) {
    lastError = err;
    console.warn("[scrape] basic request failed:", err.message || err.toString());
  }

  // 2️⃣ Try rendered request with 2 retries
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { html, creditUsed } = await callScraperAPI(url, true);
      const parsed = parseTikTokHtml(html);
      if (parsed) {
        // validate URLs
        if (parsed.video && !(await validateUrl(parsed.video))) parsed.video = null;
        if (parsed.audio && !(await validateUrl(parsed.audio))) parsed.audio = null;

        if (!parsed.video && !parsed.audio) throw new Error("No valid media URLs after validation");

        cache.set(cacheKey, { ...parsed, creditUsed });
        console.log(`[scrape] render success on attempt ${attempt}, credits: ${creditUsed}`);
        return res.status(200).json({ ...parsed, creditUsed });
      }
    } catch (err) {
      lastError = err;
      console.warn(`[scrape] render attempt ${attempt} failed:`, err.message || err.toString());
    }
  }

  // 3️⃣ All attempts failed
  return res.status(502).json({
    error: "Failed to fetch TikTok media. Please try a different video or wait a few minutes.",
    details: lastError?.message || "Unknown error"
  });
}
