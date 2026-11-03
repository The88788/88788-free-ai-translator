import assert from 'node:assert/strict';
import {translateText,translateDifferent,normalizeEndpoint,normalizeModel,hostPattern,isRouter,DEFAULT_MODEL,MAX_ATTEMPTS,MAX_ALTERNATIVE_ATTEMPTS,responseIdentity} from '../lib/api.mjs';
import {resolveLocale,translate as t} from '../lib/i18n.mjs';

const base={text:'你好',source:'zh',target:'ru',endpoint:'https://example.test/v1',apiKey:'test-token'};
const reply=(translation,model,headers)=>({ok:true,headers:headers||{get:()=>null},json:async()=>({model,choices:[{message:{content:translation}}]})});
assert.equal(DEFAULT_MODEL,'auto:default');
assert.equal(MAX_ATTEMPTS,3);
assert.equal(MAX_ALTERNATIVE_ATTEMPTS,3);
assert.equal(normalizeEndpoint('https://api.groq.com/openai/v1/'),'https://api.groq.com/openai/v1');
assert.equal(normalizeEndpoint('https://openrouter.ai/api/v1'),'https://openrouter.ai/api/v1');
assert.equal(normalizeEndpoint('https://generativelanguage.googleapis.com/v1beta/openai/'),'https://generativelanguage.googleapis.com/v1beta/openai');
assert.equal(normalizeEndpoint('https://api.example.com/v1/chat/completions'),'https://api.example.com/v1');
assert.equal(normalizeEndpoint('http://localhost:1234/v1'),'http://localhost:1234/v1');
assert.equal(hostPattern('https://example.test/v1'),'https://example.test/*');
assert.throws(()=>normalizeEndpoint('http://evil.example/v1'));
assert.throws(()=>normalizeEndpoint('https://abc.example/v1?token=secret'));
assert.throws(()=>normalizeEndpoint('javascript:alert(1)'));
assert.equal(normalizeModel(' auto:light '),'auto:light');
assert.equal(normalizeModel(' openai/gpt-oss-20b '),'openai/gpt-oss-20b');
assert.throws(()=>normalizeModel('invalid route'));
assert.throws(()=>normalizeModel(''));
assert.equal(isRouter('auto:light'),true);
assert.equal(isRouter('openrouter/free'),false);
assert.equal(isRouter('openai/gpt-oss-20b'),false);
console.log('PASS: API URL, routes, local HTTP and model validation');

let calls=0,lastBody;
const done=await translateText({...base,model:'auto:light',fetchImpl:async(url,opts)=>{
  calls++;lastBody=JSON.parse(opts.body);
  assert.equal(url,'https://example.test/v1/chat/completions');
  assert.equal(opts.headers.Authorization,'Bearer test-token');
  if(calls===1) return {ok:false,status:429,headers:{get:()=>null}};
  if(calls===2) return {ok:false,status:503,headers:{get:()=>null}};
  return reply('Привет','GPT-OSS 20B');
}});
assert.deepEqual(done,{translation:'Привет',model:'GPT-OSS 20B',provider:null});
assert.equal(calls,3);
assert.equal(lastBody.model,'auto:light');
assert.equal(lastBody.stream,false);
assert.ok(!('temperature' in lastBody));
console.log('PASS: transient errors retried without UI interruption; correct route sent');

lastBody=null;
const direct=await translateText({...base,endpoint:'https://api.groq.com/openai/v1',model:'openai/gpt-oss-20b',fetchImpl:async(url,opts)=>{
  assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');
  lastBody=JSON.parse(opts.body);
  return reply('Мир','openai/gpt-oss-20b');
}});
assert.equal(lastBody.model,'openai/gpt-oss-20b');
assert.equal(direct.model,'openai/gpt-oss-20b');
assert.equal(direct.provider,null); // The model name is NOT sufficient evidence of the upstream API provider.
console.log('PASS: non-FreeLLMAPI endpoint and direct model');

