import { useState } from "react";
import { WORDS } from "../../content";
import forms from "../../content/forms.json";
import { Lemmatizer } from "../../lib/lemmatize";
import { parseSubtitles, subtitleCoverage } from "../../lib/subtitles";
import { repo } from "../../db/repo";
import { Page, panel } from "../../ui/Page";
import { addPersonalWord } from "../../lib/personalWords";
const L = new Lemmatizer(forms);
export function FilmScreen() {
  const [result, setResult] = useState<ReturnType<
      typeof subtitleCoverage
    > | null>(null),
    [error, setError] = useState(""),
    [added, setAdded] = useState(new Set<string>());
  const [translations, setTranslations] = useState<Record<string, string>>({});
  async function load(f: File) {
    try {
      if (f.size > 5_000_000) throw Error("Выбери файл меньше 5 МБ");
      const cues = parseSubtitles(await f.text());
      if (!cues.length) throw Error("Не найдены реплики SRT или VTT");
      const known = new Set(
        (await repo().allCards())
          .filter((c) => c.kind === "listen" && c.fsrs.stability >= 7)
          .map((c) => WORDS.find((w) => w.id === c.itemId)?.lemma.toLowerCase())
          .filter((x): x is string => !!x),
      );
      const coverage = subtitleCoverage(cues, known, L);
      if (!coverage.total)
        throw new Error(
          "В файле не найдены английские слова. Выбери английские субтитры.",
        );
      setResult(coverage);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось прочитать файл");
    }
  }
  return (
    <Page title="Мост к фильмам">
      <p>
        Выбери свои английские субтитры. Файл обрабатывается на этом устройстве
        и никуда не отправляется.
      </p>
      <p className="text-sm text-muted">
        Добавленные тобой слова и выбранные реплики войдут в бэкап и
        подключённую синхронизацию. Для личных слов используется системный
        голос; английский голос можно скачать в настройках iPhone.
      </p>
      <label className={panel}>
        Файл .srt или .vtt
        <input
          className="mt-3 block w-full"
          type="file"
          accept=".srt,.vtt"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void load(f);
          }}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      {result && (
        <>
          <h2 className="text-2xl font-bold">
            Знакомо {Math.round(result.coverage * 100)}% слов
          </h2>
          <p className="text-sm text-muted">
            Из {result.total} словоупотреблений. Знакомые — карточки с
            устойчивостью памяти от 7 дней. Это словарное покрытие, а не оценка
            понимания сюжета.
          </p>
          {result.unknown.slice(0, 100).map((x) => {
            const w = WORDS.find((w) => w.lemma.toLowerCase() === x.lemma);
            return (
              <div key={x.lemma} className={panel}>
                <b>{x.lemma}</b> · {x.count}
                <p className="text-sm text-muted">
                  {x.cue.time} · {x.cue.text}
                </p>
                {w ? (
                  <>
                    <p>{w.ru.join("; ")}</p>
                    <button
                      className="text-accent min-h-12"
                      disabled={added.has(w.id)}
                      onClick={() =>
                        void repo()
                          .introduce(w.id)
                          .then(() => setAdded(new Set([...added, w.id])))
                      }
                    >
                      {added.has(w.id) ? "Добавлено" : "Добавить в повторения"}
                    </button>
                  </>
                ) : (
                  <div className="mt-2">
                    <label className="text-sm">
                      Твой перевод
                      <input
                        aria-label={`Перевод ${x.lemma}`}
                        value={translations[x.lemma] ?? ""}
                        onChange={(e) =>
                          setTranslations({
                            ...translations,
                            [x.lemma]: e.target.value,
                          })
                        }
                        maxLength={100}
                        className="min-h-12 w-full border border-line rounded-xl bg-bg px-3 mt-1"
                      />
                    </label>
                    <button
                      className="min-h-12 text-accent disabled:opacity-40"
                      disabled={!translations[x.lemma]?.trim()}
                      onClick={() =>
                        void addPersonalWord(
                          x.lemma,
                          translations[x.lemma]!,
                          x.cue.text,
                          x.cue.time,
                        )
                          .then(async (item) => {
                            await repo().introduce(item.id);
                            setAdded(new Set([...added, item.id]));
                          })
                          .catch((e) =>
                            setError(
                              e instanceof Error
                                ? e.message
                                : "Не удалось сохранить слово",
                            ),
                          )
                      }
                    >
                      Добавить своё слово
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
      <p className="text-sm text-muted">
        Начни с коротких сцен и английских субтитров. Посмотри сцену, повтори
        знакомую реплику, затем пересмотри без текста.
      </p>
    </Page>
  );
}
