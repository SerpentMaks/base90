# Источники и лицензии

## Частотные списки

NGSL 1.2 — Charles Browne, Brent Culligan, Joseph Phillips; NGSL-Spoken 1.2 — Charles Browne и Brent Culligan. [New General Service List Project](https://www.newgeneralservicelist.com/), [NGSL-Spoken](https://www.newgeneralservicelist.com/ngsl-spoken). Лицензия [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

Производный список Base90 использует сначала разговорный ранг NGSL-Spoken, затем общий NGSL без повторов. Удалены пометки расшифровки pause/unclear/laughter из разговорного списка, исправлены артефакты Excel и ошибочные формы. Добавлены авторские русские переводы, заметки, IPA и фразы. Словарь и авторские учебные материалы распространяются под CC BY-SA 4.0.

## Предложения Tatoeba

[Tatoeba](https://tatoeba.org/) — [CC BY 2.0 France](https://creativecommons.org/licenses/by/2.0/fr/). Источник пар английский↔русский: [ManyThings](https://www.manythings.org/anki/), `rus-eng.zip`.

Атрибуция каждого предложения и перевода сохранена непосредственно в `src/content/words.json`: `tatoebaId`, `author`, `ruTatoebaId`, `ruAuthor`. Полный список выбранных примеров доступен в приложении на экране «Источники и лицензии» и в `content-report.md`. Повторное использование этих примеров требует сохранения атрибуции. Пользовательские субтитры не являются открытым контентом курса и не публикуются в репозитории.

## Авторский контент

Русские переводы слов, заметки, чанки, грамматика, истории, диалоги, вопросы и примеры с `source: generated` подготовлены для Base90 и распространяются под CC BY-SA 4.0. Примеры Tatoeba сохраняют свою отдельную лицензию и атрибуцию.

Транскрипции первых 200 слов подготовлены вручную. Остальные после первоначальной генерации сверены с американским словарём [ipa-dict](https://github.com/open-dict-data/ipa-dict), автор dohliam, на основе cmudict-ipa (lingz). Выбраны формы для основного значения слова; обозначения r/l приведены к единому широкому варианту. Обе лицензии MIT сохранены в `licenses/ipa-dict-MIT.txt` и `licenses/cmudict-ipa-MIT.txt` и на экране источников. IPA фраз вычислена eSpeak NG en-US через `phonemizer`. eSpeak NG и его WASM-инструменты используются только при подготовке и не включены в приложение. Транскрипции служат подсказкой; слушай запись американского произношения.

## Озвучка

[Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (hexgrad), модель Apache 2.0; ONNX-конверсия [onnx-community](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX). Генерация через `kokoro-js` (Apache 2.0), голос `af_heart`. Модель, фонемизатор и ffmpeg не входят в веб-приложение. Записи произведены из открытого/авторского контента. Пользовательская запись голоса существует только на его устройстве в текущем упражнении.

Зависимости приложения сохраняют собственные лицензии: React (MIT), Dexie (Apache 2.0), ts-fsrs (MIT), Workbox (MIT), zod (MIT), Tailwind CSS (MIT). Внешние шрифты, аналитика и трекеры не используются.
