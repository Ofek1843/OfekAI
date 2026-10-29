export const visualVariants = Object.freeze({
  '/assets/dashboard/training.webp': '/assets/dashboard/training-female-v4.webp',
  '/assets/dashboard/landing-training.webp': '/assets/dashboard/landing-training-female-v2.webp'
});

// Fixed allowlist: profile data can never become an arbitrary image URL.
export function personalizeImage(image, model) {
  const original = image.dataset.visualOriginal || image.getAttribute('src');
  if (!visualVariants[original]) return;
  image.dataset.visualOriginal = original;
  image.dataset.visualOriginalAlt ??= image.alt || '';
  image.dataset.visualOriginalPosition ??= image.style?.objectPosition || '';
  if (image.style) image.style.objectPosition = model === 'female' && original === '/assets/dashboard/training.webp'
    ? '60% top' : image.dataset.visualOriginalPosition;
  image.alt = model === 'female' ? 'Athletic woman in a modern gym' : image.dataset.visualOriginalAlt;
  const desired = model === 'female' ? visualVariants[original] : original;
  if (image.dataset.visualSelected === desired) return;
  image.dataset.visualSelected = desired;
  image.onerror = () => {
    image.onerror = null;
    image.alt = image.dataset.visualOriginalAlt;
    if (image.style) image.style.objectPosition = image.dataset.visualOriginalPosition;
    if (image.getAttribute('src') !== original) image.src = original;
  };
  image.src = desired;
}
