// Photos added after some plans were saved. Use the catalog ID so an older
// snapshot can show its photo without changing the saved foods or portions.
const addedPhotos = new Set([
  'simple-soy-oats-banana',
  'simple-soy-oats-apple',
  'simple-peanut-banana-bread',
  'simple-tofu-hummus-pita',
  'simple-tofu-ready-rice',
  'simple-chickpea-tofu-salad',
  'simple-bean-tofu-bread',
  'simple-lentil-tofu-rice'
]);

const safeLocalImage = value => typeof value === 'string'
  && /^\/(?:images|assets)\/[\w./%-]+$/.test(value)
  && !value.includes('..') ? value : '';

export function mealPhotoFor(option = {}, meal = {}) {
  const id = option.mealId || meal.mealId || meal.id;
  let source = addedPhotos.has(id)
    ? `/images/meals/${id}.webp`
    : safeLocalImage(option.image || option.mealImage || meal.image || meal.mealImage);
  // Older saved plans may still carry the meal-catalog SVG illustration URL.
  // Every meal SVG has a reviewed photographic WebP sibling, so normalize the
  // legacy URL instead of allowing a stale snapshot to override the real photo.
  if (/^\/images\/meals\/[\w-]+\.svg$/.test(source)) {
    source = source.replace(/\.svg$/, ".webp");
  }
  // Bust stale low-resolution meal photos that may remain in a browser or CDN
  // cache after a sharper catalog asset has replaced them.
  return source ? `${source}?v=20261018-meal-photo-1` : "";
}
