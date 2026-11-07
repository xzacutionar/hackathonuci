// One badge per directory category, shared across all map renderers.
const badges = {Schools:'schools', Health:'health', Transport:'transport', Shopping:'shopping', Employment:'employment'};
export function amenityIcon(category) {
  return '/imagery/amenities/'+(Object.hasOwn(badges,category)?badges[category]:'place')+'.svg';
}
