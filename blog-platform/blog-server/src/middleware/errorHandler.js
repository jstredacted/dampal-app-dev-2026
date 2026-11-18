// Catches anything passed to next(err). Express recognizes it by the 4 arguments.
module.exports = (err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body must be valid JSON" });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server" });
};
