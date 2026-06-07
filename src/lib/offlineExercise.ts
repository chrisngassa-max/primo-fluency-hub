import { supabase } from "@/integrations/supabase/client";

const DB_NAME = "captcf-offline";
const DB_VERSION = 1;
const DRAFT_STORE = "exercise-drafts";
const QUEUE_STORE = "submission-queue";

export type ExerciseDraft = {
  key: string;
  userId: string;
  devoirId: string;
  answers: Record<number, string>;
  audioBlob?: Blob | null;
  updatedAt: string;
};

export type PendingSubmission = {
  key: string;
  userId: string;
  devoirId: string;
  kind: "text" | "oral";
  answers: Record<number, string>;
  audioBlob?: Blob | null;
  createdAt: string;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DRAFT_STORE)) db.createObjectStore(DRAFT_STORE, { keyPath: "key" });
      if (!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const exerciseDraftKey = (userId: string, devoirId: string) => `${userId}:${devoirId}`;

export async function saveExerciseDraft(draft: ExerciseDraft) {
  const db = await openDatabase();
  await requestResult(db.transaction(DRAFT_STORE, "readwrite").objectStore(DRAFT_STORE).put(draft));
  db.close();
}

export async function loadExerciseDraft(key: string) {
  const db = await openDatabase();
  const draft = await requestResult<ExerciseDraft | undefined>(
    db.transaction(DRAFT_STORE, "readonly").objectStore(DRAFT_STORE).get(key),
  );
  db.close();
  return draft;
}

export async function deleteExerciseDraft(key: string) {
  const db = await openDatabase();
  await requestResult(db.transaction(DRAFT_STORE, "readwrite").objectStore(DRAFT_STORE).delete(key));
  db.close();
}

export async function queueSubmission(submission: PendingSubmission) {
  const db = await openDatabase();
  await requestResult(db.transaction(QUEUE_STORE, "readwrite").objectStore(QUEUE_STORE).put(submission));
  db.close();
}

async function listPendingSubmissions() {
  const db = await openDatabase();
  const rows = await requestResult<PendingSubmission[]>(
    db.transaction(QUEUE_STORE, "readonly").objectStore(QUEUE_STORE).getAll(),
  );
  db.close();
  return rows;
}

async function deletePendingSubmission(key: string) {
  const db = await openDatabase();
  await requestResult(db.transaction(QUEUE_STORE, "readwrite").objectStore(QUEUE_STORE).delete(key));
  db.close();
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function submitPending(item: PendingSubmission) {
  if (item.kind === "text") {
    const { data, error } = await supabase.functions.invoke("submit-devoir-result", {
      body: { devoir_id: item.devoirId, answers: item.answers },
    });
    if (error || !data) throw error ?? new Error("Soumission impossible");
    return;
  }

  if (!item.audioBlob) throw new Error("Enregistrement audio manquant");
  const path = `devoirs/${item.devoirId}/${item.userId}.wav`;
  const { error: uploadError } = await supabase.storage
    .from("test-audio")
    .upload(path, item.audioBlob, { contentType: "audio/wav", upsert: true });
  if (uploadError) throw uploadError;

  const audioBase64 = await blobToBase64(item.audioBlob);
  const { data: stt, error: sttError } = await supabase.functions.invoke("tcf-process-audio", {
    body: { action: "stt", audioBase64 },
  });
  if (sttError || !stt?.transcript) throw sttError ?? new Error("Transcription impossible");

  const { data, error } = await supabase.functions.invoke("submit-devoir-result", {
    body: {
      devoir_id: item.devoirId,
      answers: { 0: stt.transcript },
      transcription: stt.transcript,
      audio_path: path,
    },
  });
  if (error || !data) throw error ?? new Error("Soumission impossible");
}

export async function syncPendingSubmissions(userId?: string) {
  if (!navigator.onLine) return 0;
  const pending = (await listPendingSubmissions()).filter((item) => !userId || item.userId === userId);
  let synced = 0;

  for (const item of pending) {
    try {
      await submitPending(item);
      await deletePendingSubmission(item.key);
      await deleteExerciseDraft(item.key);
      synced += 1;
    } catch (error: any) {
      const message = String(error?.message ?? "").toLowerCase();
      if (message.includes("already") || message.includes("déjà") || message.includes("409")) {
        await deletePendingSubmission(item.key);
        await deleteExerciseDraft(item.key);
        synced += 1;
      }
    }
  }

  return synced;
}
