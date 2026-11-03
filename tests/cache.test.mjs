import assert from 'node:assert/strict';
import {cacheKey, getCachedTranslation, saveCachedTranslation, clearTranslationCache, CACHE_MAX_ENTRIES, CACHE_TTL_MS, CACHE_STORAGE_KEY, pruneTranslationCache} from '../lib/cache.mjs';

function storageMock() {
  let db = {};
  let writes = 0;
  return {
    async get(key) { return {[key]:db[key]}; },
    async set(entry) { Object.assign(db, entry); writes++; },
    async remove(key) { delete db[key]; },
    stats() { return {db,writes}; }
  };
}
const options = {text:'你好',source:'zh',target:'ru',endpoint:'https://example.test/v1',apiKey:'very-secret'};
const key = await cacheKey(options);
assert.match(key,/^[0-9a-f]{64}$/);
assert.notEqual(key,await cacheKey({...options,text:'你好!'}));
assert.notEqual(key,await cacheKey({...options,target:'en'}));
assert.notEqual(key,await cacheKey({...options,apiKey:'another-key'}));
assert.notEqual(key,await cacheKey({...options,endpoint:'https://other.example/v1'}));
assert.ok(!key.includes('very-secret'));
console.log('OK: SHA-256 cache keys isolate text, language, gateway and account');

const storage = storageMock();
const t0 = Date.now();
assert.equal(await getCachedTranslation(storage,key,t0),null);
assert.equal(await saveCachedTranslation(storage,key,{translation:'Привет',model:'GLM-4.7 Flash',provider:'z-ai'},t0),true);
assert.deepEqual(await getCachedTranslation(storage,key,t0+1000),{translation:'Привет',model:'GLM-4.7 Flash',provider:'z-ai'});
assert.equal(await getCachedTranslation(storage,key,t0+CACHE_TTL_MS),null);
assert.equal(storage.stats().writes,1);
console.log('OK: successful result cached, reused without network, expires after 30 days');

await saveCachedTranslation(storage,key,{translation:'Новый перевод',model:'GPT-OSS 20B',provider:'groq'},t0+100);
assert.deepEqual(await getCachedTranslation(storage,key,t0+200),{translation:'Новый перевод',model:'GPT-OSS 20B',provider:'groq'});
assert.equal(await saveCachedTranslation(storage,key,{translation:''},t0+500),false);
assert.deepEqual(await getCachedTranslation(storage,key,t0+600),{translation:'Новый перевод',model:'GPT-OSS 20B',provider:'groq'});
console.log('OK: fresh alternative replaces cache, including provider; empty/error cannot overwrite');

// Older v0.4 cache entries do not contain a provider; preserve backward compatibility.
const legacyKey=await cacheKey({...options,text:'legacy'});
const legacyCache=storageMock();
await legacyCache.set({[CACHE_STORAGE_KEY]:{[legacyKey]:{translation:'Old',model:'Old Model',savedAt:t0,usedAt:t0}}});
assert.deepEqual(await getCachedTranslation(legacyCache,legacyKey,t0+100),{translation:'Old',model:'Old Model',provider:null});
console.log('OK: legacy cache remains readable and never fabricates provider metadata');

for (let i=0; i < CACHE_MAX_ENTRIES+20; i++) {
  const k = await cacheKey({...options,text:`测试 ${i}`});
  await saveCachedTranslation(storage,k,{translation:`Результат ${i}`,model:null},t0+2000+i);
}
assert.ok(Object.keys(storage.stats().db[CACHE_STORAGE_KEY]).length <= CACHE_MAX_ENTRIES);
assert.equal(await getCachedTranslation(storage,key,t0+10000),null);
console.log('OK: bounded 200-entry cache with eviction');

await clearTranslationCache(storage);
assert.equal(await getCachedTranslation(storage,key,t0+200),null);
assert.ok(!storage.stats().db[CACHE_STORAGE_KEY]);
console.log('OK: user can clear all cached translations');

// Expired entries physically disappear during automatic pruning (not only cache misses).
const cleanupStorage = storageMock();
const oldKey=await cacheKey({...options,text:'old record'});
const newKey=await cacheKey({...options,text:'new record'});
await saveCachedTranslation(cleanupStorage,oldKey,{translation:'old',model:null},t0);
await saveCachedTranslation(cleanupStorage,newKey,{translation:'new',model:null},t0+CACHE_TTL_MS-1000);
assert.equal(await pruneTranslationCache(cleanupStorage,t0+CACHE_TTL_MS+100),1);
assert.ok(!cleanupStorage.stats().db[CACHE_STORAGE_KEY][oldKey]);
assert.equal((await getCachedTranslation(cleanupStorage,newKey,t0+CACHE_TTL_MS+100)).translation,'new');
console.log('OK: scheduled cleanup physically deletes expired translations');
