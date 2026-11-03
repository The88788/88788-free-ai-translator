# Technical notes

The signed v0.4.1 XPI is available in GitHub Releases. Instructions about unsigned ZIPs below apply to development source archives. Run test commands from the repository root.

# 88788 Free AI Translator v0.4.1

Firefox sidebar translation extension. Free, open-source, ad-free, no subscription, and no tracking. **Bring your own compatible API**. FreeLLMAPI is recommended because it can route requests between multiple providers, but it is not required.

Author: **88788** · https://the88788.com/

## Features

- Translate selected text between 75 languages, including Chinese (Simplified and Traditional), English, Russian and Kazakh.
- Russian and English interface; automatic browser-language selection or manual override.
- Set any suitable OpenAI-style **Chat Completions** API base URL, API key and **model/route**.
- Select, swap and autodetect source/target languages; sidebar or selection context menu.
- Retry temporary upstream errors (408, 429, 5xx, timeouts, empty responses) up to three times; 4xx authentication/configuration errors are not retried.
- Cache the 200 most recent successful translations for up to 30 days in Firefox local storage. Expired records are automatically removed at startup and daily. Cache keys are SHA-256 hashes and include text, language pair, endpoint, account/key and model/route, so APIs don't share cached results.
- Show the actual model **and the provider that handled the request** under the translation when the API discloses them. FreeLLMAPI uses `X-Routed-Via: <provider>/<model>` (e.g. `google/gemini-2.5-flash` or `openrouter/qwen/qwen3-*`); this takes precedence over generic response fields. Unknown provider names are never guessed.
- Cache both model and provider alongside the translated text. Existing cached entries from earlier versions remain usable and display an unknown provider until a fresh translation is requested.
- **Another translation** bypasses the cache. The button is visible **only when API type = FreeLLMAPI**. For pooled `auto:*` routes, it attempts to obtain a different reported model (best effort; server-side exclusion is not implemented). On other API types the button is hidden. On a FreeLLMAPI fixed-model route it can only request a new variant, not change models.
- No auto-upload of selected text. Only the user-triggered Translate/Another translation action sends a request. Credentials and translations stay inside Firefox storage, but API requests are necessarily sent to your chosen server/provider.

## Configure

1. Open the sidebar (or right-click selected text and choose **Translate selection**).
2. Click the ⚙ gear.
3. Choose **Interface language** (Firefox / Русский / English).
4. Select **API type** (FreeLLMAPI or another compatible API). Then enter the **API base URL**, not necessarily ending in `/v1`. The extension appends `/chat/completions` automatically.
5. Enter an API key if the server requires one; leave blank for a local API without authentication.
6. Enter an API **model or route**: `auto:default` for the default FreeLLMAPI pool (or your custom `auto:light`), or a provider's model ID for direct providers.
7. Press **Save settings**. Firefox asks you to authorize access to the specified API host. If rejected, the extension can't reach it.
8. Select some text on a website, then click Translate in the sidebar.

New installations start with an **empty API URL**, so this public extension does not connect to the developer's personal gateway by default. If you upgrade from v0.2 without removing its Firefox storage, your existing endpoint and key will be preserved.

Provider analytics: the extension reads `X-Routed-Via` if the API supplies it, then looks for explicit provider fields/headers (including `X-Provider` and `metadata.provider`). It does not infer the upstream vendor from model names. Some generic OpenAI-style APIs do not expose a provider, so the interface displays "Provider: not reported by API". In Firefox, if a reverse proxy strips the routing header, configure that proxy to preserve `X-Routed-Via`.

The extension currently supports **non-streaming** `POST {baseURL}/chat/completions` with `model` and `messages`, and parses `choices[0].message.content` responses. A vendor may be branded “OpenAI-compatible” yet need other headers, other formats, or nonstandard parameters. Such APIs may require additional work. **OpenAI compatibility does not imply a free API**: users should check provider limits and prices. A key for a paid API may incur charges.

### Example API providers (check free-tier availability and current quotas)

