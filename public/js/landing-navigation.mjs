// The public landing must not wait for Firebase's SDK or auth network to render.
// An unresolved/failed check falls back to the regular login page, which already
// owns session recovery and redirect handling.
export function resolveLandingUser(loadAuth, timeoutMs = 1200) {
  return new Promise((resolve) => {
    let settled = false;
    let unsubscribe;
    const finish = (user = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe?.();
      resolve(user);
    };
    const timer = setTimeout(() => finish(), timeoutMs);
    Promise.resolve().then(loadAuth).then(({ auth, onAuthStateChanged }) => {
      if (settled) return;
      if (auth.currentUser) return finish(auth.currentUser);
      unsubscribe = onAuthStateChanged(auth, finish, () => finish());
      // Test doubles and cached SDKs may invoke the callback synchronously.
      if (settled) unsubscribe?.();
    }).catch(() => finish());
  });
}
