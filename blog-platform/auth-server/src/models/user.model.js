// In-memory users array, loaded from localStorage on startup and saved after every change.
// localStorage here is Node's built-in Web Storage (enabled by the npm start:auth flags).
const USERS_KEY = "users";
const NEXT_ID_KEY = "nextUserId";

// A broken saved value throws here and stops the server instead of erasing the data.
let users = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
let nextId = Number(localStorage.getItem(NEXT_ID_KEY) || users.length + 1);

// Save first, then update memory, so a failed save never changes the array.
function save(updatedUsers) {
  localStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers));
  users = updatedUsers;
}

module.exports = {
  findByUsername: (username) => users.find((u) => u.username === username),
  findById: (id) => users.find((u) => u.id === id),
  findByRefreshToken: (token) => users.find((u) => u.refresh_token === token),

  create: ({ username, hashed_password, role }) => {
    const user = {
      id: nextId,
      username,
      hashed_password,
      role,
      refresh_token: null,
      created_at: new Date().toISOString(),
      revoked_at: null,
    };
    localStorage.setItem(NEXT_ID_KEY, String(nextId + 1));
    nextId++;
    save([...users, user]);
    return user;
  },

  update: (id, changes) => {
    const updatedUsers = users.map((u) => (u.id === id ? { ...u, ...changes } : u));
    save(updatedUsers);
    return updatedUsers.find((u) => u.id === id);
  },
};
