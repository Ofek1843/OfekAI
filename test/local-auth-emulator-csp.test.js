const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
test('Firebase emulator frames are allowed only in server-controlled local demo mode',()=>{
 const server=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
 const expression=server.match(/`frame-src [^`]+`/)[0];
 const production=vm.runInNewContext(expression,{localDemoMode:false});
 const local=vm.runInNewContext(expression,{localDemoMode:true});
 assert.equal(production,"frame-src 'self' https://accounts.google.com/gsi/");
 assert.equal(local,production+' http://127.0.0.1:9099');
 assert.doesNotMatch(production,/localhost|127\.0\.0\.1|\*/);
});
