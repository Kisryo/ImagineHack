"use client";

import { useEffect, useRef, useState } from "react";

type SR = any;

export function VoiceNoteInput({ name, defaultValue = "" }: { name: string; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState(true);
  const recRef = useRef<SR | null>(null);

  useEffect(() => {
    const w = window as any;
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognition) { setSupported(false); return; }
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-MY";
    rec.onresult = (e: any) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i][0].transcript;
      setValue((prev) => (prev ? prev + " " : "") + text);
    };
    rec.onend = () => setRecording(false);
    recRef.current = rec;
  }, []);

  function toggle() {
    if (!recRef.current) return;
    if (recording) recRef.current.stop();
    else { recRef.current.start(); setRecording(true); }
  }

  return (
    <div className="space-y-2">
      <textarea
        name={name}
        rows={8}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Met Mr Wong over coffee. He lit up when we touched on insurance for his daughter, but shut down again when I mentioned estate planning — still sore about the 2022 trust recommendation..."
        className="w-full border rounded-lg px-3 py-2 text-sm"
      />
      {supported ? (
        <button
          type="button"
          onClick={toggle}
          className={`text-sm px-3 py-1.5 rounded-lg border ${recording ? "bg-red-500 text-white border-red-500" : "bg-white"}`}
        >
          {recording ? "● Stop recording" : "🎙 Voice capture"}
        </button>
      ) : (
        <div className="text-xs opacity-60">Voice capture not supported in this browser.</div>
      )}
    </div>
  );
}
