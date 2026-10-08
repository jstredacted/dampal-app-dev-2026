// In-memory "database" for demo purposes. Data resets when the server restarts.
// Swap this file for MongoDB/Postgres later; the controllers won't need to change much.
const users = [];
let nextId = 1;

module.exports = {
  findByEmail: (email) => users.find((u) => u.email === email),
  findById: (id) => users.find((u) => u.id === id),
  findAll: () => users,
  create: ({ username, email, bio, passwordHash }) => {
    const user = { id: nextId++, username, email, bio, passwordHash };
    users.push(user);
    return user;
  },
};
