import ipaLicense from "../../../licenses/ipa-dict-MIT.txt?raw";
import cmuLicense from "../../../licenses/cmudict-ipa-MIT.txt?raw";
import { Page, panel } from "../../ui/Page";
import { WORDS } from "../../content";
export function SourcesScreen() {
  const authors = [
    ...new Set(
      WORDS.flatMap((w) =>
        w.examples
          .filter((e) => e.source === "tatoeba")
          .flatMap((e) => [e.author!, e.ruAuthor!]),
      ),
    ),
  ].sort();
  return (
    <Page title="Источники и лицензии">
      <section className={panel}>
        <h2 className="font-semibold">Частотные списки NGSL</h2>
        <p>
          NGSL 1.2 и NGSL-Spoken 1.2 · Charles Browne, Brent Culligan, Joseph
          Phillips. Производный словарь: CC BY-SA 4.0.
        </p>
        <a
          className="text-accent underline min-h-12 flex items-center"
          href="https://www.newgeneralservicelist.com/our-wordlists-1"
        >
          NGSL Project
        </a>
      </section>
      <section className={panel}>
        <h2 className="font-semibold">Примеры Tatoeba</h2>
        <p>
          CC BY 2.0 France. Данные получены через ManyThings. Атрибуция каждой
          выбранной пары:
        </p>
        {WORDS.flatMap((w) =>
          w.examples.filter((e) => e.source === "tatoeba"),
        ).map((e, i) => (
          <p className="text-xs my-2" key={i}>
            <a
              className="text-accent underline"
              href={`https://tatoeba.org/en/sentences/show/${e.tatoebaId}`}
            >
              #{e.tatoebaId}
            </a>{" "}
            {e.author} →{" "}
            <a
              className="text-accent underline"
              href={`https://tatoeba.org/en/sentences/show/${e.ruTatoebaId}`}
            >
              #{e.ruTatoebaId}
            </a>{" "}
            {e.ruAuthor}
          </p>
        ))}
        <details>
          <summary>Авторы ({authors.length})</summary>
          <p className="text-xs">{authors.join(", ")}</p>
        </details>
      </section>
      <section className={panel}>
        <h2 className="font-semibold">Авторский контент и озвучка</h2>
        <p>
          Переводы, грамматика, истории, диалоги и разговорные фразы Base90 — CC
          BY-SA 4.0. Записи: Kokoro-82M, голос Heart; модель Apache 2.0.
          Транскрипции первых 200 слов проверены вручную, остальные сверены с
          ipa-dict en_US (MIT) с выбором основного значения. Транскрипция фраз —
          eSpeak NG.
        </p>
      </section>
      <details className={panel}>
        <summary>Лицензии американской IPA</summary>
        <p className="my-3 text-sm">
          ipa-dict — dohliam; cmudict-ipa — lingz. В американских словарях
          встречаются варианты записи одной гласной, например /i/ и /iː/.
          Главный образец произношения — аудио.
        </p>
        <pre className="whitespace-pre-wrap break-words text-xs">
          {ipaLicense}
          {"\n"}
          {cmuLicense}
        </pre>
      </details>
      <p className="text-sm text-muted">
        Base90 не собирает аналитику. Аудиозапись микрофона и субтитры
        обрабатываются на устройстве. При подключении Gist прогресс и подписки
        на уведомления передаются в твой GitHub Gist.
      </p>
    </Page>
  );
}
