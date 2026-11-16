import { useEffect, useState } from 'react';
import { SessionScreen } from './features/session/SessionScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { TodayScreen } from './features/today/TodayScreen';
import { navigate } from './lib/nav';
import { UpdateBanner } from './ui/UpdateBanner';

/** Навигация через hash (#/today): GitHub Pages не отдаёт 404 на «глубокие» ссылки. */
function useHashRoute(): { route: string; visit: number } {
  const read = () => window.location.hash.replace(/^#\/?/, '') || 'today';
  const [state, setState] = useState(() => ({ route: read(), visit: 0 }));
  useEffect(() => {
    const on = () => setState((s) => ({ route: read(), visit: s.visit + 1 }));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return state;
}

const goToday = () => navigate('#/today');

export function App() {
  const { route, visit } = useHashRoute();
  let screen;
  switch (route) {
    case 'session':
    case 'session/new':
      screen = <SessionScreen key={`${route}#${visit}`} fresh={route === 'session/new'} onExit={goToday} />;
      break;
    case 'settings':
      screen = <SettingsScreen />;
      break;
    default:
      screen = <TodayScreen key={route} />;
  }
  // Во время упражнения плашку обновления не показываем — не отвлекаем.
  return (
    <>
      {screen}
      {!route.startsWith('session') && <UpdateBanner />}
    </>
  );
}
