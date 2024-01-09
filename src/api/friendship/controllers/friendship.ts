/**
 * friendship controller
 */

import { Strapi, factories } from "@strapi/strapi";
import { errors } from "@strapi/utils";
const { UnauthorizedError } = errors;

export default factories.createCoreController(
  "api::friendship.friendship",
  ({ strapi }: { strapi: Strapi }) => ({
    // 서로 무슨 관계인지
    // jwt & 상대방 user id
    async find(ctx) {
      const { id: userId } = ctx.state.user;
      const { friendId } = ctx.query;

      if (!ctx.state.user) {
        throw new UnauthorizedError("권한이 없습니다.");
      }
      if (!ctx.query) {
        return ctx.badRequest("friendId가 필요합니다.");
      }
      try {
        const friendship = await strapi.entityService.findMany(
          "api::friendship.friendship",
          {
            filters: {
              $or: [
                { friend_confirm: userId },
                { friend_request: userId },
                { block: userId },
                { blocked_by: userId },
                { friend_confirm: +friendId },
                { friend_request: +friendId },
                { block: +friendId },
                { blocked_by: +friendId },
              ],
            },
            populate: {
              friend_confirm: { fields: "id" },
              friend_request: { fields: "id" },
              block: { fields: "id" },
              blocked_by: { fields: "id" },
            },
          }
        );

        let modifiedFriendship;

        if (
          friendship[0].status === "pending" ||
          friendship[0].status === "friend"
        ) {
          modifiedFriendship = {
            status: friendship[0].status,
            friend_confirm: friendship[0].friend_confirm,
            friend_request: friendship[0].friend_request,
          };
        } else if (friendship[0].status === "block") {
          modifiedFriendship = {
            status: friendship[0].status,
            block: friendship[0].block,
            blocked_by: friendship[0].blocked_by,
          };
        }

        ctx.send(modifiedFriendship);
      } catch (e) {
        console.log(e);
      }
    },

    // 관계 만들기 (친구 요청)
    async create(ctx) {
      if (!ctx.state.user) {
        return ctx.UnauthorizedError("권한이 없습니다.");
      }
      if (!ctx.query) {
        return ctx.badRequest("friendId가 필요합니다.");
      }
      try {
        const newFriendship = await strapi.entityService.create(
          "api::friendship.friendship",
          {
            data: {
              status: "pending",
              friend_confirm: ctx.state.user.id,
              friend_request: ctx.query.friendId,
            },
          }
        );

        ctx.send("친구 요청을 보냈습니다.");
      } catch (e) {
        console.log(e);
      }
    },

    // 관계 업데이트
    // (pending -> friend)
    // (friend -> block)
    // (block -> friend)
    async update(ctx) {
      const { id: userId } = ctx.state.user;
      const { friendId, status } = ctx.query;

      if (!ctx.state.user) {
        throw new UnauthorizedError("권한이 없습니다.");
      }
      if (!ctx.query) {
        return ctx.badRequest("friendId, status가 필요합니다.");
      }
      try {
        const friendship = await strapi.entityService.findMany(
          "api::friendship.friendship",
          {
            filters: {
              $or: [
                { friend_confirm: userId },
                { friend_request: userId },
                { block: userId },
                { blocked_by: userId },
                { friend_confirm: +friendId },
                { friend_request: +friendId },
                { block: +friendId },
                { blocked_by: +friendId },
              ],
            },
            populate: {
              friend_confirm: { fields: "id" },
              friend_request: { fields: "id" },
              block: { fields: "id" },
              blocked_by: { fields: "id" },
            },
          }
        );

        // pending -> friend
        if (friendship[0].status === "pending" && status === "friend") {
          const updatedFriendship = await strapi.entityService.update(
            "api::friendship.friendship",
            friendship[0].id
            // 상상코딩
            // { data: { status: "friend" } }
          );
          // friend -> block
        } else if (friendship[0].status === "friend" && status === "block") {
          const updatedFriendship = await strapi.entityService.update(
            "api::friendship.friendship",
            friendship[0]
            // 상상코딩
            // {
            //   data: {

            // status: "block",
            // block: { connect: [{ id: userId }] },
            // blocked_by: { connect: [{ id: +friendId }] },
            //   },
            // }
          );

          // block -> friend
        } else if (friendship[0].status === "block" && status === "friend") {
          const updatedFriendship = await strapi.entityService.update(
            "api::friendship.friendship",
            friendship[0].id
            // 상상 코딩
            // {
            //   data: {
            //     status: "friend",
            //     block: { disconnect: [{ id: userId }, { id: +friendId }] },
            //     blocked_by: { disconnect: [{ id: userId }, { id: +friendId }] },
            //   },
            // }
          );
        }

        ctx.send("Update Friendship Success");
      } catch (e) {
        console.log(e);
      }
    },

    async delete(ctx) {
      const { id: userId } = ctx.state.user;
      const { friendId } = ctx.query;
      try {
        const friendship = await strapi.entityService.findMany(
          "api::friendship.friendship",
          {
            filters: {
              $or: [
                { friend_confirm: userId },
                { friend_request: userId },
                { block: userId },
                { blocked_by: userId },
                { friend_confirm: +friendId },
                { friend_request: +friendId },
                { block: +friendId },
                { blocked_by: +friendId },
              ],
            },
          }
        );

        const deleteFriendship = await strapi.entityService.delete(
          "api::friendship.friendship",
          friendship[0].id
        );

        ctx.send(`${userId}와 ${+friendId}의 친구 관계가 삭제 되었습니다.`);
      } catch (e) {
        console.log(e);
      }
    },
  })
);
