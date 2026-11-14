import 'dotenv/config';
import express from "express";
import http from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { WebSocketServer } from "ws";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Shared server-side Gemini client with aistudio-build telemetry header
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // REST endpoint for generateContent (structured output, tools, multi-turn)
  app.post("/api/gemini/generate", async (req, res) => {
    try {
      const { model, contents, config } = req.body;
      let selectedModel = model || 'gemini-3.8-flash';
      // Sanitize deprecated models if requested
      if (
        selectedModel.includes('1.5') ||
        selectedModel.includes('2.0') ||
        selectedModel === 'gemini-pro'
      ) {
        selectedModel = 'gemini-3.8-flash';
      }

      let response;
      try {
        response = await ai.models.generateContent({
          model: selectedModel,
          contents,
          config: config || {},
        });
      } catch (err: any) {
        const errMsg = typeof err === 'string' ? err : (err?.message || JSON.stringify(err));
        if ((errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE')) && selectedModel !== 'gemini-3.1-flash-lite') {
          console.warn(`Spike on ${selectedModel}, failing over to gemini-3.1-flash-lite`);
          response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents,
            config: config || {},
          });
        } else {
          throw err;
        }
      }

      res.json({
        text: response.text ?? '',
        candidates: response.candidates,
        functionCalls: response.functionCalls,
      });
    } catch (error: any) {
      console.error("Server Gemini Generate Error:", error);
      const status = error?.status || 500;
      res.status(status >= 400 && status < 600 ? status : 500).json({
        error: error?.message || 'Failed to generate content with Gemini',
        details: error
      });
    }
  });

  // SSE endpoint for generateContentStream
  app.post("/api/gemini/stream", async (req, res) => {
    try {
      const { model, contents, config } = req.body;
      let selectedModel = model || 'gemini-3.8-flash';
      if (
        selectedModel.includes('1.5') ||
        selectedModel.includes('2.0') ||
        selectedModel === 'gemini-pro'
      ) {
        selectedModel = 'gemini-3.8-flash';
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const stream = await ai.models.generateContentStream({
        model: selectedModel,
        contents,
        config: config || {},
      });

      for await (const chunk of stream) {
        const text = chunk.text ?? '';
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error: any) {
      console.error("Server Gemini Stream Error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: error?.message || 'Streaming failed' });
      } else {
        res.write(`data: ${JSON.stringify({ error: error?.message || 'Streaming error' })}\n\n`);
        res.end();
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);

  // WebSocket Server for Gemini Live API
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
    if (pathname === '/api/gemini/live' || pathname === '/live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', async (clientWs) => {
    let session: any = null;
    try {
      session = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: 'You are SupplyGuard, an autonomous supply chain agent.',
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            for (const part of message.serverContent?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
              }
            }
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
        },
      });

      clientWs.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.audio) {
            session.sendRealtimeInput({
              audio: { data: parsed.audio, mimeType: 'audio/pcm;rate=16000' },
            });
          }
        } catch (e) {
          console.error('Live WS audio payload error:', e);
        }
      });

      clientWs.on('close', () => {
        if (session) {
          try {
            session.close();
          } catch (_) {}
        }
      });
    } catch (err: any) {
      console.error('Live API connection error:', err);
      clientWs.send(JSON.stringify({ error: err.message || 'Live session failed' }));
      clientWs.close();
    }
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`SupplyGuard Full-Stack Server running on http://localhost:${PORT}`);
  });
}

startServer();
