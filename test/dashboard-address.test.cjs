const test=require('node:test'),assert=require('node:assert/strict');
const {parseHTML}=require('linkedom');
test('dashboard addresses female/male/neutral without changing English',async()=>{
 const {dashboardAddressText}=await import('../public/js/dashboard-address.mjs');
 assert.equal(dashboardAddressText('צור עכשיו','female'),'צרי עכשיו');
 assert.equal(dashboardAddressText('צרי עכשיו','male'),'צור עכשיו');
 assert.equal(dashboardAddressText('צור עכשיו','default'),'יצירה עכשיו');
 assert.equal(dashboardAddressText('Create now','female'),'Create now');
 assert.equal(dashboardAddressText('נסה שוב','female'),'נסי שוב');
 assert.equal(dashboardAddressText('צור את התוכנית הראשונה שלך והתחל להתקדם.','female'),'צרי את התוכנית הראשונה שלך והתחילי להתקדם.');
});
test('dynamic rerenders and preference switches preserve icons and user plan names',async()=>{
 const {personalizeDashboardAddress}=await import('../public/js/dashboard-address.mjs');
 const {document}=parseHTML('<html lang="he"><body><main id="dashboardRoot"><h2>צור עכשיו</h2><div class="session-actions"><a><img src="/arrow.svg">צור עכשיו</a></div></main></body></html>');
 const root=document.querySelector('main'),a=root.querySelector('a'),icon=a.querySelector('img');
 personalizeDashboardAddress(root,'female');assert.equal(a.textContent,'צרי עכשיו');assert.equal(a.querySelector('img'),icon);assert.equal(root.querySelector('h2').textContent,'צור עכשיו');
 personalizeDashboardAddress(root,'default');assert.equal(a.textContent,'יצירה עכשיו');
 a.innerHTML='<img src="/arrow.svg">צור עכשיו';personalizeDashboardAddress(root,'female');assert.equal(a.textContent,'צרי עכשיו');
 document.documentElement.lang='en';a.textContent='Create now';personalizeDashboardAddress(root,'female');assert.equal(a.textContent,'Create now');
});
