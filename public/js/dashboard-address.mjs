// Only system-owned dashboard copy. Never rewrite plan titles or user content.
const variants = [
 ['צור עכשיו', 'צרי עכשיו', 'יצירה עכשיו'],
 ['צור את התוכנית הראשונה שלך והתחל להתקדם.', 'צרי את התוכנית הראשונה שלך והתחילי להתקדם.', 'אפשר ליצור תוכנית ראשונה ולהתחיל להתקדם.'],
 ['צור את תוכנית האימון הראשונה שלך כדי להתקדם.', 'צרי את תוכנית האימון הראשונה שלך כדי להתקדם.', 'אפשר ליצור תוכנית אימון ראשונה ולהתחיל להתקדם.'],
 ['נסה שוב', 'נסי שוב', 'ניסיון נוסף'],
 ['לא ניתן לטעון את האזור הזה. נסה שוב.', 'לא ניתן לטעון את האזור הזה. נסי שוב.', 'לא ניתן לטעון את האזור הזה. אפשר לנסות שוב.']
];
export function dashboardAddressText(text, preference) {
 const group = variants.find(row => row.includes(text.trim()));
 if (!group) return text;
 return text.replace(text.trim(), group[preference === 'male' ? 0 : preference === 'female' ? 1 : 2]);
}
export function personalizeDashboardAddress(root, preference) {
 if (!root || root.ownerDocument.documentElement.lang !== 'he') return;
 const visit = node => {
  if (node.nodeType === 3) {
   const value = dashboardAddressText(node.textContent, preference);
   if (value !== node.textContent) node.textContent = value;
  } else for (const child of node.childNodes) visit(child);
 };
 root.querySelectorAll('.session-actions a, .empty-plans a, .session-description, [data-action="retry-dashboard"], .status, .empty-plans').forEach(visit);
}
