export default {
  routes: [
    {
      method: "PUT",
      path: "/posts/:postId/like",
      handler: "post.like",
    },
    {
      method: "GET",
      path: "/posts/:postId",
      handler: "post.findByPostId",
    },
  ],
};
