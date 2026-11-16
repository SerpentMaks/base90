import { useEffect, useState, lazy, Suspense } from "react";
import { navigate } from "./lib/nav";
import { UpdateBanner } from "./ui/UpdateBanner";
import { trackActivity, ensureDay } from "./lib/study";
import { startAutoSync } from "./lib/sync";
import { renewPush } from "./lib/push";
import { db } from "./db/db";
const SessionScreen = lazy(() =>
  import("./features/session/SessionScreen").then((m) => ({
    default: m.SessionScreen,
  })),
);
const SettingsScreen = lazy(() =>
  import("./features/settings/SettingsScreen").then((m) => ({
    default: m.SettingsScreen,
  })),
);
const TodayScreen = lazy(() =>
  import("./features/today/TodayScreen").then((m) => ({
    default: m.TodayScreen,
  })),
);
const CourseScreen = lazy(() =>
  import("./features/course/CourseScreen").then((m) => ({
    default: m.CourseScreen,
  })),
);
const LessonScreen = lazy(() =>
  import("./features/course/CourseScreen").then((m) => ({
    default: m.LessonScreen,
  })),
);
const PracticeScreen = lazy(() =>
  import("./features/course/CourseScreen").then((m) => ({
    default: m.PracticeScreen,
  })),
);
const ReaderScreen = lazy(() =>
  import("./features/course/ReaderScreen").then((m) => ({
    default: m.ReaderScreen,
  })),
);
const LibraryScreen = lazy(() =>
  import("./features/library/LibraryScreen").then((m) => ({
    default: m.LibraryScreen,
  })),
);
const FilmScreen = lazy(() =>
  import("./features/library/FilmScreen").then((m) => ({
    default: m.FilmScreen,
  })),
);
const StatsScreen = lazy(() =>
  import("./features/stats/StatsScreen").then((m) => ({
    default: m.StatsScreen,
  })),
);
const TestScreen = lazy(() =>
  import("./features/course/TestScreen").then((m) => ({
    default: m.TestScreen,
  })),
);
const Onboarding = lazy(() =>
  import("./features/course/Onboarding").then((m) => ({
    default: m.Onboarding,
  })),
);
const SourcesScreen = lazy(() =>
  import("./features/course/SourcesScreen").then((m) => ({
    default: m.SourcesScreen,
  })),
);
const MistakesScreen = lazy(() =>
  import("./features/course/MistakesScreen").then((m) => ({
    default: m.MistakesScreen,
  })),
);
/** Навигация через hash (#/today): GitHub Pages не отдаёт 404 на «глубокие» ссылки. */
function useHashRoute(): { route: string; visit: number } {
  const read = () => window.location.hash.replace(/^#\/?/, "") || "today";
  const [state, setState] = useState(() => ({ route: read(), visit: 0 }));
  useEffect(() => {
    const on = () => setState((s) => ({ route: read(), visit: s.visit + 1 }));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return state;
}

const goToday = () => navigate("#/today");

export function App() {
  const { route, visit } = useHashRoute();
  useEffect(() => {
    const stop = trackActivity(),
      stopSync = startAutoSync();
    void ensureDay().catch(() => {});
    void renewPush().catch(async () => {
      await db.progress.put({
        key: "private:pushError",
        value: "Уведомления нужно подключить заново в настройках.",
        updatedAt: Date.now(),
      });
    });
    void Promise.all([db.progress.get("onboarded"), db.cards.count()]).then(
      ([row, count]) => {
        if (!row && !count && (!location.hash || location.hash === "#/today"))
          navigate("#/onboarding");
      },
    );
    return () => {
      stop();
      stopSync();
    };
  }, []);
  let screen;
  switch (route) {
    case "session":
    case "session/new":
      screen = (
        <SessionScreen
          key={`${route}#${visit}`}
          fresh={route === "session/new"}
          onExit={goToday}
        />
      );
      break;
    case "settings":
      screen = <SettingsScreen />;
      break;
    case "course":
      screen = <CourseScreen />;
      break;
    case "library":
      screen = <LibraryScreen />;
      break;
    case "placement":
      screen = <LibraryScreen placement />;
      break;
    case "film":
      screen = <FilmScreen />;
      break;
    case "stats":
      screen = <StatsScreen />;
      break;
    case "onboarding":
      screen = <Onboarding />;
      break;
    case "sources":
      screen = <SourcesScreen />;
      break;
    case "mistakes":
      screen = <MistakesScreen />;
      break;
    default:
      screen = route.startsWith("lesson/") ? (
        <LessonScreen id={route.split("/")[1]!} />
      ) : route.startsWith("practice/") ? (
        <PracticeScreen key={route} id={route.split("/")[1]!} />
      ) : route.startsWith("reader/") ? (
        <ReaderScreen key={route} id={route.split("/")[1]!} />
      ) : route.startsWith("test/") ? (
        <TestScreen key={route} day={Number(route.split("/")[1]) || 28} />
      ) : (
        <TodayScreen key={route} />
      );
  }
  // Во время упражнения плашку обновления не показываем — не отвлекаем.
  return (
    <>
      <Suspense
        fallback={
          <main className="mx-auto max-w-md p-6 text-muted" role="status">
            Загрузка Base90…
          </main>
        }
      >
        {screen}
      </Suspense>
      <UpdateBanner
        hidden={/^(session|practice|reader|test)(\/|$)/.test(route)}
      />
      {!/^(session|practice|reader|test|onboarding)/.test(route) && (
        <nav
          aria-label="Основная навигация"
          className="fixed bottom-0 left-0 right-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
        >
          <div className="mx-auto max-w-md grid grid-cols-4">
            {[
              ["today", "Сегодня"],
              ["course", "Уроки"],
              ["library", "Словарь"],
              ["stats", "Прогресс"],
            ].map(([path, title]) => (
              <a
                key={path}
                className={`min-h-14 grid place-items-center text-sm ${route === path ? "font-bold text-accent" : "text-muted"}`}
                href={`#/${path}`}
              >
                {title}
              </a>
            ))}
          </div>
        </nav>
      )}
    </>
  );
}
