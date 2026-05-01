import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createProxyMiddleware } from 'http-proxy-middleware';

// Calculate __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // ---------------------------------------------------------
  // Proxy for Gemini API to hide API_KEY
  // ---------------------------------------------------------

  const geminiProxy = createProxyMiddleware({
    target: 'https://generativelanguage.googleapis.com',
    changeOrigin: true,
    ws: true,
    pathRewrite: (path: string, req: any) => {
      let newPath = path.replace(/^\/api\/gemini/, '');
      // Ensure API key is in the query string for WebSockets (which don't send headers)
      if (newPath.includes('?')) {
        // Remove dummy key if present
        newPath = newPath.replace(/(\?|&)key=[^&]*/, '$1');
        // Ensure not trailing with ? or &
        newPath = newPath.replace(/[?&]$/, '');
        // Append actual key
        newPath += (newPath.includes('?') ? '&' : '?') + `key=${process.env.GEMINI_API_KEY || ''}`;
      } else {
        newPath += `?key=${process.env.GEMINI_API_KEY || ''}`;
      }
      return newPath;
    },
    on: {
      proxyReq: (proxyReq: any) => {
        proxyReq.setHeader('x-goog-api-key', process.env.GEMINI_API_KEY || '');
      },
      proxyReqWs: (proxyReq: any, req: any, socket: any, options: any, head: any) => {
        console.log('WS Proxy request:', req.url, 'Proxy URL:', proxyReq.path);
        proxyReq.setHeader('Origin', 'https://generativelanguage.googleapis.com');
      },
      error: (err, req, res) => {
        console.error('Proxy Error:', err);
      }
    }
  });

  app.use('/api/gemini', geminiProxy);

  // Middleware to parse JSON bodies for our own endpoints
  app.use(express.json());

  // ---------------------------------------------------------
  // API Routes (Backend Endpoints)
  // ---------------------------------------------------------
  
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Server is running smoothly." });
  });

  // Demo Endpoint: Provide API Key for client-side Live API direct connection.
  // Warning: In a production app, the WebSocket should be perfectly proxied or
  // token-based, but to avoid proxy connection drops (1006) in this prototype,
  // we fetch the key for client-side usage.
  app.get("/api/gemini-config", (req, res) => {
    res.json({ apiKey: process.env.GEMINI_API_KEY || "" });
  });

  // Blueprint: We will add Gemini API integration endpoints here.
  // app.post("/api/gemini/generate", async (req, res) => { ... });

  // ---------------------------------------------------------
  // Frontend Serving (Vite / Static)
  // ---------------------------------------------------------
  
  if (process.env.NODE_ENV !== "production") {
    // Development mode: Use Vite's development server as middleware
    console.log("Starting server in development mode with Vite...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: Serve static files built by Vite
    console.log("Starting server in production mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    
    // SPA Fallback: send index.html for any unhandled routes
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server is listening on http://localhost:${PORT}`);
  });

  server.on('upgrade', (req, socket, head) => {
    console.log('UPGRADE requested for URL:', req.url);
    if (req.url && req.url.startsWith('/api/gemini')) {
      console.log('Intercepting WS for Gemini api:', req.url);
      geminiProxy.upgrade(req, socket as any, head);
    }
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
