const timeoutCopy = {
  en: 'This is taking longer than expected. Your answers are kept. Please try again.',
  he: 'הבקשה נמשכת יותר מהצפוי. התשובות שלך נשמרו בטופס. נסו שוב.',
  es: 'Está tardando más de lo esperado. Tus respuestas siguen en el formulario. Inténtalo de nuevo.',
  fr: 'Cela prend plus de temps que prévu. Vos réponses restent dans le formulaire. Réessayez.',
  de: 'Das dauert länger als erwartet. Deine Antworten bleiben im Formular. Bitte versuche es erneut.',
  ar: 'يستغرق الطلب وقتًا أطول من المتوقع. تبقى إجاباتك في النموذج. حاول مرة أخرى.',
  zh: '请求耗时比预期更长。你的答案仍保留在表单中。请重试。'
};
export async function fetchWithDeadline(url, options = {}, { language = 'en', timeoutMs = 90000, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abort();
  else options.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (!timedOut) throw error;
    const timeoutError = new Error(timeoutCopy[language] || timeoutCopy.en);
    timeoutError.code = 'REQUEST_TIMEOUT';
    throw timeoutError;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}
