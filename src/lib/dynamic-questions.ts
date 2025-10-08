import Papa from "papaparse";
import type { QuestionItem } from "./types";
import { getLocalStorage, setLocalStorage } from "./storage";

const LS_PRE_QUEST = "questions.pre.csv.v1";
const LS_MAIN_QUEST = "questions.main.csv.v1";
const LS_PRE_META = "questions.pre.meta.v1";
const LS_MAIN_META = "questions.main.meta.v1";

export type QuestionsMeta = {
  filename: string;
  updatedAt: number; // epoch ms
  count: number;
  type: "pre" | "main";
};

export type CsvConfig = {
  // required header names the file must include
  idColumn: string; // e.g., "q_id"
  textColumn: string; // e.g., "text_ko"
  optionsColumn?: string; // e.g., "options" comma or pipe separated
};

export function getPreQuestionsFromStorage(fallback: QuestionItem[]): QuestionItem[] {
  return getLocalStorage<QuestionItem[]>(LS_PRE_QUEST, fallback);
}

export function getMainQuestionsFromStorage(fallback: QuestionItem[]): QuestionItem[] {
  return getLocalStorage<QuestionItem[]>(LS_MAIN_QUEST, fallback);
}

export function getQuestionsMeta(type: "pre" | "main"): QuestionsMeta | null {
  const key = type === "pre" ? LS_PRE_META : LS_MAIN_META;
  return getLocalStorage<QuestionsMeta | null>(key, null);
}

export async function parseQuestionsCsv(file: File, cfg: CsvConfig): Promise<QuestionItem[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        try {
          const rows = res.data as Record<string, string>[];
          const items: QuestionItem[] = rows
            .filter((r) => r[cfg.idColumn] && r[cfg.textColumn])
            .map((r) => ({
              id: String(r[cfg.idColumn]),
              text: String(r[cfg.textColumn]),
              options: cfg.optionsColumn && r[cfg.optionsColumn]
                ? String(r[cfg.optionsColumn])
                    .split(/[|,\/]/)
                    .map((s) => s.trim())
                    .filter(Boolean)
                : undefined,
            }));
          resolve(items);
        } catch (e) {
          reject(e);
        }
      },
      error: (err) => reject(err),
    });
  });
}

export function savePreQuestions(items: QuestionItem[]) {
  setLocalStorage(LS_PRE_QUEST, items);
}

export function saveMainQuestions(items: QuestionItem[]) {
  setLocalStorage(LS_MAIN_QUEST, items);
}

export function saveQuestionsMeta(type: "pre" | "main", meta: QuestionsMeta) {
  const key = type === "pre" ? LS_PRE_META : LS_MAIN_META;
  setLocalStorage(key, meta);
}


