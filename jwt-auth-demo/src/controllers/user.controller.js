const User = require("../models/user.model");

exports.getMe = (req, res) => {
  const user = User.findById(req.user.userId); // req.user was set by the auth middleware
  if (!user) return res.status(404).json({ error: "User not found" });

  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    bio: user.bio,
  }); // never send passwordHash
};

exports.getUsers = (req, res) => {
  const safeUsers = User.findAll().map(({ id, username, email, bio }) => ({
    id,
    username,
    email,
    bio,
  }));

  res.json(safeUsers); // never send passwordHash
};
