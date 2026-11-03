import {sortedLanguageCodes, languageName, LANGUAGE_CODES} from "./lib/languages.mjs";
import {DEFAULT_ENDPOINT, DEFAULT_MODEL, MAX_INPUT_CHARS, normalizeEndpoint, normalizeModel, hostPattern, isRouter, translateText, translateDifferent} from "./lib/api.mjs";
import {cacheKey, getCachedTranslation, saveCachedTranslation, clearTranslationCache} from "./lib/cache.mjs";
import {resolveLocale, translate as localize} from "./lib/i18n.mjs";

const $=id=>document.getElementById(id);
const els={
  source:$("sourceLang"),target:$("targetLang"),text:$("sourceText"),result:$("translated"),
  status:$("status"),count:$("charCount"),translate:$("translate"),translateLabel:$("translateLabel"),
  copy:$("copy"),endpoint:$("endpoint"),key:$("apiKey"),model:$("model"),provider:$("providerKind"),
  settings:$("settings"),settingsStatus:$("settingsStatus"),uiLanguage:$("uiLanguage"),
  modelInfo:$("modelInfo"),providerInfo:$("providerInfo"),alternate:$("alternate"),clearCache:$("clearCache")
};
const defaults={endpoint:DEFAULT_ENDPOINT,apiKey:"",model:DEFAULT_MODEL,source:"auto",target:"ru",uiLanguage:"auto",provider:"freellmapi"};
let settings={...defaults};
let locale="en",tabId=null,busy=false,currentAbort,lastResult=null,lastResultKey=null;
const t=(id,vars={})=>localize(locale,id,vars);
const endpointErrors={INVALID_URL:"invalidEndpoint",INVALID_PROTOCOL:"invalidEndpoint",INVALID_URL_OPTIONS:"invalidEndpointOptions",HTTPS_REQUIRED:"httpsRequired",INVALID_MODEL:"invalidModel"};
function showStatus(message,isError=false){els.status.textContent=message;els.status.classList.toggle("error",isError);}
function showSettingsStatus(message,success=false){els.settingsStatus.textContent=message;els.settingsStatus.className=`hint ${success?"success":""}`;}
function populateLanguages(){
  const previousSource=els.source.value||settings.source;
  const previousTarget=els.target.value||settings.target;
  const codes=sortedLanguageCodes(locale);
  for (const element of [els.source,els.target]) {
    element.replaceChildren();
    if(element===els.source) element.add(new Option(t("detectLanguage"),"auto"));
    for(const code of codes) element.add(new Option(languageName(code,locale),code));
  }
  els.source.value=previousSource==="auto"||LANGUAGE_CODES.includes(previousSource)?previousSource:"auto";
  els.target.value=LANGUAGE_CODES.includes(previousTarget)?previousTarget:"ru";
}
function applyLanguage(){
  locale=resolveLocale(settings.uiLanguage,browser.i18n.getUILanguage());
  document.documentElement.lang=locale;
  populateLanguages();
  for(const element of document.querySelectorAll("[data-i18n]")) element.textContent=t(element.dataset.i18n);
  for(const element of document.querySelectorAll("[data-i18n-title]")) element.title=t(element.dataset.i18nTitle);
  for(const element of document.querySelectorAll("[data-i18n-aria]")) element.setAttribute("aria-label",t(element.dataset.i18nAria));
  for(const element of document.querySelectorAll("[data-i18n-placeholder]")) element.placeholder=t(element.dataset.i18nPlaceholder);
  els.translateLabel.textContent=t(busy?"translating":"translate");
  if(lastResult) showTranslation(lastResult,{cached:!!lastResult.cached,key:lastResultKey});
  else els.result.textContent=t("emptyTranslation");
  showStatus(t("selectedReady"));
}
function resetTranslation(){
  lastResult=null;lastResultKey=null;
  els.result.textContent=t("emptyTranslation");
  els.copy.disabled=true;els.modelInfo.hidden=true;els.providerInfo.hidden=true;els.alternate.hidden=true;
}
function showTranslation(result,{cached=false,key}={}){
  lastResult={...result,cached};lastResultKey=key;
  els.result.textContent=result.translation;
  els.copy.disabled=false;
  const modelText=result.model?t("modelKnown",{model:result.model}):t("modelUnknown",{model:settings.model});
  els.modelInfo.textContent=modelText+(cached?t("cacheSuffix"):"");
  els.modelInfo.hidden=false;
  els.providerInfo.textContent=result.provider?t("providerKnown",{provider:result.provider}):t("providerUnknown");
  els.providerInfo.hidden=false;
  els.alternate.hidden=settings.provider!=="freellmapi";
}
function setSourceText(value){
  if(!value||busy) return;
  els.text.value=value;
  updateCount();resetTranslation();showStatus(t("selectedReady"));
}
function updateCount(){
  const length=els.text.value.trim().length;
  els.count.textContent=`${length} / ${MAX_INPUT_CHARS}`;
  els.count.classList.toggle("error",length>MAX_INPUT_CHARS);
  els.translate.disabled=busy||!length||length>MAX_INPUT_CHARS;
}
function setBusy(value){
  busy=value;
  els.translateLabel.textContent=t(value?"translating":"translate");
  $("grab").disabled=value;els.alternate.disabled=value;els.text.disabled=value;
  els.source.disabled=value;els.target.disabled=value;
  updateCount();
}
async function activeTab(){
  const [tab]=await browser.tabs.query({active:true,currentWindow:true});
  tabId=tab?.id??null;return tabId;
}
async function getLatestSelection(){
  const id=await activeTab();if(id===null) return "";
  const cached=await browser.runtime.sendMessage({type:"getCachedSelection",tabId:id}).catch(()=>"");
  if(cached) return cached;
  const direct=await browser.tabs.sendMessage(id,{type:"getSelection"}).catch(()=>null);
  return direct?.text||"";
}
async function grabSelection(){
  const selected=await getLatestSelection();
  if(selected) setSourceText(selected);
  else if(!busy) showStatus(t("noSelection"));
}
async function persistLanguageSettings(){
  settings.source=els.source.value;settings.target=els.target.value;
  await browser.storage.local.set({translatorSettings:settings});resetTranslation();
}
async function saveSettings(){
  let endpoint,model;
  try {endpoint=normalizeEndpoint(els.endpoint.value);model=normalizeModel(els.model.value);}
  catch(e){showSettingsStatus(t(e.message in endpointErrors ? endpointErrors[e.message] : "invalidEndpoint"));return;}
  // Start permission request during the user click (Firefox requires user activation).
  const permissionPromise=browser.permissions.request({origins:[hostPattern(endpoint)]});
  let permitted=false;
  try {permitted=await permissionPromise;}
  catch {showSettingsStatus(t("permissionFailed"));return;}
  if(!permitted){showSettingsStatus(t("permissionDenied"));return;}
  settings.endpoint=endpoint;settings.model=model;settings.apiKey=els.key.value.trim();
  settings.provider=els.provider.value;
  settings.source=els.source.value;settings.target=els.target.value;
  settings.uiLanguage=els.uiLanguage.value;
  await browser.storage.local.set({translatorSettings:settings});
  resetTranslation();
  showSettingsStatus(t("settingsSaved"),true);showStatus(t("connectionReady"));
}
async function startTranslation(forceFresh=false){
  if(busy || (forceFresh && settings.provider!=="freellmapi")) return;
  const text=els.text.value.trim();
  if(!text){showStatus(t("noText"),true);return;}
  if(text.length>MAX_INPUT_CHARS){showStatus(t("maxChars",{max:MAX_INPUT_CHARS}),true);return;}
  const previous=forceFresh?lastResult:null;
  currentAbort=new AbortController();setBusy(true);
  if(!previous){els.result.textContent=t("preparing");els.copy.disabled=true;els.modelInfo.hidden=true;els.providerInfo.hidden=true;els.alternate.hidden=true;}
  try {
    // Permissions are normally granted on Save. Detect a revoked permission early.
    const endpoint=normalizeEndpoint(settings.endpoint);
    const granted=await browser.permissions.contains({origins:[hostPattern(endpoint)]});
    if(!granted) {showStatus(t("permissionDenied"),true);if(!previous) resetTranslation();return;}
    const args={text,source:els.source.value,target:els.target.value,endpoint:settings.endpoint,apiKey:settings.apiKey,model:settings.model};
    const key=await cacheKey(args);
    if(currentAbort.signal.aborted) return;
    if(!forceFresh){
      const saved=await getCachedTranslation(browser.storage.local,key);
      if(saved){showTranslation(saved,{cached:true,key});showStatus(t("cacheHit"));return;}
    }
    const onAttempt=(attempt,total)=>showStatus(t(attempt===1?"attemptFirst":"attemptRetry",{model:settings.model,attempt,total}));
    const base={...args,signal:currentAbort.signal,onAttempt:forceFresh?()=>{}:onAttempt};
    let translated;
    if(forceFresh&&settings.provider==="freellmapi"&&previous&&lastResultKey===key){
      translated=await translateDifferent(base,previous.model,{
        onAlternativeAttempt:(attempt,total)=>showStatus(t("alternativeTry",{model:settings.model,attempt,total}))
      });
      if(!translated){showStatus(t("sameModel"));return;}
    } else translated=await translateText(base);
    showTranslation(translated,{key});
    await saveCachedTranslation(browser.storage.local,key,translated);
    showStatus(forceFresh&&previous?(translated.differentModelVerified?t("confirmedOther"):isRouter(settings.model)?t("unconfirmedOther"):t("repeatSame")):t("finished"));
  } catch(e){
    if(!previous){resetTranslation();els.result.textContent=t("errorTranslation");}
    showStatus(e.name==="AbortError"?t("cancelled"):previous?t("failedOther"):t("failedInitial"),e.name!=="AbortError");
  } finally {currentAbort=null;setBusy(false);}
}
async function copyTranslation(){
  try {await navigator.clipboard.writeText(els.result.textContent);showStatus(t("copied"));}
  catch {showStatus(t("copyFailed"),true);}
}
function swapLanguages(){
  const a=els.source.value,b=els.target.value;
  els.source.value=b;els.target.value=a==="auto"?(b==="ru"?"en":"ru"):a;
  void persistLanguageSettings();
}

