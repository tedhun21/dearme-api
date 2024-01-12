/**
 * goal controller
 */

import { Strapi, factories } from "@strapi/strapi";
import { errors } from "@strapi/utils";
const { UnauthorizedError, ForbiddenError } = errors;

export default factories.createCoreController(
  "api::goal.goal",
  ({ strapi }: { strapi: Strapi }) => ({
    // 목표 조회 (특정 목표 id)
    // 1. 한 유저의 목표들 모두 보여주기
    // query로 그 날짜 사이에 있는 애만 보여주기
    async find(ctx) {
      const { date } = ctx.query;
      const { userId, page, size } = ctx.query;

      console.log(date);
      let filters;

      if (date) {
        filters = {
          user: { id: userId },
          startDate: { $lte: date },
          endDate: { $gte: date },
        };
      } else {
        filters = {
          user: { id: userId },
        };
      }
      try {
        const goals = await strapi.entityService.findPage("api::goal.goal", {
          filters,
          page,
          pageSize: size,
        });

        return ctx.send(goals);
      } catch (e) {
        return ctx.badRequest("Failed to find goals.");
      }
    },

    // 목표 생성
    async create(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid.");
      }

      const { id: userId } = ctx.state.user;

      try {
        const newGoal = await strapi.entityService.create("api::goal.goal", {
          data: {
            ...ctx.request.body,
            user: { id: userId },
          },
        });

        return ctx.send("Successfully created a goal.");
      } catch (e) {
        return ctx.badRequest("Failed to create a goal.");
      }
    },

    // 목표 수정
    async update(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid.");
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
          return ctx.forbidden("This goal is not owned by you.");
        }

        const updatedGoal = await strapi.entityService.update(
          "api::goal.goal",
          goalId,
          { data: { ...ctx.request.body } }
        );

        return ctx.send("Successfully updated a goal.");
      } catch (e) {
        return ctx.badRequest("Failed to update a goal.");
      }
    },

    // 목표 삭제
    async delete(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid.");
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
          return ctx.forbidden("No permission to delete this goal.");
        }

        const deletedGoal = await strapi.entityService.delete(
          "api::goal.goal",
          ctx.params.id
        );
        return ctx.send("Successfully deleted a goal.");
      } catch (e) {
        return ctx.badRequest("Failed to delete a goal.");
      }
    },
  })
);
