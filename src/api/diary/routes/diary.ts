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
    { method: "PUT", path: "/diaries/:diaryId", handler: "diary.update" },

    // 일기 삭제
    {
      method: "DELETE",
      path: "/diaries/:diaryId",
      handler: "diary.delete",
    },

    // 일기 검색
    {
      method: "GET",
      path: "/search-diaries",
      handler: "diary.search",
    },
  ],
};
