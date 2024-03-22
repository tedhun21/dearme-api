export default {
  routes: [
    {
      method: "GET",
      path: "/posts/findOnGoal",
      handler: "post.findOnGoal",
    },
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
    {
      method: "GET",
      path: "/posts/:postId/likeship",
      handler: "post.likeShip",
    },
  ],
};
