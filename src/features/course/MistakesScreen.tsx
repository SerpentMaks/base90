import { useEffect, useState } from "react";
import { db } from "../../db/db";
import { repo } from "../../db/repo";
import { buildSession, taskForCard } from "../../lib/session";
import { studyDate } from "../../lib/time";
import { navigate } from "../../lib/nav";
import { unlockAudio } from "../../lib/audio";
import { Page } from "../../ui/Page";
import { btnPrimary } from "../exercises/common";
export function MistakesScreen() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    void db.reviewLogs
      .orderBy("reviewedAt")
      .reverse()
      .filter((l) => l.rating === 1)
      .limit(50)
      .toArray()
      .then((rows) => setCount(new Set(rows.map((r) => r.cardId)).size));
  }, []);
  async function start() {
    const logs = await db.reviewLogs
      .orderBy("reviewedAt")
      .reverse()
      .filter((l) => l.rating === 1)
      .limit(50)
      .toArray();
    const cards = await db.cards.bulkGet([
      ...new Set(logs.map((l) => l.cardId)),
    ]);
    const s = buildSession({
      cards: [],
      wordOrder: [],
      now: Date.now(),
      newLimit: 0,
      studyDate: studyDate(),
    });
    s.queue = cards
      .filter((c) => c && !c.suspended)
      .map((c) => taskForCard(c!));
    await repo().saveSession(s);
    navigate("#/session");
  }
  return (
    <Page title="Ошибочник">
      <p>
        Повторим карточки из последних 50 ошибок. Это сигналы памяти о том, что
        стоит укрепить.
      </p>
      <p>Карточек: {count}</p>
      <button
        disabled={!count}
        className={btnPrimary}
        onClick={() => {
          unlockAudio();
          void start();
        }}
      >
        Начать
      </button>
    </Page>
  );
}
