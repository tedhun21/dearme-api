module.exports = {
  routes: [
    // 관계 업데이트
    { method: "PUT", path: "/friendships", handler: "friendship.update" },
    // 친구 관계 삭제
    { method: "DELETE", path: "/friendships", handler: "friendship.delete" },
    // 유저의 친구 확인
    {
      method: "GET",
      path: "/friendships/friend",
      handler: "friendship.findFriend",
    },
    {
      method: "GET",
      path: "/friendships/request",
      handler: "friendship.findRequest",
    },
    {
      method: "GET",
      path: "/friendships/friendandblock",
      handler: "friendship.findFriendAndBlock",
    },
  ],
};
