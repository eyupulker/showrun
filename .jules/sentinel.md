## 2025-02-28 - Restrict CORS Configuration in Dashboard

**Vulnerability:** The Dashboard Server previously configured Express CORS middleware via `app.use(cors())` and Socket.IO with `origin: '*'`, allowing any cross-origin website to access API endpoints like the unauthenticated `/api/config` to read the server's session token.
**Learning:** Overly permissive CORS configurations on unauthenticated config endpoints completely bypass the intended token-based security by leaking the initial session token to any malicious cross-origin site.
**Prevention:** Ensure `cors` configurations (for both HTTP and WebSockets) use explicit, strict lists of `allowedOrigins` (like localhost/127.0.0.1 and known dev ports) instead of wildcards or default options.
