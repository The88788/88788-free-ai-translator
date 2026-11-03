// BCP-47 language codes. Display labels are localized by Firefox's Intl API.
export const LANGUAGE_CODES = Object.freeze(["af", "sq", "am", "ar", "hy", "az", "eu", "be", "bn", "bs", "bg", "ca", "zh", "zh-TW", "hr", "cs", "da", "nl", "en", "et", "fa", "fi", "fr", "ka", "de", "el", "gu", "he", "hi", "hu", "is", "id", "ga", "it", "ja", "kn", "kk", "ko", "ky", "lv", "lt", "mk", "ms", "ml", "mr", "mn", "ne", "no", "ps", "pl", "pt", "pt-BR", "pa", "ro", "ru", "sr", "sk", "sl", "so", "es", "sw", "sv", "tl", "ta", "te", "th", "tr", "uk", "ur", "uz", "vi", "cy", "yi", "yo", "zu"]);
export const PREFERRED_CODES = Object.freeze(["ru", "en", "zh", "zh-TW", "kk"]);
const OVERRIDES = {
  en: {zh: "Chinese (Simplified)", "zh-TW": "Chinese (Traditional)"},
  ru: {zh: "Китайский (упрощённый)", "zh-TW": "Китайский (традиционный)"}
};
export function languageName(code, locale="en") {
  if (!LANGUAGE_CODES.includes(code)) return null;
  const lang = locale === "ru" ? "ru" : "en";
  if (OVERRIDES[lang][code]) return OVERRIDES[lang][code];
  try { return new Intl.DisplayNames([lang], {type:"language", languageDisplay:"standard"}).of(code); }
  catch { return code; }
}
export function sortedLanguageCodes(locale="en") {
  const sorter = new Intl.Collator(locale === "ru" ? "ru" : "en", {sensitivity:"base"});
  return [...PREFERRED_CODES, ...LANGUAGE_CODES.filter(v => !PREFERRED_CODES.includes(v)).sort((a,b) => sorter.compare(languageName(a,locale), languageName(b,locale)))];
}
