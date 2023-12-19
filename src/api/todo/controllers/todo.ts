/**
 * todo controller
 */

import { Strapi, factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::todo.todo",
  ({ strapi }: { strapi: Strapi }) => ({
    // todo 전체 조회
    async find(ctx) {
      let todos;

      if (ctx.request.query.date && ctx.state.user) {
        todos = await strapi.entityService.findPage("api::todo.todo", {
          sort: { id: "desc" },
          populate: { user: { fields: ["username"] } },
          filters: {
            date: ctx.request.query.date,
            user: { id: ctx.state.user.id },
          },
        });
      } else if (ctx.request.query.date) {
        todos = await strapi.entityService.findPage("api::todo.todo", {
          sort: { id: "desc" },
          populate: { user: { fields: ["username"] } },
          filters: {
            date: ctx.request.query.date,
            user: { id: ctx.state.user.id },
          },
        });
      } else if (ctx.states.user) {
        todos = await strapi.entityService.findPage("api::todo.todo", {
          sort: { id: "desc" },
          populate: { user: { fields: ["username"] } },
          filters: {
            user: { id: ctx.state.user.id },
          },
        });
      } else {
        todos = await strapi.entityService.findPage("api::todo.todo", {
          sort: { id: "desc" },
          populate: { user: { fields: ["username"] } },
        });
      }

      const modifiedTodos = todos.results.map((todo) => ({
        id: todo.id,
        body: todo.body,
        date: todo.date,
        user: todo.user,
      }));

      ctx.send({ result: modifiedTodos, pagination: todos.pagination });
    },
  })
);
