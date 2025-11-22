import { useState } from "react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState("");

  async function fetchTikTok() {
    setLoading(true);
    setRetrying(false);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/tiktok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unknown error");
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function retryVideo() {
    if (!url) return;
    setRetrying(true);
    setError("");

    try {
      const res = await fetch("/api/retry-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unknown error");

      setResult(prev => ({ ...prev, video: data.video }));
    } catch (err) {
      setError(err.message);
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>TikTok Downloader</h1>

      <input
        type="text"
        placeholder="Paste TikTok URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
      />
      <button
        onClick={fetchTikTok}
        disabled={loading || !url}
        style={{ padding: "10px 20px", cursor: "pointer" }}
      >
        {loading ? "Fetching..." : "Fetch"}
      </button>

      {error && <p style={{ color: "red", marginTop: "10px" }}>{error}</p>}

      {result && (
        <div style={{ marginTop: "30px" }}>
          <h2 style={{ marginBottom: "10px" }}>{result.title || "Untitled Video"}</h2>
          {result.thumbnail && (
            <img
              src={result.thumbnail}
              alt="Thumbnail"
              style={{ width: "100%", maxWidth: 400, marginBottom: "10px" }}
            />
          )}

          {/* Video */}
          {result.video ? (
            <a
              href={result.video}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-block", marginBottom: "10px" }}
            >
              <button style={{ padding: "10px 20px", cursor: "pointer" }}>
                Download Video
              </button>
            </a>
          ) : (
            <div style={{ marginBottom: "10px" }}>
              <p style={{ color: "orange", display: "inline", marginRight: "10px" }}>
                ⚠️ Video unavailable.
              </p>
              <button
                onClick={retryVideo}
                disabled={retrying}
                style={{ padding: "5px 15px", cursor: "pointer" }}
              >
                {retrying ? "Retrying..." : "Retry Video"}
              </button>
            </div>
          )}

          {/* Audio */}
          {result.audio ? (
            <a
              href={result.audio}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-block", marginBottom: "10px" }}
            >
              <button style={{ padding: "10px 20px", cursor: "pointer" }}>
                Download Audio (MP3)
              </button>
            </a>
          ) : (
            <p style={{ color: "orange" }}>⚠️ Audio unavailable.</p>
          )}

          {/* Cache info */}
          {result.cached && (
            <p style={{ fontSize: "0.8rem", color: "green" }}>✅ Result from cache</p>
          )}
        </div>
      )}
    </div>
  );
}
