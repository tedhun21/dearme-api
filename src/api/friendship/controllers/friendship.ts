/**
 * friendship controller
 */

import { Strapi, factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::friendship.friendship",
  ({ strapi }: { strapi: Strapi }) => ({
    // 친구 관계 확인
    // jwt & 상대방 user id
    async find(ctx) {
      const { id: userId } = ctx.state.user;
      const { friendId } = ctx.query;

      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid");
      }

      if (!ctx.query) {
        return ctx.badRequest("friendId is required");
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

        if (friendship.length === 0) {
          return ctx.notFound("The friendship cannot be found");
        }

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

        return ctx.send(modifiedFriendship);
      } catch (e) {
        return ctx.badRequest("Fail to find the friendship");
      }
    },

    // 관계 만들기 (친구 요청)
    // 친분 있으면 못 만들게
    async create(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid");
      }

      if (!ctx.query) {
        return ctx.badRequest("friendId is required");
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
          return ctx.badRequest("The friendship already exists");
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
        // if (newFriendship) {
        //   const notice = await strapi.entityService.findMany(
        //     "api::notice.notice",
        //     {
        //       filters: {
        //         sender: userId,
        //         receiver: +friendId,
        //       },
        //     }
        //   );

        //   if (notice.length !== 0) {
        //     return ctx.badRequest("Already sent a follow request.");
        //   }

        //   const newNotice = await strapi.entityService.create(
        //     "api::notice.notice",
        //     {
        //       data: {
        //         body: `${userNickname} sent a friend request.`,
        //         receiver: +friendId,
        //         sender: userId,
        //         event: "FRIEND",
        //       },
        //     }
        //   );

        //   return ctx.send("Follow request sent.");
        // }

        return ctx.send({
          message: `Successfully create a friendship between ${userId} and ${friendId}`,
          friendshipId: [userId, friendId],
        });
      } catch (e) {
        return ctx.badRequest("Fail to create a friendship");
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
        return ctx.unauthorized("Authentication token is missing or invalid");
      }

      if (!ctx.query) {
        return ctx.badRequest("friendId, status are required");
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
          return ctx.notFound("No friendship exists");
        }

        // pending -> friend
        // 상대방이 팔로우 요청을 보냈다면 수락 하는 단계 (맞팔)
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

            return ctx.send({
              message: `${
                (updatedFriendship.follow_receiver as any).id
              } accept the follow request from ${
                (updatedFriendship.follow_sender as any).id
              }.`,
              friendshipId: updatedFriendship.id,
            });
          } catch (e) {
            return ctx.badRequest("Fail to accept the follow request");
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

            return ctx.send({
              status: 200,
              message: `${(updatedFriendship.block as any).id} block ${
                (updatedFriendship.blocked as any).id
              }.`,
            });
          } catch (e) {
            return ctx.badRequest("Fail to block the friendship.");
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

            return ctx.send({
              status: 200,
              message: `${updatedFriendship.block} unblock ${updatedFriendship.blocked}`,
            });
          } catch (e) {
            return ctx.badRequest("Fail to unblock the friendship.");
          }
        } else {
          return ctx.badRequest("Fail to update friendship.");
        }
      } catch (e) {
        return ctx.badRequest("Fail to update friendship.");
      }
    },

    async delete(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid");
      }

      const { id: userId } = ctx.state.user;
      const { friendId } = ctx.query;

      try {
        // 관계가 이미 있는지 검색
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

        if (friendship.length === 0) {
          return ctx.notFound("No friendship exists");
        }

        const deletedFriendship = await strapi.entityService.delete(
          "api::friendship.friendship",
          friendship[0].id
        );
        return ctx.send({
          message: `${(deletedFriendship.follow_receiver as any).id} and ${
            (deletedFriendship.follow_sender as any).id
          }'s friendship has been deleted`,
        });
      } catch (e) {
        return ctx.badRequest("Fail to delete the friendship");
      }
    },

    // 유저의 친구 찾기
    async findFriend(ctx) {
      const { page, size } = ctx.query;
      const { id: userId } = ctx.state.user;

      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid");
      }

      try {
        const friendships = await strapi.entityService.findPage(
          "api::friendship.friendship",
          {
            sort: { createdAt: "desc" },
            filters: {
              $or: [
                {
                  $and: [{ follow_sender: userId }, { status: "FRIEND" }],
                },
                {
                  $and: [{ follow_receiver: userId }, { status: "FRIEND" }],
                },
                {
                  $and: [{ $not: { block: userId } }, { status: "BLOCK_ONE" }],
                },
              ],
            },

            populate: {
              follow_sender: { fields: ["id"] },
              follow_receiver: { fields: ["id"] },
              block: { fields: ["id"] },
              blocked: { fields: ["id"] },
            },
            page,
            pageSize: size,
          }
        );

        if (friendships.results.length === 0) {
          return ctx.notFound("You have no friend");
        }

        // 친구인 아이디를 배열로
        const friendArray = (friendships) => {
          return friendships.map((friend) => {
            if ((friend.follow_sender as any).id !== userId) {
              return (friend.follow_sender as any).id;
            } else {
              return (friend.follow_receiver as any).id;
            }
          });
        };

        const friends = await strapi.entityService.findPage(
          "plugin::users-permissions.user",
          {
            filters: { id: friendArray(friendships.results) },
            populate: { photo: { fields: ["id", "url"] } },
            page,
            pageSize: size,
          }
        );

        const modifiedFriends = friends.results.map((friend) => ({
          id: friend.id,
          username: friend.username,
          nickname: friend.nickname,
          photo: friend.photo,
        }));

        return ctx.send(modifiedFriends);
      } catch (e) {
        return ctx.badRequest("Fail to find friends");
      }
    },

    // 유저의 친구 요청 찾기
    async findRequest(ctx) {
      const { page, size } = ctx.query;
      const { id: userId } = ctx.state.user;

      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid");
      }

      try {
        const friendships = await strapi.entityService.findPage(
          "api::friendship.friendship",
          {
            filters: {
              follow_receiver: userId,
              status: "PENDING",
            },
            populate: { follow_sender: { fields: ["id"] } },
            page,
            pageSize: size,
          }
        );

        if (friendships.results.length === 0) {
          return ctx.notFound("You have no request");
        }

        const requests = friendships.results.map(
          (friendship) => (friendship.follow_sender as any).id
        );

        const requestUsers = await strapi.entityService.findPage(
          "plugin::users-permissions.user",
          {
            filters: { id: requests },
            populate: { photo: { fields: ["id", "url"] } },
          }
        );

        const modifiedRequestUsers = requestUsers.results.map((user) => ({
          id: user.id,
          username: user.username,
          nickname: user.nickname,
          photo: user.photo,
        }));

        return ctx.send(modifiedRequestUsers);
      } catch (e) {
        return ctx.badRequest("Fail to find request");
      }
    },
  })
);
