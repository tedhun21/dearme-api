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
        throw new UnauthorizedError("Permission denied.");
      }
      if (!ctx.query) {
        return ctx.badRequest("friendId is required.");
      }
      try {
        const friendship = await strapi.entityService.findMany(
          "api::friendship.friendship",
          {
            filters: {
              $or: [
                {
                  $and: [
                    { follow_sender: userId },
                    { follow_receiver: +friendId },
                  ],
                },
                {
                  $and: [
                    { follow_receiver: userId },
                    { follow_sender: +friendId },
                  ],
                },
              ],
            },
            populate: {
              follow_receiver: { fields: ["nickname"] },
              follow_sender: { fields: ["nickname"] },
              block: { fields: ["nickname"] },
              blocked: { fields: ["nickname"] },
            },
          }
        );

        let modifiedFriendship;

        if (
          friendship[0].status === "PENDING" ||
          friendship[0].status === "FRIEND"
        ) {
          modifiedFriendship = {
            status: friendship[0].status,
            follow_receiver: friendship[0].follow_receiver,
            follow_sender: friendship[0].follow_sender,
          };
        } else if (
          friendship[0].status === "BLOCK_ONE" ||
          friendship[0].status === "BLOCK_BOTH"
        ) {
          modifiedFriendship = {
            status: friendship[0].status,
            block: friendship[0].block,
            blocked: friendship[0].blocked,
          };
        }

        ctx.send(modifiedFriendship);
      } catch (e) {
        console.log(e);
      }
    },

    // 관계 만들기 (친구 요청)
    // 친분 있으면 못 만들게
    async create(ctx) {
      if (!ctx.state.user) {
        throw new UnauthorizedError("Permission denied.");
      }
      if (!ctx.query) {
        return ctx.badRequest("friendId is required.");
      }
      try {
        const { id: userId, nickname: userNickname } = ctx.state.user;
        const { friendId } = ctx.query;

        // 친분있는지 유무
        const friendship = await strapi.entityService.findMany(
          "api::friendship.friendship",
          {
            filters: {
              $or: [
                {
                  $and: [
                    { follow_sender: userId },
                    { follow_receiver: +friendId },
                  ],
                },
                {
                  $and: [
                    { follow_receiver: userId },
                    { follow_sender: +friendId },
                  ],
                },
              ],
            },
            populate: {
              follow_receiver: { fields: ["nickname"] },
              follow_sender: { fields: ["nickname"] },
              block: { fields: ["nickname"] },
              blocked: { fields: ["nickname"] },
            },
          }
        );

        if (friendship.length !== 0) {
          return ctx.badRequest("Already following this user.");
        }

        const newFriendship = await strapi.entityService.create(
          "api::friendship.friendship",
          {
            data: {
              status: "PENDING",
              follow_receiver: +friendId,
              follow_sender: userId,
            },
          }
        );

        // 친구 신청 알림
        if (newFriendship) {
          const notice = await strapi.entityService.findMany(
            "api::notice.notice",
            {
              filters: {
                sender: userId,
                receiver: +friendId,
              },
            }
          );

          if (notice.length !== 0) {
            return ctx.badRequest("Already sent a follow request.");
          }

          const newNotice = await strapi.entityService.create(
            "api::notice.notice",
            {
              data: {
                body: `${userNickname} sent a friend request.`,
                receiver: +friendId,
                sender: userId,
                event: "FRIEND",
              },
            }
          );

          return ctx.send("Follow request sent.");
        }
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
        throw new UnauthorizedError("Permission denied.");
      }
      if (!ctx.query) {
        return ctx.badRequest("friendId, status are required.");
      }
      try {
        // 친분 유무
        const friendship = await strapi.entityService.findMany(
          "api::friendship.friendship",
          {
            filters: {
              $or: [
                {
                  $and: [
                    { follow_sender: userId },
                    { follow_receiver: +friendId },
                  ],
                },
                {
                  $and: [
                    { follow_receiver: userId },
                    { follow_sender: +friendId },
                  ],
                },
              ],
            },
            populate: {
              follow_receiver: { fields: ["nickname"] },
              follow_sender: { fields: ["nickname"] },
              block: { fields: ["nickname"] },
              blocked: { fields: ["nickname"] },
            },
          }
        );

        if (friendship.length === 0) {
          return ctx.badRequest("No friendship exists.");
        }

        // // pending -> friend
        // // 상대방이 팔로우 요청을 보냈다면 수락 하는 단계 (맞팔)
        if (
          friendship[0].status === "PENDING" &&
          status === "friend" &&
          friendship[0].follow_receiver.id === userId &&
          friendship[0].follow_sender.id === +friendId
        ) {
          try {
            const updatedFriendship = await strapi.entityService.update(
              "api::friendship.friendship",
              friendship[0].id,
              { data: { ...friendship[0], status: "FRIEND" } }
            );
          } catch (e) {
            ctx.badRequest(
              "Failed to update friendship. Invalid date or missing required fields."
            );
          }

          // friend -> block
          // 친구 중 상태에서 한명이 block할때
        } else if (
          friendship[0].status === "FRIEND" ||
          (friendship[0].status === "BLOCK_ONE" && status === "block")
        ) {
          try {
            const updatedFriendship = await strapi.entityService.update(
              "api::friendship.friendship",
              friendship[0].id,
              {
                data: {
                  ...friendship[0],
                  status:
                    friendship[0].block.length === 0
                      ? "BLOCK_ONE"
                      : "BLOCK_BOTH",
                  block: { connect: [userId] },
                  blocked: { connect: [+friendId] },
                },
              }
            );
          } catch (e) {
            ctx.badRequest(
              "Failed to update friendship. Invalid date or missing required fields."
            );
          }

          // block -> friend
          // block 해제
        } else if (
          friendship[0].status === "BLOCK_ONE" ||
          (friendship[0].status === "BLOCK_BOTH" && status === "friend")
        ) {
          try {
            const updatedFriendship = await strapi.entityService.update(
              "api::friendship.friendship",
              friendship[0].id,

              {
                data: {
                  ...friendship[0],
                  status:
                    friendship[0].status === "BLOCK_BOTH"
                      ? "BLOCK_ONE"
                      : "FRIEND",
                  block: {
                    disconnect: [userId],
                  },
                  blocked: {
                    disconnect: [+friendId],
                  },
                },
              }
            );
          } catch (e) {
            ctx.badRequest(
              "Failed to update friendship. Invalid date or missing required fields."
            );
          }
        } else {
          return ctx.badRequest("Failed to update friendship");
        }

        ctx.send("Update Friendship Success");
      } catch (e) {
        return ctx.badRequest("Failed to update friendship");
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
                {
                  $and: [
                    { follow_sender: userId },
                    { follow_receiver: +friendId },
                  ],
                },
                {
                  $and: [
                    { follow_receiver: userId },
                    { follow_sender: +friendId },
                  ],
                },
              ],
            },
            populate: {
              follow_receiver: { fields: ["nickname"] },
              follow_sender: { fields: ["nickname"] },
              block_receiver: { fields: ["nickname"] },
              block_sender: { fields: ["nickname"] },
            },
          }
        );

        if (friendship.length !== 0) {
          const deleteFriendship = await strapi.entityService.delete(
            "api::friendship.friendship",
            friendship[0].id
          );
          return ctx.send(
            `${userId} and ${+friendId}'s friendship has been deleted.`
          );
        }
      } catch (e) {
        console.log(e);
      }
    },
  })
);
