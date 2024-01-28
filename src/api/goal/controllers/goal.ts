/**
 * goal controller
 */

import { Strapi, factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::goal.goal",
  ({ strapi }: { strapi: Strapi }) => ({
    // 목표 조회 (특정 목표 id)
    // query로 그 날짜 사이에 있는 애만 보여주기
    async find(ctx) {
      const { date } = ctx.query;
      const { userId, page, size } = ctx.query;

      let filters;

      // 1. 나의 Goal 조회 (jwt, date)
      if (ctx.state.user && date) {
        filters = {
          user: { id: ctx.state.user.id },
          startDate: { $lte: date },
          endDate: { $gte: date },
        };
        // 2. 한 유저의 목표 (userId, date)
      } else {
        filters = {
          user: { id: userId },
        };
      }

      try {
        const goals = await strapi.entityService.findPage("api::goal.goal", {
          sort: { endDate: "asc" },
          filters,
          page,
          pageSize: size,
        });

        return ctx.send({
          message: "Successfully find goals",
          data: goals,
        });
      } catch (e) {
        return ctx.badRequest("Fail to find goals");
      }
    },

    // 목표 생성
    async create(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid");
      }

      const { id: userId } = ctx.state.user;

      try {
        const newGoal = await strapi.entityService.create("api::goal.goal", {
          data: {
            ...ctx.request.body,
            user: { id: userId },
          },
        });

        return ctx.send({
          message: "Successfully create a goal",
          goalId: newGoal.id,
        });
      } catch (e) {
        return ctx.badRequest("Fail to create a goal");
      }
    },

    // 목표 수정
    async update(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid");
      }

      const { id: userId } = ctx.state.user;
      const { id: goalId } = ctx.params;

      try {
        // id에 맞는 goal찾기
        const goal = await strapi.entityService.findOne(
          "api::goal.goal",
          goalId,
          {
            populate: { user: { fields: ["id"] } },
          }
        );

        if ((goal.user as any).id !== userId) {
          return ctx.forbidden("No permission to update this goal");
        }

        const updatedGoal = await strapi.entityService.update(
          "api::goal.goal",
          goalId,
          { data: { ...ctx.request.body } }
        );

        return ctx.send({
          message: "Successfully update the goal",
          goalId: updatedGoal.id,
        });
      } catch (e) {
        return ctx.badRequest("Fail to update the goal");
      }
    },

    // 목표 삭제
    async delete(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid");
      }

      const { id: userId } = ctx.state.user;
      const { id: goalId } = ctx.params;
      try {
        // goal  찾기
        const goal = await strapi.entityService.findOne(
          "api::goal.goal",
          goalId,
          {
            populate: { user: { fields: ["id"] } },
          }
        );

        if ((goal.user as any).id !== userId) {
          return ctx.forbidden("No permission to delete this goal");
        }

        const deletedGoal = await strapi.entityService.delete(
          "api::goal.goal",
          ctx.params.id
        );
        return ctx.send({
          message: "Successfully delete the goal",
          goalId: deletedGoal.id,
        });
      } catch (e) {
        return ctx.badRequest("Fail to delete the goal");
      }
    },
  })
);
