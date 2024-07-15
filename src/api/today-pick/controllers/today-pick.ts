/**
 * today-pick controller
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::today-pick.today-pick",
  ({ strapi }) => ({
    async create(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid");
      }

      const parsedData = JSON.parse(ctx.request.body.data);

      // 날짜 형식 검증(YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(parsedData.date)) {
        return ctx.badRequest("Invalid format. Please use YYYY-MM-DD.");
      }

      const { image } = ctx.request.files;

      let data = {
        data: {
          diary: { id: parsedData.diaryId },
          ...parsedData,
        },
        files: image ? { image } : null,
      };

      const newPick = await strapi.entityService.create(
        "api::today-pick.today-pick",
        data
      );

      return ctx.send(newPick);
    },
  })
);
