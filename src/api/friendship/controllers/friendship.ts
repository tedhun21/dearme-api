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
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid");
      }

      if (!ctx.query) {
        return ctx.badRequest("friendId is required");
      }
      const { id: userId } = ctx.state.user;
      const { friendId } = ctx.query;

      try {
        const friendship = await strapi.entityService.findMany(
          "api::friendship.friendship",
          {
            filters: {
              $or: [
                {
                  follow_sender: userId,
                  follow_receiver: +friendId,
                },
                {
                  follow_receiver: userId,
                  follow_sender: +friendId,
                },
              ],
            },
            populate: {
              follow_receiver: { fields: ["nickname"] },
              follow_sender: { fields: ["nickname"] },
              block: { fields: ["id", "nickname"] },
              blocked: { fields: ["nickname"] },
            },
          }
        );

        if (friendship.length === 0) {
          return ctx.send({ status: "NOTHING" });
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
                  follow_sender: userId,
                  follow_receiver: +friendId,
                },
                {
                  follow_receiver: userId,
                  follow_sender: +friendId,
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
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid");
      }

      if (!ctx.query.friendId) {
        return ctx.badRequest("friendId, status are required");
      }

      const { friendId, status } = ctx.query;
      const { id: userId } = ctx.state.user;

      try {
        // 친분 유무
        const friendship = await strapi.entityService.findMany(
          "api::friendship.friendship",
          {
            filters: {
              $or: [
                {
                  follow_sender: userId,
                  follow_receiver: +friendId,
                },
                {
                  follow_receiver: userId,
                  follow_sender: +friendId,
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

        // 친분 x -> 친구 요청 (request)
        if (friendship.length === 0 && status === "request") {
          try {
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

            return ctx.send({
              message: `Successfully create a friendship between ${userId} and ${friendId}`,
              friendshipId: newFriendship.id,
              relation: [+userId, +friendId],
            });
          } catch (e) {
            return ctx.badRequest("Fail to send the follow request");
          }
        }

        // 요청 취소 (cancel)
        if (
          friendship[0].status === "PENDING" &&
          status === "requestCancel" &&
          friendship[0].follow_sender.id === userId &&
          friendship[0].follow_receiver.id === +friendId
        ) {
          try {
            const deleteFriendship = await strapi.entityService.delete(
              "api::friendship.friendship",
              friendship[0].id,
              {
                populate: {
                  follow_receiver: { fields: ["id"] },
                  follow_sender: { fields: ["id"] },
                },
              }
            );

            return ctx.send({
              message: `receiver: ${
                (deleteFriendship.follow_receiver as any).id
              } and sender: ${
                (deleteFriendship.follow_sender as any).id
              }'s friendship has been deleted`,
            });
          } catch (e) {
            return ctx.badRequest("Fail to follow cancel");
          }
        }

        // pending -> friend (accept)
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
              {
                data: { status: "FRIEND" } as any,
                populate: {
                  follow_sender: {
                    fields: ["id", "username", "nickname"],
                    populate: { photo: { fields: ["id", "url"] } },
                  },
                },
              }
            );

            if (updatedFriendship) {
              const modifiedFriend = {
                id: (updatedFriendship.follow_sender as any).id,
                username: (updatedFriendship.follow_sender as any).username,
                nickname: (updatedFriendship.follow_sender as any).nickname,
                photo: (updatedFriendship.follow_sender as any).photo,
              };

              return ctx.send({
                message: `Successfully accept the follow request from ${modifiedFriend.nickname}`,
                friendshipId: updatedFriendship.id,
                relation: [+userId, +friendId],
                newFriend: modifiedFriend,
              });
            }
          } catch (e) {
            return ctx.badRequest("Fail to accept the follow request");
          }
        }

        // 유저가 block할때
        if (
          (friendship[0].status === "FRIEND" &&
            status === "block" &&
            friendship[0].block.length === 0 &&
            friendship[0].blocked.length === 0) ||
          (friendship[0].status === "BLOCK_ONE" &&
            status === "block" &&
            friendship[0].block.length === 1 &&
            friendship[0].blocked.length === 1)
        ) {
          try {
            const updatedFriendship = await strapi.entityService.update(
              "api::friendship.friendship",
              friendship[0].id,
              {
                data: {
                  ...friendship[0],
                  status:
                    friendship[0].status === "FRIEND"
                      ? "BLOCK_ONE"
                      : "BLOCK_BOTH",
                  block: { connect: [userId] },
                  blocked: { connect: [+friendId] },
                },
                populate: { blocked: { fields: ["id", "nickname"] } },
              }
            );
            if (updatedFriendship) {
              return ctx.send({
                message: `Successfully block ${
                  (updatedFriendship.blocked as any)[0].nickname
                }`,
                blockId: (updatedFriendship.blocked as any)[0].id,
              });
            }
          } catch (e) {
            return ctx.badRequest("Fail to block the friendship.");
          }

          // block -> friend (unblock)
          // block 해제
        }

        // 유저가 unblock할때
        if (
          (friendship[0].status === "BLOCK_ONE" &&
            status === "unblock" &&
            friendship[0].block.length === 1 &&
            friendship[0].blocked.length === 1) ||
          (friendship[0].status === "BLOCK_BOTH" &&
            status === "unblock" &&
            friendship[0].block.length === 2 &&
            friendship[0].blocked.length === 2)
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
              message: `unblocked!`,
              friendshipId: updatedFriendship.id,
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
                  follow_sender: userId,
                  follow_receiver: +friendId,
                },
                {
                  follow_receiver: userId,
                  follow_sender: +friendId,
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

      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid");
      }

      const { id: userId } = ctx.state.user;

      try {
        const friendships = await strapi.entityService.findPage(
          "api::friendship.friendship",
          {
            sort: { createdAt: "desc" },
            filters: {
              $or: [
                {
                  follow_sender: { id: userId },
                  status: "FRIEND",
                },
                {
                  follow_receiver: { id: userId },
                  status: "FRIEND",
                },
                {
                  status: "BLOCK_ONE",
                  $not: { block: { id: userId } },
                },
              ],
            } as any,
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

        // Check if there are no friendships
        if (friendships.results.length === 0) {
          return ctx.send({
            results: [],
            pagination: {
              page: parseInt(page, 10) || 1,
              pageSize: parseInt(size, 10) || 10,
              pageCount: 0,
              total: 0,
            },
          });
        }

        // 친구인 아이디를 배열로
        const friendArray = (friendships) => {
          return friendships.results.map((friend) => {
            if (friend.follow_sender.id !== userId) {
              return friend.follow_sender.id;
            } else {
              return friend.follow_receiver.id;
            }
          });
        };

        const friends = await strapi.entityService.findPage(
          "plugin::users-permissions.user",
          {
            filters: { id: { $in: friendArray(friendships.results) } },
            populate: { photo: { fields: ["id", "url"] } },
            page,
            pageSize: size,
          }
        );

        console.log(friends.results);

        const modifiedFriends = friends.results.map((friend) => ({
          id: friend.id,
          username: friend.username,
          nickname: friend.nickname,
          photo: friend.photo,
          status: "FRIEND",
        }));

        return ctx.send({
          results: modifiedFriends,
          pagination: friends.pagination,
        });
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

        const requests = friendships.results.map(
          (friendship) => (friendship.follow_sender as any).id
        );

        const requestUsers = await strapi.entityService.findPage(
          "plugin::users-permissions.user",
          {
            // filters: { id: requests },
            populate: { photo: { fields: ["id", "url"] } },
          }
        );

        const modifiedRequestUsers = requestUsers.results.map((user) => ({
          id: user.id,
          username: user.username,
          nickname: user.nickname,
          photo: user.photo,
          status: "PENDING",
        }));

        return ctx.send({
          users: modifiedRequestUsers,
          pagination: requestUsers.pagination,
        });
      } catch (e) {
        return ctx.badRequest("Fail to find request");
      }
    },

    // 유저의 친구 + block 찾기(searchParam)
    async findFriendAndBlock(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid");
      }

      const { id: userId } = ctx.state.user;
      const { q, page, size } = ctx.query;

      // 무한 스크롤, 친구 & block 관계인 사람 검색
      // 1. 친구 + block 검색
      // 2. 친구 정보 + friendship 보내기 (friend인지, block한 상태인지만 표시)

      try {
        const friendships = await strapi.entityService.findPage(
          "api::friendship.friendship",
          {
            filters: {
              $or: [
                {
                  follow_sender: { id: userId },
                  status: "FRIEND",
                  follow_receiver: {
                    nickname: { $contains: q || "" },
                  },
                },
                {
                  follow_receiver: { id: userId },
                  status: "FRIEND",
                  follow_sender: {
                    nickname: { $contains: q || "" },
                  },
                },
                {
                  block: { id: userId },
                  status: "BLOCK_ONE",
                  blocked: {
                    nickname: { $contains: q || "" },
                  },
                },
                {
                  block: { id: userId },
                  status: "BLOCK_BOTH",
                  blocked: {
                    nickname: { $contains: q || "" },
                  },
                },
              ],
            } as any,
            page,
            pageSize: size,
            populate: {
              follow_sender: {
                fields: ["id", "username", "nickname"],
                populate: { photo: { fields: ["id", "url"] } },
              },
              follow_receiver: {
                fields: ["id", "username", "nickname"],
                populate: { photo: { fields: ["id", "url"] } },
              },
              blocked: {
                fields: ["id", "username", "nickname"],
                populate: { photo: { fields: ["id", "url"] } },
              },
            },
          }
        );

        const friendAndBlock = friendships.results.map((friendship: any) => {
          if (friendship.status === "FRIEND") {
            if (friendship.follow_sender.id !== userId) {
              const friend = friendship.follow_sender;
              return {
                id: friend?.id,
                username: friend?.username,
                nickname: friend?.nickname,
                photo: friend.photo
                  ? {
                      id: friend?.photo?.id || null,
                      url: friend?.photo?.url || null,
                    }
                  : null,
                status: "FRIEND",
              };
            } else if (friendship.follow_receiver.id !== userId) {
              const friend = friendship.follow_receiver;
              return {
                id: friend?.id,
                username: friend?.username,
                nickname: friend?.nickname,
                photo: friend.photo
                  ? {
                      id: friend?.photo.id || null,
                      url: friend?.photo.url || null,
                    }
                  : null,
                status: "FRIEND",
              };
            }
          } else if (friendship.status === "BLOCK_ONE") {
            const filter = friendship.blocked.filter(
              (blocked: any) => blocked.id !== userId
            );
            const blocked = filter[0];

            return {
              id: blocked.id,
              username: blocked.username,
              nickname: blocked.nickname,
              photo: blocked?.photo
                ? { id: blocked?.photo?.id, url: blocked?.photo?.url }
                : null,
              status: "BLOCK",
            };
          } else if (friendship.status === "BLOCK_BOTH") {
            const filter = friendship.blocked.filter(
              (blocked) => blocked.id !== userId
            );
            const blocked = filter[0];

            return {
              id: blocked.id,
              username: blocked.username,
              nickname: blocked.nickname,
              photo: blocked?.photo
                ? {
                    id: blocked?.photo?.id || null,
                    url: blocked?.photo?.url || null,
                  }
                : null,
              status: "BLOCK",
            };
          }
        });

        return ctx.send({
          results: friendAndBlock,
          pagination: friendships.pagination,
        });
      } catch (e) {
        return ctx.badRequest("Fail to find friends and blockeds");
      }
    },
  })
);
