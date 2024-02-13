/**
 * todo controller
 */

import { Strapi, factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::todo.todo",
  ({ strapi }: { strapi: Strapi }) => ({
    // todo 일일 / 월별 조회 (query date & jwt)
    async find(ctx) {
      const { date, userId } = ctx.query;

      let filters;

      // 나의 Todo (date & jwt)
      if (date && ctx.state.user) {
        // 월별 조회
        if (date.length === 7) {
          const startDate = new Date(date + "-01");
          const endDate = new Date(
            new Date(date).setMonth(startDate.getMonth() + 1)
          );
          filters = {
            date: { $gte: startDate, $lt: endDate },
            user: { id: ctx.state.user.id },
          };

          // 일일 조회
        } else {
          filters = { date, user: ctx.state.user.id };
        }

        // 다른 사람의 일일 Todo (data & userId)
      } else if (date && userId) {
        filters = {
          date,
          user: { id: userId },
        };
      }

      try {
        const todos = await strapi.entityService.findMany("api::todo.todo", {
          sort: { priority: "asc" },
          populate: { user: { fields: ["username"] }, priority: true },
          filters,
        });

        const modifiedTodos = (todos as any).map((todo) => ({
          id: todo.id,
          date: todo.date,
          body: todo.body,
          done: todo.done,
          public: todo.public,
          user: todo.user,
          priority: todo.priority,
        }));

        return ctx.send(modifiedTodos);
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
      const { date } = ctx.request.body;

      try {
        const todos = await strapi.entityService.findMany("api::todo.todo", {
          filters: { date, user: { id: userId } },
        });
        // todos 배열로부터 우선순위를 추출하여 새로운 배열을 생성
        const priorities = (todos as any).map((todo) => todo.priority);
        // 배열에서 최대값을 구함
        const maxPriority = Math.max(...priorities);

        const newTodo = await strapi.entityService.create("api::todo.todo", {
          data: {
            ...ctx.request.body,
            user: userId,
            priority: todos.length !== 0 ? maxPriority + 1 : 0,
          },
          populate: { user: { fields: ["id", "nickname"] } },
        });

        const modifiedNewTodo = {
          id: newTodo.id,
          date: newTodo.date,
          body: newTodo.body,
          done: newTodo.done,
          public: newTodo.public,
          user: newTodo.user,
          priority: newTodo.priority,
        };

        return ctx.send(modifiedNewTodo);
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
          {
            data: { ...ctx.request.body },
            populate: { user: { fields: ["id", "nickname"] } },
          }
        );

        return ctx.send({
          id: updatedTodo.id,
          date: updatedTodo.date,
          body: updatedTodo.body,
          done: updatedTodo.done,
          public: updatedTodo.public,
          user: updatedTodo.user,
          priority: updatedTodo.priority,
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
          { populate: { todos: { fields: ["id", "priority"] } } }
        );

        // const todo = await strapi.entityService.findOne(
        //   "api::todo.todo",
        //   todoId,
        //   { populate: { user: { fields: ["id"] } } }
        // );

        // if (!todo || (todo.user as any).id !== user.id) {
        //   return ctx.forbidden("No permission to delete this todo");
        // }

        const deletedTodo = await strapi.entityService.delete(
          "api::todo.todo",
          todoId
        );

        // 삭제된 할 일의 우선순위
        const deletedPriority = deletedTodo.priority;

        // 삭제된 우선순위보다 큰 우선순위를 가진 할 일들의 우선순위를 1씩 감소
        await Promise.all(
          (user.todos as any)
            .filter((todo) => todo.priority > deletedPriority)
            .map(async (todo) => {
              await strapi.entityService.update("api::todo.todo", todo.id, {
                data: { priority: todo.priority - 1 } as any,
              });
            })
        );

        return ctx.send({
          todoId: deletedTodo.id,
        });
      } catch (e) {
        return ctx.badRequest("Fail to delete a todo.");
      }
    },

    // todo 순서 업데이트
    async updatePriority(ctx) {
      const {
        data: { source, destination },
      } = ctx.request.body;
      const { date } = ctx.params;

      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid");
      }

      const { id: userId } = ctx.state.user;
      // 투데이 todo
      try {
        const todos = await strapi.entityService.findMany("api::todo.todo", {
          filters: {
            date,
            user: { id: userId },
          },
        });

        const sourceTodos = (todos as any).filter(
          (todo) => todo.priority === source
        );
        const destinationTodos = (todos as any).filter(
          (todo) => todo.priority === destination
        );

        await Promise.all(
          sourceTodos.map(async (todo) => {
            await strapi.entityService.update("api::todo.todo", todo.id, {
              data: { priority: destination } as any,
            });
          })
        );

        if (destination > source) {
          await Promise.all(
            (todos as any)
              .filter(
                (todo) => todo.priority > source && todo.priority <= destination
              )
              .map(async (todo) => {
                await strapi.entityService.update("api::todo.todo", todo.id, {
                  data: { priority: todo.priority - 1 } as any,
                });
              })
          );
        } else {
          await Promise.all(
            (todos as any)
              .filter(
                (todo) => todo.priority >= destination && todo.priority < source
              )
              .map(async (todo) => {
                await strapi.entityService.update("api::todo.todo", todo.id, {
                  data: { priority: todo.priority + 1 } as any,
                });
              })
          );
        }

        return ctx.send({ message: "Update for priority completed" });
      } catch (error) {
        console.error("Error updating priorities:", error);
        return ctx.badRequest("Failed to update priorities");
      }
    },
  })
);
