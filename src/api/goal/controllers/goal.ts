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

        const modifiedGoals = (goals as any).map((goal) => ({
          id: goal.id,
          title: goal.title,
          body: goal.body,
          startDate: goal.startDate,
          endDate: goal.endDate,
          createdAt: goal.createdAt,
          isPublic: goal.isPublic,
        }));

        return ctx.send(modifiedGoals);
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
          isPublic: updatedGoal.isPublic,
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
      interface Goal {
        title: string;
        postsCount: number;
        postsData?: any[];
      }

      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid");
      }

      const { searchTerm, posts } = ctx.query;

      try {
        const whereCondition =
          posts === "true" ? { $eq: searchTerm } : { $containsi: searchTerm };

        const goals = await strapi.db.query("api::goal.goal").findMany({
          populate: {
            posts: {
              populate: {
                photo: true,
              },
              where: {
                public: { $eq: true },
              },
            },
          },
          where: {
            title: whereCondition,
          },
        });

        const searchedGoals: Goal[] = goals.reduce((result, goal) => {
          const existingGoal = result.find((g) => g.title === goal.title);
          if (existingGoal) {
            existingGoal.postsCount += goal.posts.length;
            if (posts === "true")
              existingGoal.postsData = goal.posts.map((post) => ({
                postId: post.id,
                photo: post.photo,
              }));
          } else {
            const newGoal: Goal = {
              title: goal.title,
              postsCount: goal.posts.length,
            };

            if (posts === "true")
              newGoal.postsData = goal.posts.map((post) => ({
                postId: post.id,
                photo: post.photo,
              }));
            result.push(newGoal);
          }
          return result;
        }, []);

        let responseData = { searchedGoals };

        return ctx.send(responseData);
      } catch (e) {
        return ctx.badRequest("Fail to search goals");
      }
    },
  })
);
