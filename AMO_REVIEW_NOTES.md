# Notes for Mozilla Add-ons reviewers

Firefox-only Manifest V3 extension, no build dependencies, no minification or remote executable code. All extension source is included in this archive; the root `manifest.json` is the entry point. No test account is included. A reviewer will need a compatible Chat Completions endpoint and API key to verify remote translation (examples are in README; the developer must provide temporary test access privately on request).

Permission justification:
- `storage`: saved API endpoint, API key, model, language settings and local translation cache.
- `alarms`: schedules a local cache cleanup once every 24 hours; no network use.
- `menus`: user-triggered contextual Translate selection action.
- content script `<all_urls>`: listens for selection on normal webpages; selected text is stored in extension memory, not sent to the API unless the user clicks Translate.
- `optional_host_permissions`: asks permission only for the precise API host chosen by the user when Save settings is clicked.
- data collection: selected website text and an API bearer token are sent only to the explicitly configured provider upon user action, with no developer telemetry. See PRIVACY.md.

Testing: load `manifest.json`, open sidebar, open settings, set a compatible API URL, key and valid model, Save to grant permission, select text on a website, press Translate. Test without external access by creating a local OpenAI-compatible test endpoint at `http://127.0.0.1:PORT/v1` (loopback HTTP allowed). For manual changes between Russian and English, switch Interface language in Settings.

Developer: 88788 (https://the88788.com/). The header does not show any user-specific route. API mode is explicitly selected in settings.

Version 0.4.1: Shows the selected upstream provider below each translation when explicitly provided by the API (especially FreeLLMAPI X-Routed-Via). Provider is saved in the same local cache record as the model and translation. Does not perform any additional network call or tracking.
