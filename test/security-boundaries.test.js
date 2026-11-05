const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { createImageUploadAuth } = require('../lib/image-upload-auth');
const { createRateLimiter, clientIp } = require('../lib/runtime-guards');
const { isVerifiedAdmin } = require('../lib/admin-authorization');
const config = { publicKey: 'test-public', privateKey: 'test-private-only' };
const input = { purpose: 'progress', entryId: 'photo_123', mimeType: 'image/png' };
const claims = token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url'));

test('upload authorization signs every destination, privacy and validation parameter', () => {
  const {token, uploadParams} = createImageUploadAuth('alice', input, config, 1000);
  const [header, payload, signature] = token.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(header,'base64url')), {alg:'HS256',typ:'JWT',kid:'test-public'});
  assert.deepEqual(claims(token), {...uploadParams, iat:1000, exp:1300});
  assert.equal(signature, crypto.createHmac('sha256',config.privateKey).update(`${header}.${payload}`).digest('base64url'));
  assert.equal(uploadParams.folder, '/fuelphysique/users/alice/progressPhotos/photo_123');
  assert.equal(uploadParams.isPrivateFile, 'true');
  assert.equal(uploadParams.overwriteFile, 'false');
  assert.match(uploadParams.checks, /5242880.*image\/png/);
  for(const change of [{folder:'/fuelphysique/users/bob/progressPhotos/x'}, {isPrivateFile:'false'}, {checks:''}, {overwriteFile:'true'}]) {
    const edited = Buffer.from(JSON.stringify({...claims(token),...change})).toString('base64url');
    assert.notEqual(signature,crypto.createHmac('sha256',config.privateKey).update(`${header}.${edited}`).digest('base64url'));
  }
});
test('both image purposes work, tokens cannot collide, extra client fields cannot expand scope', () => {
  const a=createImageUploadAuth('alice',{...input,folder:'/other',isPrivateFile:false},config,1000);
  const b=createImageUploadAuth('alice',input,config,1000);
  assert.notEqual(a.token,b.token);
  assert.equal(a.uploadParams.isPrivateFile,'true');
  const profile=createImageUploadAuth('alice',{purpose:'profile',mimeType:'image/jpeg'},config);
  assert.equal(profile.uploadParams.folder,'/fuelphysique/users/alice/social-profile');
  assert.equal(profile.uploadParams.isPrivateFile,'false');
  assert.equal(profile.uploadParams.fileName,'profile-alice.jpg');
  assert.equal(profile.uploadParams.overwriteFile,'true');
  const profileRetry=createImageUploadAuth('alice',{purpose:'profile',mimeType:'image/jpeg'},config);
  assert.equal(profileRetry.uploadParams.fileName,profile.uploadParams.fileName);
  assert.notEqual(profileRetry.token,profile.token);
});
test('upload authorization rejects traversal, unsupported media and missing destinations', () => {
  for(const entryId of ['../bob','%2e%2e','x/y','x\\y','',null]) assert.throws(()=>createImageUploadAuth('alice',{...input,entryId},config),{status:400});
  for(const mimeType of ['image/svg+xml','text/html','video/mp4','constructor','__proto__',null,['image/png']]) assert.throws(()=>createImageUploadAuth('alice',{...input,mimeType},config),{status:400});
  assert.throws(()=>createImageUploadAuth('alice',{...input,purpose:'arbitrary'},config),{status:400});
});
test('same user remains limited across IP changes, other users retain their own quota', () => {
  const limit=createRateLimiter({max:1});
  const req=ip=>({ip,headers:{'x-forwarded-for':crypto.randomUUID()}});
  limit(req('1.1.1.1'),'alice');
  assert.throws(()=>limit(req('2.2.2.2'),'alice'),{status:429});
  assert.doesNotThrow(()=>limit(req('1.1.1.1'),'bob'));
  assert.equal(clientIp({ip:'proxy-validated',headers:{'x-forwarded-for':'spoof'}}),'proxy-validated');
});
test('admin privileges require a strictly verified email and exact allowlist membership', () => {
  assert.equal(isVerifiedAdmin({email:'admin@example.test',emailVerified:false},'admin@example.test'),false);
  assert.equal(isVerifiedAdmin({email:'admin@example.test',emailVerified:'true'},'admin@example.test'),false);
  assert.equal(isVerifiedAdmin({email:'other@example.test',emailVerified:true},'admin@example.test'),false);
  assert.equal(isVerifiedAdmin({email:'Admin@example.test',emailVerified:true},'admin@example.test'),true);
  assert.match(fs.readFileSync('firestore.rules','utf8'),/request\.auth\.token\.email_verified == true/);
});

