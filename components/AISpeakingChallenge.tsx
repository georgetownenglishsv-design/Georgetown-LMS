import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "./Icon";
import { Logo } from "./Logo";
import {
  getTodaySpeakingProgress,
  updateSpeakingProgress,
} from "../services/db";
import { getAppCheckToken } from "../firebase";

// --- Audio Capture (Mic -> PCM16 Base64) ---
class AudioStreamer {
  audioContext: AudioContext | null = null;
  mediaStream: MediaStream | null = null;
  processor: ScriptProcessorNode | null = null;
  source: MediaStreamAudioSourceNode | null = null;
  mediaRecorder: MediaRecorder | null = null;
  audioChunks: Blob[] = [];

  async start(onAudioData: (base64: string, isSpeaking: boolean) => void) {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      this.audioChunks = [];
      try {
        this.mediaRecorder = new MediaRecorder(this.mediaStream);
        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) this.audioChunks.push(e.data);
        };
        this.mediaRecorder.start();
      } catch (e) {
        console.error("MediaRecorder init failed", e);
      }

      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx({ sampleRate: 16000 });
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      let silenceStart: number | null = null;
      const SILENCE_THRESHOLD = 500;
      const HANGOVER_BUFFER_MS = 2000;

      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          const val = Math.max(-1, Math.min(1, inputData[i])) * 32767;
          pcm16[i] = val;
          sum += Math.abs(val);
        }

        const averageVolume = sum / inputData.length;
        const isSpeakingNow = averageVolume > SILENCE_THRESHOLD;

        // ALWAYS transmit audio to let Gemini handle its own VAD.
        // This prevents the WebSocket connection from timing out due to inactivity!
        const buffer = new ArrayBuffer(pcm16.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < pcm16.length; i++) {
          view.setInt16(i * 2, pcm16[i], true);
        }

        // Convert ArrayBuffer to Base64 efficiently
        let binary = "";
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        
        // We send the PCM stream and pass `isSpeakingNow` so the UI visually responds.
        onAudioData(btoa(binary), isSpeakingNow);
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
    } catch (err) {
      console.error("Microphone access denied or failed", err);
      throw err;
    }
  }

  async stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
        this.mediaRecorder.onstop = () => {
          const blob = new Blob(this.audioChunks, {
            type: this.mediaRecorder?.mimeType || "audio/webm",
          });
          this.cleanup();
          resolve(blob);
        };
        this.mediaRecorder.stop();
      } else {
        this.cleanup();
        resolve(null);
      }
    });
  }

  cleanup() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// --- Audio Playback (PCM24 Base64 -> Speaker) ---
class AudioPlayer {
  audioContext: AudioContext | null = null;
  nextPlayTime: number = -1;

  init() {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioCtx({ sampleRate: 24000 });
    this.nextPlayTime = -1;

    // Autoplay Policy Bypass Hack for iOS Safari
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume().catch((e) => console.warn("AudioContext resume failed:", e));
    }
    
