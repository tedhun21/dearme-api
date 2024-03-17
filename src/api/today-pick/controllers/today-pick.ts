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
