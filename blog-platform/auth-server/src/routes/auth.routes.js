const router = require("express").Router();
const { register, login, refresh, logout } = require("../controllers/auth.controller");

router.post("/register", register); // POST /register
router.post("/login", login);       // POST /login
router.post("/refresh", refresh);   // POST /refresh
router.post("/logout", logout);     // POST /logout

module.exports = router;
