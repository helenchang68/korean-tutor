"use client";

import { useState, useRef } from "react";

const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

type Message = {
  role: "user" | "assistant";
  content: string;
  correction?: string | null;
  natural?: string | null;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function startRecording() {
    // 在使用者觸碰當下解鎖音訊（iOS Safari 需要）
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    audioRef.current.src = SILENT_WAV;
    audioRef.current.play().catch(() => {});
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
      await handleAudio(audioBlob);
    };

    mediaRecorder.start();
    setIsRecording(true);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  async function handleAudio(audioBlob: Blob) {
    setIsProcessing(true);
    try {
      // 1. 語音轉文字
      console.time("transcribe");
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      const transcribeRes = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      const { text } = await transcribeRes.json();
      console.timeEnd("transcribe");

      const newMessages: Message[] = [
        ...messages,
        { role: "user", content: text },
      ];
      setMessages(newMessages);

      // 2. 取得 AI 回覆（只把 role 和 content 送給 API）
      console.time("chat");
      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      const { correction, natural, reply } = await chatRes.json();
      console.timeEnd("chat");

      // 把修正資訊掛在「你說的那句話」上面
      const updatedMessages: Message[] = [...newMessages];
      updatedMessages[updatedMessages.length - 1] = {
        ...updatedMessages[updatedMessages.length - 1],
        correction,
        natural,
      };
      updatedMessages.push({ role: "assistant", content: reply });
      setMessages(updatedMessages);

      // 3. 只把對話回覆變成語音播放（修正的部分不唸）
      console.time("speak");
      const speakRes = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: reply }),
      });
      const audioData = await speakRes.blob();
      console.timeEnd("speak");

      const audioUrl = URL.createObjectURL(audioData);
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        try {
          await audioRef.current.play();
        } catch (err) {
          console.error(err);
        }
      }
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <main style={{ maxWidth: 600, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>한국어 회화 연습 🇰🇷</h1>

      <div style={{ marginBottom: 24, minHeight: 300 }}>
        {messages.length === 0 && (
          <p style={{ color: "#888" }}>按下按鈕開始說韓語吧！</p>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                background: m.role === "user" ? "#e3f2fd" : "#f5f5f5",
                whiteSpace: "pre-wrap",
              }}
            >
              <strong>{m.role === "user" ? "나" : "선생님"}</strong>
              <div>{m.content}</div>
            </div>

            {(m.correction || m.natural) && (
              <div
                style={{
                  padding: 12,
                  marginTop: 4,
                  borderRadius: 12,
                  background: "#fff8e1",
                  border: "1px solid #ffe082",
                  fontSize: 14,
                }}
              >
                {m.correction && (
                  <div style={{ marginBottom: m.natural ? 8 : 0 }}>
                    <strong>📝 수정</strong>
                    <div>{m.correction}</div>
                  </div>
                )}
                {m.natural && (
                  <div>
                    <strong>💬 이렇게 말하면 더 자연스러워요</strong>
                    <div>{m.natural}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {isProcessing && <p style={{ color: "#888" }}>처리 중...</p>}
      </div>

      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        style={{
          width: "100%",
          padding: 16,
          fontSize: 18,
          borderRadius: 12,
          border: "none",
          cursor: "pointer",
          background: isRecording ? "#ef5350" : "#1976d2",
          color: "white",
        }}
      >
        {isRecording ? "⏹ 說完了，送出" : "🎤 按下開始說話"}
      </button>
    </main>
  );
}