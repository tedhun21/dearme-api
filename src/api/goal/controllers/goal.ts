/**
 * goal controller
 */

import { Strapi, factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::goal.goal",
  ({ strapi }: { strapi: Strapi }) => ({
    // 목표 조회 (특정 목표 id)
    // query로 그 날짜 사이에 있는 목표만 보여주기
    async find(ctx) {
      const { date } = ctx.query;
      const { userId } = ctx.query;

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
          startDate: { $lte: date },
          endDate: { $gte: date },
        };
      }

      try {
        const goals = await strapi.entityService.findMany("api::goal.goal", {
          sort: { endDate: "asc" },
          filters,
        });

        // const modifiedGoals = (goals as any).map((goal) => ({
        //   id: goal.id,
        //   title: goal.title,
        //   body: goal.body,
        //   startDate: goal.startDate,
        //   endDate: goal.endDate,
        //   createdAt: goal.createdAt,
        //   private: goal.private,
        // }));

        return ctx.send(goals);
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

        return ctx.send(newGoal);
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

        const modifiedUpdatedGoal = {
          id: updatedGoal.id,
          title: updatedGoal.title,
          body: updatedGoal.body,
          startDate: updatedGoal.startDate,
          endDate: updatedGoal.endDate,
          createdAt: updatedGoal.createdAt,
          private: updatedGoal.private,
        };

        return ctx.send(modifiedUpdatedGoal);
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
          goalId: deletedGoal.id,
        });
      } catch (e) {
        return ctx.badRequest("Fail to delete the goal");
      }
    },

    // 목표 검색
    async search(ctx) {
      const { searchTerm } = ctx.query;

      try {
        const goals = await strapi.entityService.findMany("api::goal.goal", {
          filters: {
            title: { $containsi: searchTerm },
            private: false,
          },
        });

        // 중복 제거
        const uniqueTitles = new Set();
        const uniqueGoals = [];

        for (const goal of goals as any) {
          // 배열에 있으면 안 넣고 없으면 넣기
          if (!uniqueTitles.has(goal.title)) {
            uniqueTitles.add(goal.title);
            uniqueGoals.push(goal);
          }
        }

        const modifiedGoalsPromises = uniqueGoals.map(async (goal) => {
          const posts = await strapi.entityService.findPage("api::post.post", {
            filters: {
              goal: { title: { $eq: goal.title } },
              private: false,
            },
          });

          return {
            id: goal.id,
            title: goal.title,
            postsCount: posts.pagination.total,
          };
        });

        const modifiedGoals = await Promise.all(modifiedGoalsPromises);

        return ctx.send(modifiedGoals);
      } catch (e) {
        return ctx.badRequest("Fail to search goals");
      }
    },
  })
);
