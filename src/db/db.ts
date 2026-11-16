/**
 * Локальная база (IndexedDB через Dexie). Миграции — только добавлением новых
 * версий db.version(N); старые версии не удалять, данные пользователя не теряются.
 */
import Dexie, { type EntityTable } from "dexie";
import type { FsrsCard } from "../lib/fsrs";

export type CardKind =
  | "listen"
  | "produce"
  | "cloze"
  | "grammar"
  | "pair"
  | "speech"
  | "dictation"
  | "shadow";

export interface CardRow {
  id: string; // `${kind}:${itemId}`
  itemId: string;
  kind: CardKind;
  fsrs: FsrsCard;
  /** Время следующего показа, мс (копия fsrs.dueAt для индекса). */
  due: number;
  /** Карточку нельзя показывать раньше (например, «перевод → англ.» через день после узнавания). */
  availableAt: number;
  createdAt: number;
  updatedAt: number;
  suspended?: 0 | 1;
}

export interface ReviewLogRow {
  id: string;
  cardId: string;
  itemId: string;
  kind: CardKind;
  rating: number;
  /** Состояние карточки ДО ответа (0 new, 1 learning, 2 review, 3 relearning). */
  stateBefore: number;
  reviewedAt: number;
  studyDate: string;
  elapsedMs: number;
  exerciseType: string;
}

export interface DayRow {
  date: string; // YYYY-MM-DD, учебные сутки по Москве (граница 04:00)
  plannedMin: number;
  activeMin: number;
  counted: 0 | 1;
  newIntroduced: number;
  reviewsDone: number;
  updatedAt: number;
}

export interface KvRow {
  key: string;
  value: unknown;
  updatedAt: number;
}

export class Base90DB extends Dexie {
  cards!: EntityTable<CardRow, "id">;
  reviewLogs!: EntityTable<ReviewLogRow, "id">;
  days!: EntityTable<DayRow, "date">;
  progress!: EntityTable<KvRow, "key">;
  settings!: EntityTable<KvRow, "key">;

  constructor(name = "base90") {
    super(name);
    this.version(1).stores({
      cards: "id, itemId, kind, due, availableAt",
      reviewLogs: "id, cardId, reviewedAt, studyDate",
      days: "date",
      progress: "key",
      settings: "key",
    });
  }
}

export const db = new Base90DB();

export function cardId(kind: CardKind, itemId: string): string {
  return `${kind}:${itemId}`;
}

export function uuid(): string {
  return crypto.randomUUID();
}
