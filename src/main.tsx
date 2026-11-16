import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { requestPersistentStorage } from "./lib/platform";
import { loadSettings } from "./lib/settings";
import { initTts } from "./lib/tts";
import { db } from "./db/db";
import { loadPersonalWords } from "./lib/personalWords";
import "./index.css";

void requestPersistentStorage();
initTts();

await loadSettings();
await loadPersonalWords();
if (
  (!location.hash || location.hash === "#/today") &&
  !(await db.progress.get("onboarded")) &&
  !(await db.cards.count())
)
  history.replaceState(null, "", "#/onboarding");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
