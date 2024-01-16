/**
 * todo controller
 */

import { Strapi, factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::todo.todo",
  ({ strapi }: { strapi: Strapi }) => ({
    // todo 전체 조회 (query date & jwt)
    async find(ctx) {
      const { date, page, size } = ctx.query;

      let todos;
      // query (date & jwt)
      if (date && ctx.state.user) {
        todos = await strapi.entityService.findPage("api::todo.todo", {
          sort: { id: "desc" },
          populate: { user: { fields: ["username"] } },
          filters: {
            date,
            user: { id: ctx.state.user.id },
          },
          page,
          pageSize: size,
        });

        // query date
      } else if (date) {
        todos = await strapi.entityService.findPage("api::todo.todo", {
          sort: { id: "desc" },
          populate: { user: { fields: ["username"] } },
          filters: {
            date: ctx.request.query.date,
          },
        });
        // query jwt
      } else if (ctx.state.user) {
        todos = await strapi.entityService.findPage("api::todo.todo", {
          sort: { id: "desc" },
          populate: { user: { fields: ["username"] } },
          filters: {
            user: { id: ctx.state.user.id },
          },
        });

        // jwt 안쓰고 그냥 최신순으로 가져오기
      } else {
        console.log("hi");
        todos = await strapi.entityService.findPage("api::todo.todo", {
          sort: { id: "desc" },
          populate: { user: { fields: ["username"] } },
          page,
          pageSize: size,
        });
      }

      const modifiedTodos = todos.results.map((todo) => ({
        id: todo.id,
        date: todo.date,
        body: todo.body,
        done: todo.done,
        public: todo.public,
        user: todo.user,
      }));

      return ctx.send({ result: modifiedTodos, pagination: todos.pagination });
    },

    // todo 생성 (jwt 필요)
    async create(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid.");
      }

      const { id: userId } = ctx.state.user;

      try {
        const newTodo = await strapi.entityService.create("api::todo.todo", {
          data: {
            ...ctx.request.body,
            user: userId,
          },
        });

        return ctx.send("Successfully created a todo.");
      } catch (e) {
        return ctx.badRequest("Failed to create a todo.");
      }
    },

    // todo 수정 (jwt 필요)
    async update(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid.");
      }

      const { id: userId } = ctx.state.user;
      const { id: todoId } = ctx.params;

      try {
        const todo = await strapi.entityService.findOne(
          "api::todo.todo",
          todoId,
          {
            populate: { user: { fields: ["username"] } },
          }
        );

        if (!todo || (todo.user as any).id !== userId) {
          return ctx.badRequest(
            "Only the owner of this todo can make modifications."
          );
        }

        const updatedTodo = await strapi.entityService.update(
          "api::todo.todo",
          todoId,
          { data: { ...ctx.request.body } }
        );

        return ctx.send("Update Todo Success");
      } catch (e) {
        console.log(e);
      }
    },

    // todo 삭제 (jwt 필요)
    async delete(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid.");
      }

      const { id: userId } = ctx.state.user;
      const { id: todoId } = ctx.params;

      try {
        const user = await strapi.entityService.findOne(
          "plugin::users-permissions.user",
          userId,
          { populate: { todos: { fields: ["id"] } } }
        );

        const todo = await strapi.entityService.findOne(
          "api::todo.todo",
          todoId,
          { populate: { user: { fields: ["id"] } } }
        );

        if (!todo || (todo.user as any).id !== userId) {
          return ctx.badRequest(
            "Todo does not exist or you are not the owner of the todo."
          );
        }

        const deleteTodo = await strapi.entityService.delete(
          "api::todo.todo",
          todoId
        );

        return ctx.send("Successfully deleted a todo.");
      } catch (e) {
        return ctx.badRequest("Failed to delete a todo.");
      }
    },
  })
);
