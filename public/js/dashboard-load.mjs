// Independent bounded reads: one failed optional section must not look like a
// failed dashboard, and read failures must remain visible and retryable.
const transient = new Set(['unavailable','deadline-exceeded','aborted','internal','resource-exhausted','DASHBOARD_TIMEOUT']);
export function dashboardErrorCode(error) {
  return String(error?.code || 'unknown').replace(/^firestore\//,'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,60) || 'unknown';
}
async function boundedRead(read,timeoutMs) {
  let timer;
  try {return await Promise.race([Promise.resolve().then(read),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error('Dashboard read timed out'),{code:'DASHBOARD_TIMEOUT'})),timeoutMs);})]);}
  finally {clearTimeout(timer);}
}
export async function loadDashboardSections(readers,{timeoutMs=12000}={}) {
  const entries=Object.entries(readers);
  const results=await Promise.all(entries.map(async([key,read])=>{
    for(let attempt=0;attempt<2;attempt++) {
      try {return [key,{status:'fulfilled',value:await boundedRead(read,timeoutMs)}];}
      catch(error){const code=dashboardErrorCode(error);if(attempt||!transient.has(code))return [key,{status:'rejected',code}];}
    }
  }));
  return Object.fromEntries(results);
}
