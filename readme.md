# TikTok Downloader (ScraperAPI)

Simple Next.js app that fetches TikTok video/audio download links using ScraperAPI.
It tries a cheap request first (1 credit) and falls back to a rendered request (10 credits max).
Results are cached for 24 hours.

## Setup (local)

1. Clone or create repo, then run:
   ```bash
   npm install
