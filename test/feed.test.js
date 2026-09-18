const test = require('node:test');
const assert = require('node:assert/strict');
const { run, fetchFeed, validateItems } = require('../script/index');
const repo = { title:'owner/repo',url:'https://github.com/owner/repo',description:'',language:'',languageColor:'',stars:'1,000',forks:'12',addStars:'3' };

test('only the 18 supported feeds are fetched, and nothing is published on a partial failure', async () => {
  const fetched = [], written = [];
  await assert.rejects(run({
    fetch: async (s,l) => { fetched.push(`${s}/${l}`); if(fetched.length === 18) throw new Error('blocked'); return [repo]; },
    write: async (...args) => written.push(args), sleep: async()=>{},
  }), /blocked/);
  assert.equal(fetched.length,18);
  assert.equal(written.length,0);
  assert.deepEqual([...new Set(fetched.map(x=>x.split('/')[1]))], ['all','javascript','typescript','python','go','rust']);
});

test('all supported feeds are written after successful fetching', async () => {
  let fetched=0, written=0;
  await run({fetch:async()=>{fetched++;return [repo]},write:async()=>{assert.equal(fetched,18);written++},sleep:async()=>{}});
  assert.equal(written,18);
});

test('reject empty pages, malformed counts, and duplicate repositories', () => {
  assert.throws(()=>validateItems([]));
  assert.throws(()=>validateItems([{...repo,stars:''}]));
  assert.throws(()=>validateItems([repo,repo]));
  assert.doesNotThrow(()=>validateItems([repo]));
});

test('403 stops immediately without repeated requests', async () => {
  let calls=0;
  await assert.rejects(fetchFeed('daily','all',{get:async()=>{calls++;throw Object.assign(new Error('Forbidden'),{response:{status:403}})},sleep:async()=>{throw new Error('unexpected retry')}}),/Forbidden/);
  assert.equal(calls,1);
});

test('429 honors retry-after and caps attempts', async () => {
  let calls=0;const pauses=[];
  await assert.rejects(fetchFeed('daily','all',{get:async()=>{calls++;throw Object.assign(new Error('Limited'),{response:{status:429,headers:{'retry-after':'30'}}})},sleep:async ms=>pauses.push(ms)}),/Limited/);
  assert.equal(calls,3);assert.deepEqual(pauses,[30000,30000]);
});

test('HTTP 200 block/error HTML is not published or retried', async () => {
  let calls=0;
  await assert.rejects(fetchFeed('daily','all',{get:async()=>{calls++;return {data:'<html>Unavailable</html>'}},sleep:async()=>{}}),/no repositories/);
  assert.equal(calls,1);
});
