/**
 * diary router
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreRouter("api::diary.diary");

module.exports = {
  routes: [
    // 일기 조회
    {
      method: "GET",
      path: "/diaries",
      handler: "diary.find",
    },
    // 일기 생성
    {
      method: "POST",
      path: "/diaries",
      handler: "diary.create",
    },
    // 일기 수정
    { method: "PUT", path: "/diaries", handler: "diary.update" },
    // 일기 삭제
    {
      method: "DELETE",
      path: "/diaries",
      handler: "diary.delete",
    },
  ],
};
