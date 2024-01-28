/**
 * todo controller
 */

import { Strapi, factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::todo.todo",
  ({ strapi }: { strapi: Strapi }) => ({
    // todo 전체 조회 (query date & jwt)
    async find(ctx) {
      const { date, userId, page, size } = ctx.query;

      let filters;

      // 나의 일일 Todo (date & jwt)
      if (date && ctx.state.user) {
        filters = {
          date,
          user: { id: ctx.state.user.id },
        };

        // 다른 사람의 Todo (data & userId)
      } else if (date && userId) {
        filters = {
          date: ctx.request.query.date,
          user: { id: userId },
        };
      }

      try {
        const todos = await strapi.entityService.findPage("api::todo.todo", {
          sort: { id: "desc" },
          populate: { user: { fields: ["username"] } },
          filters,
          page,
          pageSize: size,
        });

        const modifiedTodos = todos.results.map((todo) => ({
          id: todo.id,
          date: todo.date,
          body: todo.body,
          done: todo.done,
          public: todo.public,
          user: todo.user,
        }));

        return ctx.send({
          results: modifiedTodos,
          pagination: todos.pagination,
          message: "Successfully find todos",
        });
      } catch (e) {
        return ctx.badRequest("Fail to find todos.");
      }
    },

    // todo 생성 (jwt 필요)
    async create(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid");
      }

      const { id: userId } = ctx.state.user;

      try {
        const newTodo = await strapi.entityService.create("api::todo.todo", {
          data: {
            ...ctx.request.body,
            user: userId,
          },
        });

        return ctx.send({
          message: "Successfully create a todo",
          todoId: newTodo.id,
        });
      } catch (e) {
        return ctx.badRequest("Fail to create a todo");
      }
    },

    // todo 수정 (jwt 필요)
    async update(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid");
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
          return ctx.forbidden("No permission to update this todo");
        }

        const updatedTodo = await strapi.entityService.update(
          "api::todo.todo",
          todoId,
          { data: { ...ctx.request.body } }
        );

        return ctx.send({
          message: "Successfully update a user",
          todoId: updatedTodo.id,
        });
      } catch (e) {
        return ctx.badRequest("Fail to update a user");
      }
    },

    // todo 삭제 (jwt 필요)
    async delete(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid");
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

        if (!todo || (todo.user as any).id !== user.id) {
          return ctx.forbidden("No permission to delete this todo");
        }

        const deletedTodo = await strapi.entityService.delete(
          "api::todo.todo",
          todoId
        );

        return ctx.send({
          message: "Successfully delete a todo",
          todoId: deletedTodo.id,
        });
      } catch (e) {
        return ctx.badRequest("Fail to delete a todo.");
      }
    },
  })
);