browser.runtime.onMessage.addListener((message,sender)=>{
  if(message?.type==="selectionChanged"&&sender.tab?.id===tabId){
    if(document.activeElement!==els.text) setSourceText(message.text);
  }
  return undefined;
});
browser.tabs.onActivated.addListener(()=>{if(!busy) void grabSelection();});
browser.tabs.onUpdated.addListener((updatedTabId,change)=>{
  if(updatedTabId===tabId&&change.status==="complete"&&!busy) void grabSelection();
});
$("toggleSettings").addEventListener("click",()=>{els.settings.hidden=!els.settings.hidden;});
$("toggleKey").addEventListener("click",()=>{els.key.type=els.key.type==="password"?"text":"password";});
$("saveSettings").addEventListener("click",saveSettings);
$("swap").addEventListener("click",swapLanguages);
$("grab").addEventListener("click",grabSelection);
$("clear").addEventListener("click",()=>{els.text.value="";resetTranslation();updateCount();showStatus(t("inputCleared"));});
$("translate").addEventListener("click",()=>startTranslation(false));
els.alternate.addEventListener("click",()=>startTranslation(true));
els.clearCache.addEventListener("click",async()=>{
  try{await clearTranslationCache(browser.storage.local);showSettingsStatus(t("cacheCleared"),true);}
  catch{showSettingsStatus(t("cacheClearFailed"));}
});
$("copy").addEventListener("click",copyTranslation);
els.text.addEventListener("input",()=>{resetTranslation();updateCount();});
els.source.addEventListener("change",()=>{void persistLanguageSettings();});
els.target.addEventListener("change",()=>{void persistLanguageSettings();});
els.provider.addEventListener("change",()=>{
  // The default FreeLLMAPI route is not a valid model for most external APIs.
  if(els.provider.value==="other"&&els.model.value===DEFAULT_MODEL) els.model.value="";
  if(els.provider.value==="freellmapi"&&!els.model.value.trim()) els.model.value=DEFAULT_MODEL;
});
els.uiLanguage.addEventListener("change",()=>{
  settings.uiLanguage=els.uiLanguage.value;
  applyLanguage();
  void browser.storage.local.set({translatorSettings:settings});
});
(async()=>{
  try{
    const stored=await browser.storage.local.get("translatorSettings");
    const saved=stored.translatorSettings||{};
    settings={...defaults,...saved};
    if(!Object.hasOwn(saved,"provider")) settings.provider=isRouter(settings.model)?"freellmapi":"other";
    // Preserve v0.2 users' settings while adding the new model and language fields.
    settings.model=normalizeModel(settings.model||DEFAULT_MODEL);
    // Older installs had no provider mode. Preserve routes from their FreeLLMAPI gateway.
    if (!settings.provider) settings.provider=isRouter(settings.model)?"freellmapi":"other";
    if (!['freellmapi','other'].includes(settings.provider)) settings.provider='other';
    els.endpoint.value=settings.endpoint;els.key.value=settings.apiKey;
    els.model.value=settings.model;els.provider.value=settings.provider;
    els.uiLanguage.value=settings.uiLanguage;
    els.source.value=settings.source;els.target.value=settings.target;
    applyLanguage();updateCount();
    await grabSelection();
  }catch{showStatus(t("settingsReadFailed"),true);}
})();
