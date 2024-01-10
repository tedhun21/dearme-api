/**
 * goal controller
 */

import { Strapi, factories } from "@strapi/strapi";
import { errors } from "@strapi/utils";
const { UnauthorizedError, ForbiddenError } = errors;

export default factories.createCoreController(
  "api::goal.goal",
  ({ strapi }: { strapi: Strapi }) => ({
    // 목표 조회 (특정 id 목표)
    async find(ctx) {
      try {
        const goals = await strapi.entityService.findMany("api::goal.goal", {
          filters: { user: { id: +ctx.query.id } },
        });

        ctx.send(goals);
      } catch (e) {
        console.log(e);
      }
    },

    // 목표 생성
    async create(ctx) {
      if (!ctx.state.user) {
        throw new UnauthorizedError("권한이 없습니다.");
      }

      try {
        const newGoal = await strapi.entityService.create("api::goal.goal", {
          data: {
            ...ctx.request.body,
            user: { id: +ctx.state.user.id },
          },
        });

        ctx.send(newGoal);
      } catch (e) {
        console.log(e);
      }
    },

    // 목표 수정
    async update(ctx) {
      if (!ctx.state.user) {
        throw new UnauthorizedError("권한이 없습니다.");
      }

      try {
        // id에 맞는 goal찾기
        const goal = await strapi.entityService.findOne(
          "api::goal.goal",
          ctx.params.id,
          {
            populate: { user: { fields: "id" } },
          }
        );

        if ((goal.user as any).id !== ctx.state.user.id) {
          throw new ForbiddenError("권한이 없습니다.");
        }

        const updatedGoal = await strapi.entityService.update(
          "api::goal.goal",
          ctx.params.id,
          { data: { ...ctx.request.body } }
        );

        ctx.send("Update Goal Success");
      } catch (e) {
        console.log(e);
      }
    },

    // 목표 삭제
    async delete(ctx) {
      if (!ctx.state.user) {
        throw new UnauthorizedError("권한이 없습니다.");
      }

      try {
        // goal  찾기
        const goal = await strapi.entityService.findOne(
          "api::goal.goal",
          ctx.params.id,
          {
            populate: { user: { fields: "id" } },
          }
        );

        // 타입 에러(업데이트 필요)
        // if (goal.user.id !== ctx.state.user.id) {
        //   throw new ForbiddenError("권한이 없습니다.");
        // }

        // goal 삭제
        const deletedGoal = await strapi.entityService.delete(
          "api::goal.goal",
          ctx.params.id
        );
      } catch (e) {
        console.log(e);
      }
    },
  })
);
