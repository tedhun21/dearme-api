/**
 * todo controller
 */

import { Strapi, factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::todo.todo",
  ({ strapi }: { strapi: Strapi }) => ({
    // todo 전체 조회 (query date & jwt)
    async find(ctx) {
      let todos;

      // query (date & jwt)
      if (ctx.request.query.date && ctx.state.user) {
        todos = await strapi.entityService.findPage("api::todo.todo", {
          sort: { id: "desc" },
          populate: { user: { fields: ["username"] } },
          filters: {
            date: ctx.request.query.date,
            user: { id: ctx.state.user.id },
          },
        });

        // query date
      } else if (ctx.request.query.date) {
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

    // todo 생성 (jwt 필요)
    async create(ctx) {
      if (!ctx.state.user) {
        return ctx.badRequest("권한이 없습니다.");
      } else {
        try {
          const newTodo = await strapi.entityService.create("api::todo.todo", {
            data: {
              ...ctx.request.body,
              user: ctx.state.user.id,
            },
          });

          ctx.send("Create Todo Success");
        } catch (e) {
          console.log(e);
        }
      }
    },

    // todo 수정 (jwt 필요)
    async update(ctx) {
      if (!ctx.state.user) {
        ctx.badRequest("권한이 없습니다");
      }
      try {
        const { id: todoId } = ctx.params;

        const todo = await strapi.entityService.findOne(
          "api::todo.todo",
          todoId,
          {
            populate: { user: { fields: ["username"] } },
          }
        );

        // if (!todo || !todo.user || !todo.user.id) {
        //   return ctx.badRequest("권한이 없습니다");
        // }

        const updatedTodo = await strapi.entityService.update(
          "api::todo.todo",
          todoId,
          { data: { ...ctx.request.body } }
        );

        ctx.send("Update Todo Success");
      } catch (e) {
        console.log(e);
      }
    },

    // todo 삭제 (jwt 필요)
    async delete(ctx) {
      if (!ctx.state.user) {
        ctx.badRequest("권한이 없습니다");
      }

      try {
        const user = await strapi.entityService.findOne(
          "plugin::users-permissions.user",
          ctx.state.user.id,
          { populate: { todos: { fields: ["id"] } } }
        );

        console.log(user.todos);

        const { id: todoId } = ctx.params;
        console.log(typeof todoId);

        const deleteTodo = await strapi.entityService.delete(
          "api::todo.todo",
          todoId
        );

        ctx.send("Delete Todo Success");
      } catch (e) {
        console.log(e);
      }
    },
  })
);
