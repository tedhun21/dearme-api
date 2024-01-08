/**
 * quote controller
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::quote.quote",
  ({ strapi }) => ({
    // 명언 조회
    async find(ctx) {
      try {
        const quotes = await strapi.entityService.findMany("api::quote.quote", {
          populate: { image: true },
        });

        return quotes;
      } catch (error) {
        ctx.throw("존재하지 않는 명언입니다");
      }
    },
  })
);
