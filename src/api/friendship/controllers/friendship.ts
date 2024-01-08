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
                { friend_confirm: ctx.state.user.id },
                { friend_request: ctx.state.user.id },
                { block: ctx.state.user.id },
                { blocked_by: ctx.state.user.id },
                { friend_confirm: +ctx.query.friendId },
                { friend_request: +ctx.query.friendId },
                { block: +ctx.query.friendId },
                { blocked_by: +ctx.query.friendId },
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
      //console.log(ctx.state.user);
      console.log(ctx.query);
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
  })
);
