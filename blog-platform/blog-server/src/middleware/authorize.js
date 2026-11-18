// Usage: authorize("author", "admin"). Runs after authenticate has set req.user.
module.exports = function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "You do not have permission to do this" });
    }
    next();
  };
};