| Provider | Console / docs | API base URL | Example model/route |
| --- | --- | --- | --- |
| **FreeLLMAPI (recommended)** | Your self-hosted instance | `https://YOUR-GATEWAY.example/v1` | `auto:default` or your custom route |
| [OpenRouter](https://openrouter.ai/) | [API docs](https://openrouter.ai/docs/community/frameworks) | `https://openrouter.ai/api/v1` | `openrouter/free` (free-model router, subject to limits) |
| [Groq](https://console.groq.com/) | [OpenAI compatibility](https://console.groq.com/docs/openai) | `https://api.groq.com/openai/v1` | `openai/gpt-oss-20b` (availability may change) |
| [Google AI Studio / Gemini](https://aistudio.google.com/) | [OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai) | `https://generativelanguage.googleapis.com/v1beta/openai` | Choose an available Gemini model in AI Studio |

Other providers and self-hosted local gateways may work if their Chat Completions API follows the same contract. HTTP is permitted **only for `localhost` / `127.0.0.1`**, all remote API endpoints must use HTTPS. API host access is requested at runtime, rather than granting access to every server automatically.

## Test in Firefox (temporary development installation)

Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `manifest.json`. Temporary add-ons vanish on restart.

**For permanent installation**, submit the ZIP at https://addons.mozilla.org/developers/ and obtain Mozilla's signed `.xpi` file. You can submit as **Unlisted** (self-distribute signed XPI) or **Listed** (publish in Mozilla Add-ons). The source ZIP here is not signed. More details: https://extensionworkshop.com/documentation/publish/submitting-an-add-on/.

Keep the existing `browser_specific_settings.gecko.id` across updates to preserve installed extension identity and settings. The signed v0.4.1 identity is translator@the88788.com; older development packages used a different ID and are not the same installed extension.

## Development & validation

No build step, external libraries, npm installation, minification, remote code, or compilation. This is plain HTML/CSS/JS.

```sh
node tests/api.test.mjs
node tests/cache.test.mjs
node tests/localization.test.mjs
node tests/languages.test.mjs
```

Package the **contents** of the extension directory in a ZIP with `manifest.json` at the archive root. Do not put the parent directory inside the ZIP. Upload that archive for signing; do not merely rename an unsigned ZIP to `.xpi` and expect permanent installation.

Read `../PRIVACY.md` before publishing. Your AMO listing should link to a published copy of the privacy policy. Provide an authorized demonstration account or a temporary API key **privately to AMO reviewers** if requested; never put real credentials inside extension archives.

---

## Русский

**88788 Free AI Translator** — бесплатное расширение Firefox для перевода выделенного текста через любой совместимый OpenAI Chat Completions API. Реклама, подписка и телеметрия отсутствуют. Бесплатность запросов зависит от выбранного провайдера.

### Настройка

1. Открой боковую панель Firefox и нажми ⚙.
2. Выбери язык интерфейса: русский, английский или автоматически по языку Firefox.
3. Укажи базовый URL OpenAI-совместимого API (адрес может заканчиваться не только на `/v1`).
4. Укажи API-ключ или оставь поле пустым для локального шлюза без авторизации.
5. В поле «Модель или маршрут» укажи `auto:default` для FreeLLMAPI, `openrouter/free` для OpenRouter или конкретную модель стороннего сервиса.
6. Нажми «Сохранить настройки», разреши Firefox подключаться к выбранному серверу.
7. Выдели текст на сайте и нажми «Перевести».

Под переводом показываются название модели и **провайдер, выполнивший запрос**, если шлюз передал эти сведения (например, FreeLLMAPI через заголовок `X-Routed-Via`). Они также сохраняются в кеше. Если провайдер не указан API, расширение не будет угадывать его.

Кеш экономит повторные обращения: до 200 записей, хранение до 30 дней; просроченные записи удаляются автоматически при запуске и ежедневно. «Другой перевод» доступен только при выборе типа API «FreeLLMAPI», делает новый запрос, минуя кеш. Реальную смену модели можно подтвердить только при наличии информации от API. Переводы и ключ хранятся локально в Firefox, но выбранный фрагмент и ключ передаются выбранному API, а далее могут обрабатываться его поставщиками моделей.

Для постоянной установки нужна подпись Mozilla: https://addons.mozilla.org/developers/. Выбери **Unlisted**, чтобы получить подписанный XPI без публикации, или **Listed**, чтобы разместить расширение в каталоге Mozilla. Этот ZIP **не подписан**.

### Сайты для получения API

- FreeLLMAPI: собственный установленный шлюз с пулом моделей (рекомендуемый вариант).
- OpenRouter: https://openrouter.ai/ · бесплатные модели https://openrouter.ai/collections/free-models/ · URL `https://openrouter.ai/api/v1`.
- Groq: https://console.groq.com/ · URL `https://api.groq.com/openai/v1`.
- Google Gemini API: https://aistudio.google.com/ · URL `https://generativelanguage.googleapis.com/v1beta/openai`.

Проверь актуальные тарифы и ограничения. Даже поддержка OpenAI API не гарантирует, что любые модели или запросы бесплатные.
