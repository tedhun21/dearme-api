/**
 * friendship router
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreRouter("api::friendship.friendship");

module.exports = {
  routes: [
    // 친구 관계 확인
    { method: "GET", path: "/friendships", handler: "friendship.find" },
    // 친구 관계 생성
    { method: "POST", path: "/friendships", handler: "friendship.create" },
    // 관계 업데이트
    { method: "PUT", path: "/friendships", handler: "friendship.update" },
    // 친구 관계 삭제
    { method: "DELETE", path: "/friendships", handler: "friendship.delete" },
  ],
};
