export default {
  routes: [
    {
      method: "PUT",
      path: "/posts/:postId/like",
      handler: "post.like",
    },
  ],
};
