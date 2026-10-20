// In-memory posts array, loaded from localStorage on startup and saved after every change.
// localStorage here is Node's built-in Web Storage (enabled by the npm start:blog flags).
const POSTS_KEY = "posts";
const NEXT_ID_KEY = "nextPostId";

// A broken saved value throws here and stops the server instead of erasing the data.
let posts = JSON.parse(localStorage.getItem(POSTS_KEY) || "[]");
// A saved counter (not posts.length) keeps deleted IDs from being reused
let nextId = Number(localStorage.getItem(NEXT_ID_KEY) || posts.length + 1);

// Save first, then update memory, so a failed save never changes the array.
function save(updatedPosts) {
  localStorage.setItem(POSTS_KEY, JSON.stringify(updatedPosts));
  posts = updatedPosts;
}

module.exports = {
  findAll: () => posts,
  findById: (id) => posts.find((p) => p.id === id),
  findByAuthor: (userId) => posts.filter((p) => p.user_id === userId),

  create: ({ user_id, title, content }) => {
    const post = { id: nextId, user_id, title, content };
    localStorage.setItem(NEXT_ID_KEY, String(nextId + 1));
    nextId++;
    save([...posts, post]);
    return post;
  },

  update: (id, changes) => {
    const updatedPosts = posts.map((p) => (p.id === id ? { ...p, ...changes } : p));
    save(updatedPosts);
    return updatedPosts.find((p) => p.id === id);
  },

  remove: (id) => {
    save(posts.filter((p) => p.id !== id));
  },
};
