const router = require("express").Router();
const { register, login } = require("../controllers/auth.controller");

router.post("/register", register); // POST /api/auth/register
router.post("/login", login);       // POST /api/auth/login

module.exports = router;
