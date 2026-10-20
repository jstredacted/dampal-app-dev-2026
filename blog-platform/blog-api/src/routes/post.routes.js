const router = require("express").Router();
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const {
  getPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  getMyPosts,
} = require("../controllers/post.controller");

// authenticate is added per route, because the two GET /posts routes are public
router.get("/posts", getPosts);                                                // public
router.get("/posts/:id", getPost);                                             // public
router.post("/posts", authenticate, authorize("author", "admin"), createPost); // author, admin
router.put("/posts/:id", authenticate, authorize("author", "admin"), updatePost); // owner or admin (checked in controller)
router.delete("/posts/:id", authenticate, authorize("admin"), deletePost);     // admin
router.get("/me/posts", authenticate, getMyPosts);                             // any logged-in user

module.exports = router;
