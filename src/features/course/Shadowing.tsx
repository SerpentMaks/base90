import { stopSpeech } from "../../lib/speech";
import { Rating, type Grade } from "../../lib/fsrs";
import { useEffect, useRef, useState } from "react";
import { SpeakButton } from "../../ui/SpeakButton";
import { btnPrimary, btnSecondary } from "../exercises/common";
export function Shadowing({
  en,
  ru,
  onDone,
}: {
  en: string;
  ru: string;
  onDone: (grade: Grade) => void;
}) {
  const [recording, setRecording] = useState(false),
    [url, setUrl] = useState(""),
    [error, setError] = useState("");
  const [requesting, setRequesting] = useState(false);
  const opening = useRef(false),
    stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    blobUrl = useRef(""),
    alive = useRef(true);
  const stop = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    if (stopTimer.current) clearTimeout(stopTimer.current);
  };
  useEffect(() => {
    alive.current = true;
    const hidden = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      alive.current = false;
      stopSpeech();
      stop();
      URL.revokeObjectURL(blobUrl.current);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  async function record() {
    if (opening.current) return;
    opening.current = true;
    setRequesting(true);
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw Error("no recorder");
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = s;
      const mime = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find(
        (t) => MediaRecorder.isTypeSupported(t),
      );
      const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      recorder.current = r;
      const chunks: BlobPart[] = [];
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onstop = () => {
        s.getTracks().forEach((t) => t.stop());
        if (!alive.current) return;
        if (stopTimer.current) clearTimeout(stopTimer.current);
        if (!chunks.length) {
          setRecording(false);
          setError(
            "Запись пуста. Повтори вслух или попробуй записать ещё раз.",
          );
          return;
        }
        URL.revokeObjectURL(blobUrl.current);
        blobUrl.current = URL.createObjectURL(
          new Blob(chunks, { type: r.mimeType }),
        );
        setUrl(blobUrl.current);
        setRecording(false);
      };
      r.onerror = () => {
        stop();
        setRecording(false);
        setError("Не получилось записать. Повтори фразу вслух без записи.");
      };
      r.start();
      setRecording(true);
      stopTimer.current = setTimeout(stop, 30000);
    } catch {
      stream.current?.getTracks().forEach((t) => t.stop());
      setError(
        "Микрофон недоступен. Послушай и повтори вслух — это тоже практика.",
      );
    } finally {
      opening.current = false;
      if (alive.current) setRequesting(false);
    }
  }
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-2xl font-bold">Повтори за голосом</h2>
      <SpeakButton text={en} />
      <p className="text-xl">{en}</p>
      <p className="text-muted">{ru}</p>
      <p>
        Послушай → повтори с той же интонацией → сравни свою запись с образцом.
      </p>
      <button
        className={btnSecondary}
        disabled={requesting}
        onClick={() => (recording ? stop() : void record())}
      >
        {requesting
          ? "Доступ к микрофону…"
          : recording
            ? "■ Закончить запись"
            : "● Записать себя"}
      </button>
      {url && (
        <audio controls src={url} className="w-full" aria-label="Твоя запись" />
      )}
      {error && (
        <p role="status" className="text-sm text-muted">
          {error}
        </p>
      )}
      <p className="text-sm text-muted">
        Оценка на слух: удалось ли повторить ударение и ритм? Запись остаётся на
        устройстве и удаляется при выходе.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          disabled={recording || requesting}
          className={btnSecondary}
          onClick={() => onDone(Rating.Again)}
        >
          Не получилось
        </button>
        <button
          disabled={recording || requesting}
          className={btnSecondary}
          onClick={() => onDone(Rating.Hard)}
        >
          С трудом
        </button>
      </div>
      <button
        disabled={recording || requesting}
        className={btnPrimary}
        onClick={() => onDone(Rating.Good)}
      >
        Повторил — дальше
      </button>
    </div>
  );
}
