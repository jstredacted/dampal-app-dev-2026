// The frontend pages are served by the Blog API (a different port), so the browser
// only lets them call the Auth Server if it allows that page's address (CORS).
module.exports = function cors(req, res, next) {
  const allowedOrigin = `http://127.0.0.1:${process.env.BLOG_PORT || 5000}`;

  if (req.headers.origin === allowedOrigin) {
    res.set("Access-Control-Allow-Origin", allowedOrigin);
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.set("Vary", "Origin");
  }

  // The browser sends an OPTIONS "preflight" request before a JSON POST
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
};
