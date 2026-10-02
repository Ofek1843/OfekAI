const test = require('node:test');
const assert = require('node:assert/strict');
test('successful builder requests preserve response and request fields', async()=>{
  const {fetchWithDeadline}=await import('../public/js/request-deadline.mjs');
  const response={ok:true};
  assert.equal(await fetchWithDeadline('/api/test',{method:'POST',body:'{}'},{fetchImpl:async(url,options)=>{assert.equal(url,'/api/test');assert.equal(options.body,'{}');assert.ok(options.signal instanceof AbortSignal);return response;}}),response);
});
test('stalled requests abort and report a retryable timeout in every supported language',async()=>{
  const {fetchWithDeadline}=await import('../public/js/request-deadline.mjs');
  for(const language of ['en','he','ar','es','fr','de','zh']){
    await assert.rejects(fetchWithDeadline('/api/test',{}, {language,timeoutMs:5,fetchImpl:(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))))}),error=>error.code==='REQUEST_TIMEOUT'&&error.message.length>20&&(language==='he'||!/[\u0590-\u05ff]/.test(error.message)));
  }
});
test('ordinary network errors and caller cancellation are not relabeled as timeouts',async()=>{
  const {fetchWithDeadline}=await import('../public/js/request-deadline.mjs');
  const error=Error('network');await assert.rejects(fetchWithDeadline('/api/test',{}, {fetchImpl:async()=>{throw error;}}),value=>value===error);
  const controller=new AbortController();controller.abort();
  await assert.rejects(fetchWithDeadline('/api/test',{signal:controller.signal},{fetchImpl:async(_url,{signal})=>{assert.equal(signal.aborted,true);throw error;}}),value=>value===error);
});
