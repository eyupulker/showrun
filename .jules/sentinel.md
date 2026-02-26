# Sentinel's Journal

## 2025-02-19 - Unrestricted CORS on Dashboard API
**Vulnerability:** The Dashboard API (`/api/config`) returns sensitive session tokens and is protected by `cors()` middleware with default settings, which allows `Access-Control-Allow-Origin: *`. This permits any malicious website to request the token via Cross-Origin requests (CSRF/CORS-bypass) and subsequently control the dashboard.
**Learning:** Default security middleware configurations (like `cors()`) are often permissive by default to reduce friction, but this is dangerous for local tools exposing sensitive APIs.
**Prevention:** Explicitly configure allowed origins. For local tools, restrict to `localhost`, `127.0.0.1`, and the specific bound host/port.
