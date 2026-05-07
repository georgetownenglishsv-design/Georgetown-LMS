import express, { Request, Response, NextFunction } from "express";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAppCheck } from "firebase-admin/app-check";
import * as dotenv from "dotenv";
import path from "path";
import rateLimit from "express-rate-limit";

dotenv.config();

// 1. Firebase Admin SDK
try {
  initializeApp({
    credential: applicationDefault(),
  });
  console.log("Firebase Admin SDK 초기화 완료");
} catch (error) {
  console.error("Firebase Admin SDK 초기화 실패:", error);
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 8080;

  // Cloud Run 뒤에서 클라이언트의 실제 IP를 얻기 위해 (Rate Limit에 필수)
  app.set("trust proxy", 1);

  // JSON Body Parser for API
  app.use(express.json({ limit: "50mb" }));

  // Rate Limiting (요청량 제한) 추가: 분당 30회로 제한하여 무차별 봇 공격 및 요금 폭탄 방지
  const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // 1분에 IP당 최대 30개 요청
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests from this IP, please try again later." }
  });

  // /api/ 하위의 모든 라우트에 Rate Limiter 적용
  app.use("/api/", apiLimiter);

  // CORS 보안 강화: 기존의 "*" (전체 허용)은 Open Proxy로 오인되어 구글에 의해 차단(Suspended)되는 주 원인입니다.
  app.use((req: Request, res: Response, next: NextFunction) => {
    // 허용할 도메인을 지정. 현재 Frontend와 Backend가 같은 도메인을 쓰므로 
    // 사실상 외부 도메인(Cross-Origin)에서의 접근을 다 막아도 무방합니다.
    const allowedOrigins = [
      "http://localhost:5173", 
      "http://localhost:3000",
      "http://localhost:8080"
      // 실제 서비스하시는 홈페이지 도메인(예: "https://www.yourdomain.com", "https://gteamgr-506ff.web.app" 등)이 
      // 있다면 여기에 추가해야 합니다!
    ];
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    } 
    // 만약 origin이 없고 동일 도메인(내부 라우팅)에서 들어오는거면 브라우저가 origin 헤더를 안 보내기도 합니다.

    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-appcheck-token");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // REST API: Gemini
  app.post("/api/gemini", async (req: Request, res: Response) => {
    try {
      // 보안 규칙: App Check Token 검증
      const appCheckToken = req.header("X-Firebase-AppCheck") || req.header("x-appcheck-token");

      if (appCheckToken) {
        try {
          await getAppCheck().verifyToken(appCheckToken);
        } catch (e) {
          console.warn("App Check failed:", e);
          if (process.env.NODE_ENV === "production") {
            res.status(401).json({ error: "Unauthorized: App Check validation failed." });
            return;
          }
        }
      } else if (process.env.NODE_ENV === "production") {
        console.warn("Missing App Check token on standard HTTP.");
        res.status(401).json({ error: "Unauthorized: Missing App Check token." });
        return;
      }

      const payload = req.body;
      const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      if (!GEMINI_API_KEY) throw new Error("Missing Gemini API Key");

      const { GoogleGenAI } = await import("@google/genai");
      const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

      const response = await genAI.models.generateContent({
        model: payload.model || "gemini-2.5-flash",
        contents: payload.contents,
        config: payload.config,
      });

      res.status(200).json({ ...response, text: response.text });
    } catch (err: any) {
      console.error("/api/gemini error:", err);
      res.status(500).json({ error: err.message || "Server Error" });
    }
  });

  // Health check
  app.get("/health", (req: Request, res: Response) => res.send("OK"));

  // Vite Middleware
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, {
      setHeaders: (res: Response, filePath: string) => {
        if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        } else if (filePath.endsWith('.css')) {
          res.setHeader('Content-Type', 'text/css; charset=utf-8');
        } else if (filePath.endsWith('.html')) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
        }
      }
    }));
    app.get("*all", (req: Request, res: Response) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // HTTP Server creation
  const server = http.createServer(app);

  // WebSocket Server
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (request, socket, head) => {
    try {
      const url = new URL(request.url || "", `http://${request.headers.host}`);
      
      // 우리 백엔드용 웹소켓 연결(/api/ws)이 아니면 Vite HMR 등에 양보합니다
      if (!url.pathname.startsWith("/api/ws")) {
        return; 
      }
      
      const appCheckToken = url.searchParams.get("appCheckToken");
      
      // 보안 규칙 (개발 환경에서는 개발용 토큰이나 누락을 유연하게 넘어갈 수 있습니다)
      if (appCheckToken) {
        try {
          await getAppCheck().verifyToken(appCheckToken);
        } catch (e) {
          console.warn("App Check 검증 실패 (개발 환경에서는 통과 허용할 수 있음):", e);
          if (process.env.NODE_ENV === "production") {
            socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
            socket.destroy();
            return;
          }
        }
      } else if (process.env.NODE_ENV === "production") {
        console.warn("App Check 증명서(토큰) 누락. 연결을 즉시 차단합니다.");
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } catch (error) {
      console.error("웹소켓 업그레이드 에러 핸들링:", error);
      socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
      socket.destroy();
    }
  });

  wss.on("connection", (clientWs: WebSocket) => {
    console.log("클라이언트 웹소켓 연결 성공 및 터널링 준비 완료.");

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      clientWs.close(1011, "Internal Server Error: Missing API Key");
      return;
    }

    const host = "generativelanguage.googleapis.com";
    const wsUrl = `wss://${host}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;

    const geminiWs = new WebSocket(wsUrl);
    const messageQueue: any[] = [];
    let isGeminiReady = false;

    geminiWs.on("open", () => {
      isGeminiReady = true;
      while (messageQueue.length > 0) {
        geminiWs.send(messageQueue.shift()!);
      }
    });

    geminiWs.on("message", (data, isBinary) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data, { binary: isBinary });
      }
    });

    geminiWs.on("close", (code, reason) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        try {
          const validCode = code === 1000 || (code >= 3000 && code <= 4999) ? code : 1000;
          clientWs.close(validCode, reason.toString());
        } catch (e) {
          clientWs.close();
        }
      }
    });

    geminiWs.on("error", (err) => console.error("Gemini WS 에러 발생:", err));

    clientWs.on("message", (message, isBinary) => {
      if (isGeminiReady) {
        if (geminiWs.readyState === WebSocket.OPEN) {
          geminiWs.send(message, { binary: isBinary });
        }
      } else {
        messageQueue.push(message);
      }
    });

    clientWs.on("close", (code, reason) => {
      if (geminiWs.readyState === WebSocket.OPEN) {
        try {
          const validCode = code === 1000 || (code >= 3000 && code <= 4999) ? code : 1000;
          geminiWs.close(validCode, reason.toString());
        } catch (e) {
          geminiWs.close();
        }
      }
    });

    clientWs.on("error", (error) => console.error("클라이언트 웹소켓 에러 발생:", error));
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 보안 웹소켓 백엔드 서버가 포트 ${PORT}에서 실행 중입니다.`);
  });
}

startServer();
