import { useCallback, useRef, useState } from "react";

// Records one complete audio clip from the microphone.
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const resolver = useRef<((b: Blob) => void) | null>(null);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunks.current = [];
    rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const type = (rec.mimeType || "audio/webm").replace(/^video\//, "audio/");
      resolver.current?.(new Blob(chunks.current, { type }));
    };
    rec.start(250); // emit chunks regularly so short clips aren't empty
    recRef.current = rec;
    setRecording(true);
  }, []);

  const stop = useCallback(
    () =>
      new Promise<Blob>((resolve) => {
        resolver.current = resolve;
        recRef.current?.stop();
        setRecording(false);
      }),
    [],
  );

  return { recording, start, stop };
}
