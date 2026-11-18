const db = require("../../db");

// Every post is returned with its author's username, joined from the users table
const SELECT_POSTS = `
  SELECT posts.id, posts.author_id, users.username AS author,
         posts.title, posts.content, posts.created_at, posts.updated_at
  FROM posts JOIN users ON users.id = posts.author_id`;

function isBlank(value) {
  return typeof value !== "string" || value.trim() === "";
}

// Ids in the URL must be whole numbers; anything else cannot match a post
function readId(req) {
  return /^\d+$/.test(req.params.id) ? Number(req.params.id) : null;
}

async function findPost(id) {
  if (id === null) return undefined;
  const [rows] = await db.query(`${SELECT_POSTS} WHERE posts.id = ?`, [id]);
  return rows[0];
}

exports.getPosts = async (req, res, next) => {
  try {
    const [rows] = await db.query(`${SELECT_POSTS} ORDER BY posts.created_at DESC, posts.id DESC`);
    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
};

exports.getPost = async (req, res, next) => {
  try {
    const post = await findPost(readId(req));
    if (!post) return res.status(404).json({ error: "Post not found" });

    res.status(200).json(post);
  } catch (err) {
    next(err);
  }
};

exports.createPost = async (req, res, next) => {
  try {
    const { title, content } = req.body || {};
    if (isBlank(title) || isBlank(content)) {
      return res.status(400).json({ error: "Title and content are required" });
    }

    const [result] = await db.query(
      "INSERT INTO posts (author_id, title, content) VALUES (?, ?, ?)",
      [req.user.id, title.trim(), content.trim()] // author_id from the token, never from the body
    );

    res.status(201).json(await findPost(result.insertId));
  } catch (err) {
    // The token is valid but its user no longer exists in the users table
    if (err.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(401).json({ error: "User account no longer exists" });
    }
    next(err);
  }
};

exports.updatePost = async (req, res, next) => {
  try {
    const post = await findPost(readId(req));
    if (!post) return res.status(404).json({ error: "Post not found" });

    // Ownership check: only the post's author or an admin may edit it
    if (post.author_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "You can only edit your own posts" });
    }

    const { title, content } = req.body || {};
    if (title === undefined && content === undefined) {
      return res.status(400).json({ error: "Provide a title or content to update" });
    }
    if ((title !== undefined && isBlank(title)) || (content !== undefined && isBlank(content))) {
      return res.status(400).json({ error: "Title and content cannot be empty" });
    }

    // Only the provided fields change; id and author_id always stay the same
    const newTitle = title !== undefined ? title.trim() : post.title;
    const newContent = content !== undefined ? content.trim() : post.content;
    await db.query("UPDATE posts SET title = ?, content = ? WHERE id = ?", [newTitle, newContent, post.id]);

    res.status(200).json(await findPost(post.id));
  } catch (err) {
    next(err);
  }
};

exports.deletePost = async (req, res, next) => {
  try {
    const post = await findPost(readId(req));
    if (!post) return res.status(404).json({ error: "Post not found" });

    await db.query("DELETE FROM posts WHERE id = ?", [post.id]);
    res.status(200).json({ message: "Post deleted", post });
  } catch (err) {
    next(err);
  }
};

exports.getMyPosts = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `${SELECT_POSTS} WHERE posts.author_id = ? ORDER BY posts.created_at DESC, posts.id DESC`,
      [req.user.id]
    );
    res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
};
