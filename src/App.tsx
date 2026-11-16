import { useEffect, useState } from 'react';
import { TodayScreen } from './features/today/TodayScreen';
import { UpdateBanner } from './ui/UpdateBanner';

/** Навигация через hash (#/today): GitHub Pages не отдаёт 404 на «глубокие» ссылки. */
function useHashRoute(): string {
  const read = () => window.location.hash.replace(/^#\/?/, '') || 'today';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function App() {
  const route = useHashRoute();
  let screen;
  switch (route) {
    case 'today':
    default:
      screen = <TodayScreen />;
  }
  return (
    <>
      {screen}
      <UpdateBanner />
    </>
  );
}
