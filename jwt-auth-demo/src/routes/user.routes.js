const router = require("express").Router();
const auth = require("../middleware/auth");
const { getMe, getUsers } = require("../controllers/user.controller");

router.get("/me", auth, getMe); // GET /api/users/me (protected)
router.get("/", auth, getUsers); // GET /api/users (protected)

module.exports = router;
