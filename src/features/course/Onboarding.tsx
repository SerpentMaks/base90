import { useState } from "react";
import { db } from "../../db/db";
import { Page, panel } from "../../ui/Page";
import { InstallHint } from "../../ui/InstallHint";
import { SoundCheck } from "../../ui/SoundCheck";
import { btnPrimary } from "../exercises/common";
import { navigate } from "../../lib/nav";
export function Onboarding() {
  const [step, setStep] = useState(0);
  const titles = [
    "Небольшие шаги каждый день",
    "Сначала слушай, потом вспоминай",
    "Приложение под рукой",
  ];
  return (
    <Page title="Добро пожаловать в Base90">
      <p className="text-sm text-muted">{step + 1} / 3</p>
      <h2 className="text-3xl font-bold">{titles[step]}</h2>
      {step === 0 ? (
        <div className={panel}>
          <p>
            Начни с 20 минут. Через каждые три выполненных учебных дня план
            растёт на 10 минут, до 90. Его можно разбить на короткие подходы и
            изменить в настройках.
          </p>
          <p className="mt-3">
            Ошибки — нормальная часть обучения. Приложение вернёт слово, когда
            его полезно повторить.
          </p>
        </div>
      ) : step === 1 ? (
        <>
          <p>
            Сначала попытайся понять звук или вспомнить ответ. Затем проверь
            себя. Ответы сохраняются сразу — занятие можно прервать.
          </p>
          <SoundCheck />
        </>
      ) : (
        <>
          <InstallHint />
          <p>
            Прогресс живёт на устройстве. Делай экспорт в настройках или
            подключи Gist, чтобы защититься от очистки данных телефона.
          </p>
        </>
      )}
      <button
        className={btnPrimary}
        onClick={() =>
          void (async () => {
            if (step < 2) setStep(step + 1);
            else {
              await db.progress.put({
                key: "onboarded",
                value: true,
                updatedAt: Date.now(),
              });
              navigate("#/placement");
            }
          })()
        }
      >
        {step < 2 ? "Дальше" : "Отметить знакомые слова"}
      </button>
      {step === 2 && (
        <a
          className="min-h-12 grid place-items-center text-accent"
          href="#/practice/sounds"
        >
          Начать со звуков
        </a>
      )}
    </Page>
  );
}
