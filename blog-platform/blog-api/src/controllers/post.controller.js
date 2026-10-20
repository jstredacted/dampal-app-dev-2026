const Post = require("../models/post.model");

function isBlank(value) {
  return typeof value !== "string" || value.trim() === "";
}

exports.getPosts = (req, res) => {
  res.status(200).json(Post.findAll());
};

exports.getPost = (req, res) => {
  const post = Post.findById(Number(req.params.id));
  if (!post) return res.status(404).json({ error: "Post not found" });

  res.status(200).json(post);
};

exports.createPost = (req, res, next) => {
  try {
    const { title, content } = req.body || {};
    if (isBlank(title) || isBlank(content)) {
      return res.status(400).json({ error: "Title and content are required" });
    }

    const post = Post.create({
      user_id: req.user.id, // from the token, never from the request body
      title: title.trim(),
      content: content.trim(),
    });

    res.status(201).json(post);
  } catch (err) {
    next(err);
  }
};

exports.updatePost = (req, res, next) => {
  try {
    const post = Post.findById(Number(req.params.id));
    if (!post) return res.status(404).json({ error: "Post not found" });

    // Ownership check: only the post's author or an admin may edit it
    if (post.user_id !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "You can only edit your own posts" });
    }

    const { title, content } = req.body || {};
    if (title === undefined && content === undefined) {
      return res.status(400).json({ error: "Provide a title or content to update" });
    }
    if ((title !== undefined && isBlank(title)) || (content !== undefined && isBlank(content))) {
      return res.status(400).json({ error: "Title and content cannot be empty" });
    }

    // Only the provided fields change; id and user_id always stay the same
    const changes = {};
    if (title !== undefined) changes.title = title.trim();
    if (content !== undefined) changes.content = content.trim();

    res.status(200).json(Post.update(post.id, changes));
  } catch (err) {
    next(err);
  }
};

exports.deletePost = (req, res, next) => {
  try {
    const post = Post.findById(Number(req.params.id));
    if (!post) return res.status(404).json({ error: "Post not found" });

    Post.remove(post.id);
    res.status(200).json({ message: "Post deleted", post });
  } catch (err) {
    next(err);
  }
};

exports.getMyPosts = (req, res) => {
  res.status(200).json(Post.findByAuthor(req.user.id));
};