test('real upload-auth route rejects guests and V1 and issues only scoped V2 credentials', async () => {
  const {spawn} = require('node:child_process');
  const net = require('node:net');
  const reserve = net.createServer();
  await new Promise(resolve=>reserve.listen(0,'127.0.0.1',resolve));
  const port=reserve.address().port;
  await new Promise(resolve=>reserve.close(resolve));
  const child=spawn(process.execPath,['server.js'],{cwd:require('node:path').join(__dirname,'..'),stdio:'ignore',env:{...process.env,
    PORT:String(port), SERVER_BIND_HOST:'127.0.0.1', NODE_ENV:'test', MOCK_EXTERNAL_SERVICES:'true', FUELPHYSIQUE_LOCAL_DEMO:'0',
    IMAGEKIT_PRIVATE_KEY:'test-private', IMAGEKIT_PUBLIC_KEY:'test-public', IMAGEKIT_URL_ENDPOINT:'https://ik.imagekit.io/test-only',
    TELEGRAM_BOT_TOKEN:'', OPENAI_API_KEY:'', PUSH_NOTIFICATIONS_ENABLED:'false'
  }});
  try {
    const base=`http://127.0.0.1:${port}`;
    let ready=false;
    for(let i=0;i<100;i++){try{if((await fetch(base+'/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}
    assert.equal(ready,true,'test server starts');
    assert.equal((await fetch(base+'/api/imagekit/upload-auth')).status,410);
    assert.equal((await fetch(base+'/api/imagekit/upload-auth',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)})).status,401);
    const response=await fetch(base+'/api/imagekit/upload-auth',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer alice'},body:JSON.stringify({...input,uid:'bob',isPrivateFile:false})});
    assert.equal(response.status,200);
    assert.equal(response.headers.get('cache-control'),'no-store');
    const data=await response.json();
    assert.equal(data.uploadParams.folder,'/fuelphysique/users/mock-alice/progressPhotos/photo_123');
    assert.equal(data.uploadParams.isPrivateFile,'true');
    assert.equal(data.signature,undefined);
    assert.equal(JSON.stringify(data).includes('test-private'),false);
  } finally { child.kill(); await new Promise(resolve=>child.exitCode===null?child.once('exit',resolve):resolve()); }
});

test('browser sends exactly the signed V2 fields for profile and private progress photos', async () => {
  const vm=require('node:vm');
  const source=fs.readFileSync('public/js/imagekit-upload.js','utf8').replace(/import[^;]+;/,'').replace(/export /g,'');
  const requests=[];
  const context={auth:{currentUser:{uid:'alice',getIdToken:async()=>'test-token'}},FormData,Blob,
    fetch:async(url,options)=>{
      assert.equal(url,'/api/imagekit/upload-auth'); assert.equal(options.method,'POST');
      return {ok:true,json:async()=>createImageUploadAuth('alice',JSON.parse(options.body),config)};
    },
    XMLHttpRequest:class {
      constructor(){this.upload={};}
      open(method,url){assert.equal(url,'https://upload.imagekit.io/api/v2/files/upload');assert.equal(method,'POST');}
      send(form){const entries=Object.fromEntries(form.entries());const payload=claims(entries.token);for(const [key,value] of Object.entries(payload))if(!['iat','exp'].includes(key))assert.equal(entries[key],value);assert.equal(entries.signature,undefined);assert.ok(entries.file instanceof Blob);requests.push(entries);this.status=200;this.responseText='{"fileId":"mock-file"}';this.onload();}
    }
  };
  vm.runInNewContext(source,context);
  const file=new Blob([new Uint8Array([137,80,78,71])],{type:'image/png'});
  await context.directImageKitUpload({file,folder:'/fuelphysique/users/alice/progressPhotos/entry',isPrivateFile:true});
  await context.directImageKitUpload({file,folder:'/fuelphysique/users/alice/social-profile',isPrivateFile:false});
  assert.equal(requests[0].isPrivateFile,'true');assert.equal(requests[1].isPrivateFile,'false');
  await assert.rejects(()=>context.directImageKitUpload({file,folder:'/fuelphysique/users/bob/social-profile'}));
});