const unknown=await translateText({...base,model:'auto:light',fetchImpl:async()=>reply('OK','auto:light')});
assert.equal(unknown.model,null);
const header=await translateText({...base,model:'auto:light',fetchImpl:async()=>reply('OK','auto:light',{get:h=>h==='x-freellmapi-model'?'GLM-4.7 Flash':null})});
assert.equal(header.model,'GLM-4.7 Flash');
assert.equal(header.provider,null);
console.log('PASS: model metadata; aliases are not misreported as actual models');

// FreeLLMAPI explicitly exposes both provider and model in X-Routed-Via.
const routed=await translateText({...base,model:'auto:light',fetchImpl:async()=>({
  ok:true,headers:{get:h=>h==='x-routed-via'?'google/gemini-2.5-flash':null},
  json:async()=>({model:'auto:light',choices:[{message:{content:'Перевод'}}]})
})});
assert.deepEqual(routed,{translation:'Перевод',model:'gemini-2.5-flash',provider:'google'});
// A model ID may contain further slashes. Keep all segments after the FIRST slash.
assert.deepEqual(responseIdentity({model:'auto:light'},{headers:{get:h=>h==='x-routed-via'?'openrouter/qwen/qwen3-235b':null}},'auto:light'),{model:'qwen/qwen3-235b',provider:'openrouter'});
assert.deepEqual(responseIdentity({model:'wrong-model'},{headers:{get:h=>h==='x-routed-via'?'mistral/ministral-14b-latest':null}},'auto:light'),{model:'ministral-14b-latest',provider:'mistral'});
// Support percent-encoded non-ASCII routed model IDs.
const percent=encodeURIComponent('模型/测试');
assert.deepEqual(responseIdentity({},{headers:{get:h=>h==='x-routed-via'?`custom/${percent}`:null}},'auto:default'),{model:'模型/测试',provider:'custom'});
// Other OpenAI-style servers can supply explicit identity fields/headers, too.
assert.deepEqual(responseIdentity({metadata:{provider:'groq',actual_model:'openai/gpt-oss-20b'}},{headers:{get:()=>null}},'direct'),{model:'openai/gpt-oss-20b',provider:'groq'});
assert.deepEqual(responseIdentity({model:'foo/bar'},{headers:{get:()=>null}},'foo/bar'),{model:'foo/bar',provider:null});
console.log('PASS: routed provider and model, header priority, nested model IDs, encoded IDs, explicit fallbacks, no guessing');

calls=0;
await assert.rejects(()=>translateText({...base,fetchImpl:async()=>{calls++;return {ok:false,status:401,headers:{get:()=>null}};}}));
assert.equal(calls,1);
console.log('PASS: unauthorized requests are not retried');

calls=0;
const different=await translateDifferent({...base,model:'auto:light',fetchImpl:async()=>{
  calls++;return calls===1?reply('same','GPT-OSS 20B'):reply('other','GLM-4.7 Flash');
}},'GPT-OSS 20B');
assert.equal(calls,2);
assert.equal(different.differentModelVerified,true);
console.log('PASS: router repeats until another model is confirmed');

calls=0;
const again=await translateDifferent({...base,model:'openai/gpt-oss-20b',fetchImpl:async()=>{
  calls++;return reply('updated','openai/gpt-oss-20b');
}},'openai/gpt-oss-20b');
assert.equal(calls,1);
assert.equal(again.translation,'updated');
assert.equal(again.differentModelVerified,false);
console.log('PASS: direct-model repeat produces another translation without claiming changed model');

assert.equal(resolveLocale('auto','ru-RU'),'ru');
assert.equal(resolveLocale('auto','en-US'),'en');
assert.equal(resolveLocale('en','ru-RU'),'en');
assert.match(t('ru','routeLabel'),/Модель/);
assert.match(t('en','routeLabel'),/Model/);
assert.match(t('ru','modelUnknown',{model:'auto:light'}),/auto:light/);
console.log('PASS: Russian/English manual and Firefox-language selection');
