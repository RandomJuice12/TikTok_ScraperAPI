import { useState } from "react";
import axios from "axios";

export default function Home() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!url) return alert("Paste a TikTok URL");
    setLoading(true);
    setResult(null);

    try {
      const res = await axios.post("/api/tiktok", { url });
      setResult(res.data);
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.error || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", padding: 20 }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, marginBottom: 12 }}>TikTok Downloader</h1>
        <p style={{ marginBottom: 18 }}>Paste a TikTok URL and get direct download links.</p>

        <form onSubmit={submit} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.tiktok.com/@.../video/..."
            style={{ flex: 1, padding: 10, borderRadius: 6, border: "1px solid #ddd" }}
          />
          <button type="submit" disabled={loading} style={{ padding: "10px 16px", borderRadius: 6 }}>
            {loading ? "Loading..." : "Fetch"}
          </button>
        </form>

        {result && (
          <div style={{ marginTop: 18, padding: 12, border: "1px solid #eee", borderRadius: 6 }}>
            <h2 style={{ marginBottom: 8 }}>Results</h2>
            <div style={{ marginBottom: 8 }}><strong>Credits used:</strong> {result.creditUsed ?? "unknown"}</div>
            {result.title && <div style={{ marginBottom: 8 }}><strong>Title:</strong> {result.title}</div>}
            {result.thumbnail && (
              <div style={{ marginBottom: 8 }}>
                <img src={result.thumbnail} alt="thumb" style={{ maxWidth: "100%" }} />
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {result.video && (
                <a href={result.video} target="_blank" rel="noreferrer" style={{ padding: 10, background: "#10b981", color: "white", textDecoration: "none", borderRadius: 6 }}>
                  Download Video (No Watermark)
                </a>
              )}
              {result.audio && (
                <a href={result.audio} target="_blank" rel="noreferrer" style={{ padding: 10, background: "#7c3aed", color: "white", textDecoration: "none", borderRadius: 6 }}>
                  Download Audio (MP3)
                </a>
              )}
            </div>
          </div>
        )}

        <footer style={{ marginTop: 32, color: "#666" }}>
          <small>Tip: cache saves credits. Monitor sa-credit-cost in server logs.</small>
        </footer>
      </div>
    </div>
  );
}
