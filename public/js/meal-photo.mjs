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
  if (addedPhotos.has(id)) return `/images/meals/${id}.webp`;
  return safeLocalImage(option.image || option.mealImage || meal.image || meal.mealImage);
}