    // Play a tiny silent buffer immediately during synchronous user gesture
    const buffer = this.audioContext.createBuffer(1, 1, 24000);
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    source.start();
  }

  play(base64: string) {
    if (!this.audioContext) return;
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }

    // 초고속 Base64 디코딩
    const binary = atob(base64);
    const length = binary.length;
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const audioBuffer = this.audioContext.createBuffer(
      1,
      bytes.length / 2,
      this.audioContext.sampleRate,
    );
    const channelData = audioBuffer.getChannelData(0);
    const dataView = new DataView(bytes.buffer);
    for (let i = 0; i < channelData.length; i++) {
      channelData[i] = dataView.getInt16(i * 2, true) / 32768;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    if (
      this.nextPlayTime === -1 ||
      this.audioContext.currentTime > this.nextPlayTime
    ) {
      this.nextPlayTime = this.audioContext.currentTime + 0.1; // Add 100ms buffering
    }

    source.start(this.nextPlayTime);
    this.nextPlayTime += audioBuffer.duration;
  }

  stop() {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

interface AISpeakingChallengeProps {
  onClose: () => void;
  studentId?: string;
  studentName?: string;
  isPromo?: boolean;
  duration?: number;
}

const AISpeakingChallenge: React.FC<AISpeakingChallengeProps> = ({
  onClose,
  studentId,
  studentName = "Guest",
  isPromo = false,
  duration = 180,
}) => {
  const TOTAL_SECONDS = duration;
  const [isActive, setIsActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TOTAL_SECONDS);
  const [isConnecting, setIsConnecting] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);

  // Keep global sync for speech recognition
  useEffect(() => {
    (window as any).isAiCurrentlySpeaking = aiSpeaking;
  }, [aiSpeaking]);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const [isLoadingProgress, setIsLoadingProgress] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [transcript, setTranscript] = useState<
    { speaker: string; text: string }[]
  >([]);
  const transcriptRef = useRef<{ speaker: string; text: string }[]>([]);
  const currentInputTranscriptRef = useRef<string>("");
  const currentOutputTranscriptRef = useRef<string>("");
  const [report, setReport] = useState<{
    strengths: string;
    improvement: string;
    nativePhrasing?: string;
    vocabulary?: string[];
    feedback: string;
  } | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const addDebugLog = (log: string) => {
    console.log(log);
    setDebugLogs((prev) =>
      [
        ...prev,
        `${new Date().toISOString().split("T")[1].split(".")[0]} - ${log}`,
      ].slice(-5),
    );
  };

  const sessionRef = useRef<any>(null);
  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchProgress = async () => {
      if (isPromo) {
        setIsLoadingProgress(false);
        return;
      }
      if (!studentId) return;

      setIsLoadingProgress(true);
      const progress = await getTodaySpeakingProgress(studentId);
      if (progress) {
        if (progress.isCompleted || progress.secondsUsed >= TOTAL_SECONDS) {
          setIsCompleted(true);
          setTimeLeft(0);
        } else {
          setTimeLeft(TOTAL_SECONDS - progress.secondsUsed);
        }
      }
      setIsLoadingProgress(false);
    };
    fetchProgress();
  }, [studentId]);

  const startChallenge = async () => {
    setConnectionError(null);
    setIsConnecting(true);
    
    // Solo borramos el transcript si es un nuevo desafío desde cero
    if (timeLeft === TOTAL_SECONDS) {
      setTranscript([]);
      transcriptRef.current = [];
    }
    currentOutputTranscriptRef.current = "";
    addDebugLog("Iniciando sesión...");

    audioStreamerRef.current = new AudioStreamer();
    audioPlayerRef.current = new AudioPlayer();
    audioPlayerRef.current.init();

    try {
      let appCheckToken = "";
      try {
        const { firebase } = await import("../firebase");
        const appCheck = firebase.appCheck();
        const tokenResult = await appCheck.getToken();
        appCheckToken = tokenResult.token;
      } catch (err) {
        console.warn("No se pudo obtener el token de App Check:", err);
      }

      addDebugLog("Solicitando acceso al micrófono...");
      let micStreamStarted = false;

      await audioStreamerRef.current.start((base64Data, isSpeaking) => {
        setUserSpeaking(isSpeaking);
        if (sessionRef.current && micStreamStarted && base64Data) {
          const ws = sessionRef.current;
          if (ws && ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(
                JSON.stringify({
                  realtimeInput: {
                    audio: {
                      mimeType: "audio/pcm;rate=16000",
                      data: base64Data,
                    },
                  },
                }),
              );
            } catch (e) {
              // Ignore errors if session is closed
            }
          }
        }
      });
      addDebugLog("Micrófono conectado. Conectando al Backend WebSocket...");

      const topics = [
        "food (pupusas versus pizza, favorite snacks)",
        "hobbies (playing sports, watching movies, listening to music)",
        "weather (sunny days, rain, feeling hot or cold)",
        "daily routine (morning coffee, going to work or school)",
        "animals (having dogs or cats as pets)",
        "traveling (going to the beach or the mountains in El Salvador)",
        "weekend plans (relaxing at home or going out)",
      ];
      const randomTopic = topics[Math.floor(Math.random() * topics.length)];

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/ws?appCheckToken=${appCheckToken}`;

      const ws = new WebSocket(wsUrl);
      sessionRef.current = ws;

      ws.onopen = () => {
        addDebugLog("Conexión WebSocket abierta estructurando setup...");
        setIsConnecting(false);
        setIsActive(true);
        micStreamStarted = true;

        // Start Timer
        timerRef.current = setInterval(() => {
          setTimeLeft((prev) => Math.max(0, prev - 1));
        }, 1000);

        // Periodic Save (every 10 seconds)
        saveIntervalRef.current = setInterval(() => {
          setTimeLeft((current) => {
            const used = TOTAL_SECONDS - current;
            if (used > 0 && current > 0 && !isPromo && studentId) {
              updateSpeakingProgress(studentId, used, false);
            }
            return current;
          });
        }, 10000);

        const setupMessage = {
          setup: {
            model: "models/gemini-3.1-flash-live-preview",
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
              },
            },
            systemInstruction: {
              parts: [
                {
                  text: `You are Emma, an extremely dynamic, energetic, and friendly American English teacher who has been living in El Salvador for 3 years. You are tutoring a student named ${studentName}.
CRITICAL RULES:
1. LEVEL: Speak strictly at a CEFR A2 to B1 English level. Use very simple words and short sentences (maximum 7-10 words per sentence). Do NOT use complex idioms or advanced grammar.
2. TONE: Be as enthusiastic and encouraging as a kindergarten or elementary school teacher. Praise the student enthusiastically (e.g., "Excellent!", "Great job!") even for single-word answers.
3. CONVERSATION STYLE: NEVER ask open-ended questions that might make a beginner freeze (e.g., "What did you do today?"). ALWAYS ask closed-ended, multiple-choice questions (A or B) so the student can just repeat one of your words to answer. (e.g., "Do you like the beach or the mountains?", "Are you happy or tired?").
4. CORRECTIONS: Do not harshly correct grammar. Just naturally repeat the correct sentence in an encouraging way.
5. START: Warmly greet ${studentName} with high energy. Your specific conversation topic for today is: ${randomTopic}. Mention something small about living in El Salvador related to this topic to build rapport, and immediately ask a simple A or B question about it. IMPORTANT: Keep the conversation fresh and different each time!`,
                },
              ],
            },
          },
        };
        ws.send(JSON.stringify(setupMessage));
      };

      ws.onmessage = async (event) => {
        let message: any;
        try {
          let dataStr = event.data;
          if (event.data instanceof Blob) {
            dataStr = await event.data.text();
          } else if (event.data instanceof ArrayBuffer) {
            dataStr = new TextDecoder().decode(event.data);
          }
          message = JSON.parse(dataStr);
        } catch (e) {
          console.error("Failed to parse message", e);
          return;
        }

        const setupComplete = message.setupComplete || message.setup_complete;
        if (setupComplete) {
          const prompt = `System Command: Greet me warmly using my name (${studentName}), and ask me a simple question to start the conversation right now. Keep it brief.`;
          const clientContent = {
            clientContent: {
              turns: [{ role: "user", parts: [{ text: prompt }] }],
              turnComplete: true,
            },
          };
          ws.send(JSON.stringify(clientContent));
          addDebugLog(
            "Mensaje inicial enviado exitosamente después del setup.",
          );
        }

        const serverContent = message.serverContent || message.server_content;

        if (serverContent?.interrupted) {
          addDebugLog("AI fue interrumpida por ruido.");
        }

        const modelTurn = serverContent?.modelTurn || serverContent?.model_turn;

        if (modelTurn?.parts) {
          for (const p of modelTurn.parts) {
            const inlineData = p.inlineData || p.inline_data;
            const base64Audio = inlineData?.data;

            if (base64Audio) {
              setAiSpeaking(true);
              audioPlayerRef.current?.play(base64Audio);

              if ((window as any).aiSpeakingTimeout) {
                clearTimeout((window as any).aiSpeakingTimeout);
              }
              (window as any).aiSpeakingTimeout = setTimeout(() => {
                setAiSpeaking(false);
              }, 1000);
            }

            if (p.text) {
              currentOutputTranscriptRef.current += p.text;
            }
          }
        }

        const inputTranscription =
          serverContent?.inputTranscription ||
          serverContent?.input_transcription;
        if (inputTranscription) {
          const text = inputTranscription.text || "";
          currentInputTranscriptRef.current += text;
          if (inputTranscription.finished) {
            const newEntry = {
              speaker: "Student",
              text: currentInputTranscriptRef.current.trim(),
            };
            if (newEntry.text) {
              setTranscript((prev) => [...prev, newEntry]);
              transcriptRef.current.push(newEntry);
            }
            currentInputTranscriptRef.current = "";
          }
        }


        const turnComplete =
          serverContent?.turnComplete || serverContent?.turn_complete;
        if (turnComplete) {
          if (currentOutputTranscriptRef.current.trim().length > 0) {
            const newEntry = {
              speaker: "Emma",
              text: currentOutputTranscriptRef.current.trim(),
            };
            setTranscript((prev) => [...prev, newEntry]);
            transcriptRef.current.push(newEntry);
            currentOutputTranscriptRef.current = "";
          }
          addDebugLog("Turno de la AI completado.");
        }
      };

      ws.onclose = (event) => {
        addDebugLog(
          `WS Closed: code=${event.code}, reason=${event.reason}, wasClean=${event.wasClean}`,
        );
        if (event.code === 1006) {
          setConnectionError(
            `Error 1006: La conexión finalizó abruptamente. El backend podría no estar respondiendo.`,
          );
        } else if (event.code !== 1000) {
          setConnectionError(
            `Conexión cerrada: ${event.reason || "Desconocido"} (Code: ${event.code})`,
          );
        }
        endChallenge();
      };

      ws.onerror = (err: any) => {
        addDebugLog(`WS Error`);
        setConnectionError(`Error de servidor WebSocket.`);
        endChallenge();
      };
    } catch (err: any) {
      addDebugLog(`Failed to start challenge: ${err?.message || err}`);
      console.error("Failed to start challenge:", err);
      setIsConnecting(false);
      const errorMessage = err?.message || "Error desconocido";
      setConnectionError(errorMessage);
      endChallenge();
    }
  };

  const generateFeedbackReport = async (
    finalTranscript: { speaker: string; text: string }[],
    audioBlob?: Blob | null
  ) => {
    setIsGeneratingReport(true);
    try {
      const transcriptText = finalTranscript
        .map((t) => `${t.speaker}: ${t.text}`)
        .join("\n");

      const parts: any[] = [];
      let promptText = `You are an expert English tutor evaluating a student's speaking session. Based on the following conversation transcript and the audio recording provided, provide a highly detailed, luxurious, and encouraging feedback report for the student.

      Deeply analyze both their text (for topic maintenance) and their audio (for pronunciation, fluency, and grammatical errors in speech) if provided. If no audio is provided, rely on the transcript.
      
      IMPORTANT: If the transcript is mostly empty and no audio is present, STILL generate the JSON strictly matching the schema. Just write a highly encouraging message in the strengths, improvement, and feedback fields saying that they should try using their microphone again, and provide generic vocabulary/phrases. YOU MUST OUTPUT VALID JSON ONLY.

        Transcript:
        ${transcriptText || "(No conversation recorded)"}

        Provide the response in JSON format with the following keys:
        - strengths: A detailed paragraph highlighting what the student did exceptionally well (e.g., pronunciation, vocabulary usage, conversational flow). If empty, encourage them to speak up!
        - improvement: A detailed paragraph highlighting specific areas for improvement, focusing strictly on grammatical corrections, word choice, and pronunciation.
        - nativePhrasing: Suggest 2-3 more natural, native-speaker ways to phrase things the student said. Quote their original phrasing first. If none, provide a generic useful English phrase.
        - vocabulary: A list of 3-5 key vocabulary words or idioms relevant to the conversation topic that the student could learn to express themselves better next time.
        - feedback: A warm, highly encouraging closing message.
        
        Respond entirely in Spanish, except for the English examples in 'nativePhrasing' and 'vocabulary'. Make the tone extremely professional, impressive, and motivating.`;

      parts.push({ text: promptText });

      if (audioBlob) {
        try {
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onloadend = () => {
              const result = reader.result as string;
              if (result) {
                const base64 = result.split(',')[1];
                resolve(base64);
              } else {
                reject(new Error("Failed to read audio blob"));
              }
            };
            reader.onerror = reject;
            reader.readAsDataURL(audioBlob);
          });
          const base64Data = await base64Promise;
          
          parts.push({
            inlineData: {
              data: base64Data,
              mimeType: audioBlob.type || "audio/webm",
            }
          });
          console.log("Attached audio blob of size:", audioBlob.size, "mime:", audioBlob.type);
        } catch (e) {
          console.error("Error attaching audio blob:", e);
        }
      }

      console.log("Sending to /api/gemini with transcript:", transcriptText);
      const appCheckToken = await getAppCheckToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (appCheckToken) {
        headers["X-Firebase-AppCheck"] = appCheckToken;
      }

      const res = await fetch("/api/gemini", {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts }],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                strengths: { type: "STRING" },
                improvement: { type: "STRING" },
                nativePhrasing: { type: "STRING" },
                vocabulary: {
                  type: "ARRAY",
                  items: { type: "STRING" },
                },
                feedback: { type: "STRING" },
              },
              required: [
                "strengths",
                "improvement",
                "nativePhrasing",
                "vocabulary",
                "feedback",
              ],
            },
          },
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Backend proxy error:", errorText);
        throw new Error(`Failed to generate report from backend proxy: ${res.status} ${errorText}`);
      }

      const response = await res.json();
      console.log("Response from /api/gemini:", response);

      const resultText = response.text;
      if (resultText) {
        // Clean up markdown formatting if present
        const cleanedText = resultText
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();
        const parsed = JSON.parse(cleanedText);
        if (parsed && typeof parsed === "object") {
          setReport({
            strengths:
              typeof parsed.strengths === "string"
                ? parsed.strengths
                : JSON.stringify(parsed.strengths || "Buen trabajo."),
            improvement:
              typeof parsed.improvement === "string"
                ? parsed.improvement
                : JSON.stringify(parsed.improvement || "Sigue practicando."),
            nativePhrasing:
              typeof parsed.nativePhrasing === "string"
                ? parsed.nativePhrasing
                : parsed.nativePhrasing
                  ? JSON.stringify(parsed.nativePhrasing)
                  : undefined,
            vocabulary: Array.isArray(parsed.vocabulary)
              ? parsed.vocabulary.map((v: any) =>
                  typeof v === "string" ? v : JSON.stringify(v),
                )
              : [],
            feedback:
              typeof parsed.feedback === "string"
                ? parsed.feedback
                : JSON.stringify(parsed.feedback || "¡Sigue así!"),
          });
        } else {
          throw new Error("Invalid JSON structure returned by LLM");
        }
      }
    } catch (e) {
      console.error("Error generating report", e);
      setReport({
        strengths:
          "¡Buen esfuerzo intentando hablar en inglés! Has demostrado valentía al practicar.",
        improvement:
          "Sigue practicando para mejorar tu fluidez y confianza al hablar.",
        nativePhrasing:
          "En lugar de traducir literalmente, intenta escuchar cómo lo dicen los nativos en películas o series.",
        vocabulary: ["Practice makes perfect", "Keep it up", "Don't give up"],
        feedback:
          "¡No te rindas, la práctica constante es la clave del éxito! Estoy muy orgullosa de ti.",
      });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleEarlyTermination = async () => {
    const audioBlob = await endChallenge();
    setIsCompleted(true);
    setShowReport(true);
    if (!isPromo && studentId) {
      await updateSpeakingProgress(studentId, TOTAL_SECONDS - timeLeft, true);
    }
    await generateFeedbackReport(transcriptRef.current, audioBlob);
  };

  const handleTimeUp = async () => {
    const audioBlob = await endChallenge();
    setIsCompleted(true);
    setShowReport(true);
    if (!isPromo && studentId) {
      await updateSpeakingProgress(studentId, TOTAL_SECONDS, true);
    }
    await generateFeedbackReport(transcriptRef.current, audioBlob);
  };

  const endChallenge = async () => {
    setIsActive(false);
    setIsConnecting(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);

    // Save final progress if not completed
    setTimeLeft((current) => {
      if (current > 0 && current < TOTAL_SECONDS && !isPromo && studentId) {
        updateSpeakingProgress(studentId, TOTAL_SECONDS - current, false);
      }
      return current;
    });

    const audioBlob = await audioStreamerRef.current?.stop();
    audioPlayerRef.current?.stop();

    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (e) {}
      sessionRef.current = null;
    }
    return audioBlob;
  };

  useEffect(() => {
    return () => {
      endChallenge().catch((e) => console.log("Cleanup error:", e));
    };
  }, []);

  useEffect(() => {
    if (isActive && timeLeft === 0 && !isCompleted) {
      handleTimeUp();
    }
  }, [timeLeft, isActive, isCompleted]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b border-slate-800 relative z-10 shrink-0">
            <div>
              <h2 className="text-white font-bold text-lg">
                Práctica de Speaking ✨
              </h2>
              <p className="text-slate-400 text-sm">Tutora Nativa Emma</p>
            </div>
            <button
              onClick={onClose}
              className="size-10 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-colors"
            >
              <Icon name="close" />
            </button>
          </div>

          {/* Main Content */}
          <div
            className={`p-6 md:p-8 flex flex-col items-center min-h-[400px] relative overflow-y-auto flex-1 ${showReport ? "justify-start" : "justify-center"}`}
          >
            {/* Background Aurora */}
            <div className="absolute inset-0 opacity-30 pointer-events-none overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500 rounded-full mix-blend-screen filter blur-[80px] animate-pulse"></div>
              <div
                className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-500 rounded-full mix-blend-screen filter blur-[80px] animate-pulse"
                style={{ animationDelay: "1s" }}
              ></div>
            </div>

            {isLoadingProgress ? (
              <div className="relative z-10 flex flex-col items-center text-center">
                <Icon
                  name="sync"
                  className="text-4xl text-blue-400 animate-spin mb-4"
                />
                <p className="text-slate-300">Cargando tu progreso...</p>
              </div>
            ) : showReport ? (
              <motion.div
                className="relative z-10 flex flex-col items-center text-center w-full h-full"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div className="flex-1 overflow-y-auto w-full pb-4">
                  <div className="size-24 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(250,204,21,0.5)]">
                    <Icon name="emoji_events" className="text-5xl text-white" />
                  </div>
                  <h3 className="text-3xl font-black text-white mb-2 bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-500">
                    ¡Misión Cumplida!
                  </h3>
                  <p className="text-slate-300 mb-6 text-lg">
                    Has completado tu speaking de hoy.
                  </p>

                  <div className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-4 backdrop-blur-sm">
                    <div className="flex items-center justify-center space-x-2 mb-4">
                      <Icon name="star" className="text-yellow-400 text-xl" />
                      <span className="text-white font-bold text-xl">
                        +50 Puntos
                      </span>
                    </div>

                    {isGeneratingReport ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center justify-center py-8"
                      >
                        <div className="relative size-16 mb-4">
                          <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
                          <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          <Icon
                            name="auto_awesome"
                            className="absolute inset-0 m-auto text-2xl text-blue-400 animate-pulse"
                          />
                        </div>
                        <p className="text-blue-300 font-medium animate-pulse">
                          Emma está analizando tu conversación...
                        </p>
                      </motion.div>
                    ) : report ? (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ staggerChildren: 0.1 }}
                        className="text-left space-y-5"
                      >
                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                        >
                          <h4 className="text-green-400 font-bold text-sm uppercase mb-2 flex items-center gap-2">
                            <div className="p-1.5 bg-green-500/20 rounded-lg">
                              <Icon name="thumb_up" className="text-sm" />
                            </div>
                            Puntos Fuertes
                          </h4>
                          <p className="text-slate-200 text-sm leading-relaxed bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                            {report.strengths}
                          </p>
                        </motion.div>
                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 }}
                        >
                          <h4 className="text-orange-400 font-bold text-sm uppercase mb-2 flex items-center gap-2">
                            <div className="p-1.5 bg-orange-500/20 rounded-lg">
                              <Icon name="trending_up" className="text-sm" />
                            </div>
                            Áreas de Mejora
                          </h4>
                          <p className="text-slate-200 text-sm leading-relaxed bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                            {report.improvement}
                          </p>
                        </motion.div>
                        {report.nativePhrasing && (
                          <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.15 }}
                          >
                            <h4 className="text-blue-400 font-bold text-sm uppercase mb-2 flex items-center gap-2">
                              <div className="p-1.5 bg-blue-500/20 rounded-lg">
                                <Icon
                                  name="record_voice_over"
                                  className="text-sm"
                                />
                              </div>
                              Expresiones Nativas
                            </h4>
                            <p className="text-slate-200 text-sm leading-relaxed bg-slate-900/50 p-3 rounded-xl border border-slate-700/50 whitespace-pre-line">
                              {report.nativePhrasing}
                            </p>
                          </motion.div>
                        )}
                        {Array.isArray(report.vocabulary) &&
                          report.vocabulary.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.18 }}
                            >
                              <h4 className="text-purple-400 font-bold text-sm uppercase mb-2 flex items-center gap-2">
                                <div className="p-1.5 bg-purple-500/20 rounded-lg">
                                  <Icon name="menu_book" className="text-sm" />
                                </div>
                                Vocabulario Sugerido
                              </h4>
                              <ul className="list-disc list-inside text-slate-200 text-sm leading-relaxed bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                                {report.vocabulary.map((word, idx) => (
                                  <li key={idx}>{word}</li>
                                ))}
                              </ul>
                            </motion.div>
                          )}
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                          className="pt-4 mt-2 border-t border-slate-700/50"
                        >
                          <div className="flex items-start gap-3">
                            <div className="size-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                              <Icon
                                name="smart_toy"
                                className="text-white text-sm"
                              />
                            </div>
                            <p className="text-blue-200 text-sm italic mt-1">
                              "{report.feedback}"
                            </p>
                          </div>
                        </motion.div>
                      </motion.div>
                    ) : (
                      <p className="text-slate-400 text-sm italic">
                        "Great job today, {studentName}! Keep practicing every
                        day to improve your fluency." - Emma
                      </p>
                    )}
                  </div>
                </div>

                <div className="w-full pt-4 mt-auto shrink-0 border-t border-slate-800/50">
                  {isPromo ? (
                    <button
                      onClick={() => (window.location.href = "/register")}
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:opacity-90 transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(168,85,247,0.4)] flex items-center justify-center gap-2"
                    >
                      ¡Quiero mi tutor 24/7! Inscribirme
                      <Icon name="arrow_forward" />
                    </button>
                  ) : (
                    <button
                      onClick={onClose}
                      className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:opacity-90 transition-opacity shadow-lg"
                    >
                      Continuar
                    </button>
                  )}
                </div>
              </motion.div>
            ) : isCompleted ? (
              <motion.div
                className="relative z-10 flex flex-col items-center text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="size-24 bg-slate-800 rounded-full flex items-center justify-center mb-6 border-2 border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.2)]">
                  <Icon
                    name="check_circle"
                    className="text-5xl text-green-400"
                  />
                </div>
                <h3 className="text-2xl font-black text-white mb-2">
                  ¡Práctica completada!
                </h3>
                <p className="text-slate-400 mb-8">
                  Ya has completado tus 3 minutos diarios. ¡Vuelve mañana para
                  seguir practicando con Emma!
                </p>
                <button
                  onClick={onClose}
                  className="bg-slate-800 text-white px-8 py-3 rounded-full font-bold hover:bg-slate-700 transition-colors border border-slate-700"
                >
                  Volver al inicio
                </button>
              </motion.div>
            ) : !isActive && !isConnecting ? (
              <motion.div
                className="relative z-10 flex flex-col items-center text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Logo className="h-12 md:h-16 mb-4 drop-shadow-lg brightness-0 invert" />
                <div className="size-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-blue-500/20">
                  <Icon name="mic" className="text-4xl text-white" />
                </div>
                <h3 className="text-2xl font-black text-white mb-2">
                  ¿Estás listo/a?
                </h3>
                <p className="text-slate-300 mb-2">
                  {isPromo
                    ? "¡Habla con Emma durante 1 minuto y descubre tu nivel!"
                    : "¡Habla en inglés 3 minutos al día y aumenta tu confianza!"}
                </p>

                {!isPromo && timeLeft < TOTAL_SECONDS && (
                  <div className="bg-blue-500/20 border border-blue-500/30 text-blue-300 px-4 py-2 rounded-full text-sm mb-6 font-medium">
                    Tiempo restante hoy: {formatTime(timeLeft)}
                  </div>
                )}
                <div className="h-6"></div>

                <button
                  onClick={startChallenge}
                  className="bg-white text-slate-900 px-8 py-4 rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                >
                  {timeLeft < TOTAL_SECONDS
                    ? "Continuar hablando"
                    : "Hablar ahora"}
                </button>

                {connectionError && (
                  <div className="mt-4 bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl text-sm max-w-sm">
                    <p className="font-bold mb-1">Error de conexión:</p>
                    <p>{connectionError}</p>
                    {debugLogs.length > 0 && (
                      <div className="mt-2 text-xs opacity-70 font-mono">
                        {debugLogs[debugLogs.length - 1]}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ) : isConnecting ? (
              <div className="relative z-10 flex flex-col items-center text-center">
                <Icon
                  name="sync"
                  className="text-4xl text-blue-400 animate-spin mb-4"
                />
                <p className="text-slate-300 font-medium animate-pulse">
                  Conectando con Emma...
                </p>
              </div>
            ) : (
              <motion.div
                className="relative z-10 flex flex-col items-center w-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {/* Timer */}
                <div className="bg-slate-800/80 backdrop-blur-md border border-slate-600 px-8 py-3 rounded-full mb-10 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                  <span className="text-3xl font-mono font-black text-white tracking-wider">
                    {formatTime(timeLeft)}
                  </span>
                </div>

                {/* Orb Visualizer */}
                <div className="relative size-48 flex items-center justify-center mb-10">
                  {/* AI Speaking Waves */}
                  <motion.div
                    animate={{
                      scale: aiSpeaking ? [1, 1.3, 1] : 1,
                      opacity: aiSpeaking ? [0.6, 0.9, 0.6] : 0.2,
                    }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="absolute inset-0 bg-blue-500 rounded-full filter blur-2xl"
                  />
                  {/* User Speaking Waves */}
                  <motion.div
                    animate={{
                      scale: userSpeaking ? [1, 1.15, 1] : 1,
                    }}
                    transition={{ repeat: Infinity, duration: 0.5 }}
                    className="absolute inset-6 bg-purple-500 rounded-full filter blur-xl opacity-60"
                  />
                  {/* Core Orb */}
                  <div className="relative size-28 bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-600 rounded-full shadow-[0_0_40px_rgba(99,102,241,0.6)] border-2 border-white/30 flex items-center justify-center">
                    <Icon
                      name={aiSpeaking ? "graphic_eq" : "mic"}
                      className="text-white/80 text-4xl"
                    />
                  </div>
                </div>

                <div className="h-8 flex items-center justify-center">
                  <AnimatePresence mode="wait">
                    {aiSpeaking ? (
                      <motion.p
                        key="ai"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="text-blue-300 font-medium text-lg"
                      >
                        Emma está hablando...
                      </motion.p>
                    ) : userSpeaking ? (
                      <motion.p
                        key="user"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="text-purple-300 font-medium text-lg"
                      >
                        Escuchando...
                      </motion.p>
                    ) : (
                      <motion.p
                        key="idle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-slate-400"
                      >
                        ¡Habla libremente!
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  onClick={handleEarlyTermination}
                  className="mt-10 px-6 py-3 bg-red-500/10 text-red-400 border border-red-500/30 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-all hover:scale-105 shadow-lg gap-2 font-medium"
                >
                  <Icon name="stop_circle" className="text-xl" />
                  Terminar y ver reporte
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AISpeakingChallenge;
