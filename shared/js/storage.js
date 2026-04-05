// shared/js/storage.js
// Keys compatibles con el proyecto legacy (v0.13) + migración.

export const KEYS = {
  POSTS: 'forum.posts.v0.13',
  ANN: 'forum.announcement.v0.13',
  ROOMS: 'rooms.v0.13',
  TOPICS: 'topics.v0.13.custom'
};

const MIGRATIONS = {
  POSTS: ['forum.posts.v0.05','forum.posts.v0.08','forum.posts.v0.1','forum.posts.v0.11','forum.posts.v0.12'],
  ANN: ['forum.announcement.v0.05','forum.announcement.v0.08','forum.announcement.v0.1','forum.announcement.v0.11','forum.announcement.v0.12'],
  ROOMS: ['rooms.v0.05','rooms.v0.08','rooms.v0.11','rooms.v0.12'],
  TOPICS: ['topics.v0.05.custom','topics.v0.08.custom','topics.v0.11.custom','topics.v0.12.custom']
};

export function migrateLegacy(){
  const migrate = (oldK, newK) => {
    if(localStorage.getItem(newK) == null && localStorage.getItem(oldK) != null){
      localStorage.setItem(newK, localStorage.getItem(oldK));
    }
  };
  MIGRATIONS.POSTS.forEach(k => migrate(k, KEYS.POSTS));
  MIGRATIONS.ANN.forEach(k => migrate(k, KEYS.ANN));
  MIGRATIONS.ROOMS.forEach(k => migrate(k, KEYS.ROOMS));
  MIGRATIONS.TOPICS.forEach(k => migrate(k, KEYS.TOPICS));
}

export function loadJSON(key, fallback){
  try{ return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch{ return fallback; }
}

export function saveJSON(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}
