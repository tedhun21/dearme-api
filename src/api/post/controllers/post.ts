/**
 * post controller
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::post.post",
  ({ strapi }) => ({
    // CREATE: post 생성
    async create(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid.");
      }

      const { id: userId } = ctx.state.user;
      const { goalId, body, isPublic, commentSettings } = JSON.parse(
        ctx.request.body.data
      );
      const { file } = ctx.request.files;

      try {
        let data = {
          data: {
            user: userId,
            goal: { connect: [goalId] },
            body,
            public: isPublic,
            commentSettings,
          },
          files: file ? { photo: file } : null,
        };

        const newPost = await strapi.entityService.create(
          "api::post.post",
          data
        );

        return ctx.send({
          message: "Successfully create a post",
          postId: newPost.id,
        });
      } catch (e) {
        return ctx.badRequest("Fail to upload your post, error: " + e.message);
      }
    },

    // READ: 전체 / 친구 공개 게시물 조회 (query: ?isPublic=false)
    // 1. 그냥 최신순으로
    // 2. query public을 넣었을 경우
    // 3. 유저와 관련된 친구가 가지고 있는 post들만 가져오기 (여긴 친구가 public을 하든 안 하든 보이기)
    async find(ctx) {
      const { page, size, userId, public: isPublic, friend } = ctx.query;

      // 필터링 조건
      let filters = {};

      // 1. 최신순 (public === true)
      if (isPublic === "true") {
        filters = { public: { $eq: true } };
      }

      // 2. 친구꺼 (public === true || public === false)
      if (ctx.state.user && friend === true) {
        const { id: userId } = ctx.state.user;

        const friendsList = await getFriendsList(userId);
        filters = {
          user: [...friendsList],
        };
      }

      // 3. 한 유저의 모든 포스트
      if (userId) {
        filters = { user: { id: userId } };
      }
      // 4. 나의 모든 포스트 (jwt)
      if (ctx.state.user && friend === false) {
        const { id: userId } = ctx.state.user;
        filters = {
          user: { id: userId },
        };
      }

      try {
        const posts = await strapi.entityService.findPage("api::post.post", {
          filters,
          sort: { createdAt: "desc" },
          populate: {
            // 게시물 사진
            photo: {
              fields: ["url"],
            },
            // 작성 유저 프로필 사진 & ID
            user: {
              fields: ["nickname"],
              populate: {
                photo: {
                  fields: ["url"],
                },
              },
            },
            // 댓글 > 유저 프로필 사진 & ID, 댓글, 시간

            comments: {
              sort: { createdAt: "desc" },
              populate: {
                user: {
                  fields: ["nickname"],
                  populate: {
                    photo: {
                      fields: ["url"],
                    },
                  },
                },
              },
            },
            likes: {
              fields: ["id"],
              // populate: {
              //   photo: {
              //     fields: ["url"],
              //   },
              // },
            },
            goal: { fields: ["body"] },
          },
          page,
          pageSize: size,
        });

        const modifiedPosts = posts.results.map((post) => ({
          id: post.id,
          photo: post.photo,
          body: post.body,
          createdAt: post.createdAt,
          public: post.public,
          commentSettings: post.commentSettings,
          user: post.user,
          goal: post.goal,
          comments: post.comments,
          likes: (post.likes as any).length,
        }));

        return ctx.send({
          results: modifiedPosts,
          pagination: posts.pagination,
        });
      } catch (e) {
        return ctx.notFound("The posts cannot be found");
      }

      async function getFriendsList(userId) {
        // 유저의 친구 관계
        const friendship = await strapi.entityService.findMany(
          "api::friendship.friendship",
          {
            filters: {
              $or: [
                {
                  $and: [
                    { follow_sender: { id: userId } },
                    { status: { $eq: "FRIEND" } },
                  ],
                },
                {
                  $and: [
                    { follow_receiver: { id: userId } },
                    { status: { $eq: "FRIEND" } },
                  ],
                },
              ],
            },
            populate: {
              follow_receiver: true,
              follow_sender: true,
            },
          }
        );

        // 유저의 친구 리스트
        const friendsList =
          Array.isArray(friendship) &&
          friendship.reduce((uniqueIds, friend) => {
            const followReceiverId = (friend.follow_receiver as any).id;
            const followSenderId = (friend.follow_sender as any).id;

            if (followReceiverId && !uniqueIds.includes(followReceiverId)) {
              uniqueIds.push(followReceiverId);
            }

            if (followSenderId && !uniqueIds.includes(followSenderId)) {
              uniqueIds.push(followSenderId);
            }

            return uniqueIds;
          }, []);

        return friendsList;
      }
    },

    // UPDATE: 게시물 수정
    async update(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid");
      }

      const { id: userId } = ctx.state.user;
      const { id: postId } = ctx.params;

      try {
        const existingPost = await strapi.entityService.findOne(
          "api::post.post",
          postId,
          { populate: { user: { fields: ["nickname"] }, comments: true } }
        );

        if (!existingPost) {
          return ctx.notFound("The post cannot be found");
        }

        if (userId === (existingPost.user as any).id) {
          const { goal, body, isPublic, commentSettings } = JSON.parse(
            ctx.request.body.data
          );
          const { file } = ctx.request.files;

          let data = {
            data: {
              body,
              user: userId,
              goal,
              public: isPublic,
              commentSettings,
            },
            files: file ? { photo: file } : null,
          };

          const updatedPost = await strapi.entityService.update(
            "api::post.post",
            postId,
            data as any
          );

          return ctx.send({
            message: "Successfully update the post",
            postId: updatedPost.id,
          });
        } else {
          return ctx.unauthorized("You can only edit your own posts");
        }
      } catch (e) {
        return ctx.badRequest("Fail to update the post");
      }
    },

    // DELETE:게시물 삭제
    async delete(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid.");
      }

      const { id: userId } = ctx.state.user;
      const { id: postId } = ctx.params;

      try {
        const post = await strapi.entityService.findOne(
          "api::post.post",
          postId,
          {
            populate: {
              user: {
                fields: ["id"],
              },
            },
          }
        );

        if (userId === (post.user as any).id) {
          const deletedPost = await strapi.entityService.delete(
            "api::post.post",
            postId
          );

          return ctx.send({
            message: "Successfully delete the post",
            postId: deletedPost.id,
          });
        } else {
          return ctx.badRequest("You can only delete your own posts.");
        }
      } catch (e) {
        return ctx.badRequest("Fail to delete the post.");
      }
    },

    //UPDATE Like(post)
    async like(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid");
      }

      const { id: userId } = ctx.state.user;
      const { postId } = ctx.params;

      try {
        const post = await strapi.entityService.findOne(
          "api::post.post",
          postId,
          {
            populate: {
              likes: { fields: ["nickname"] },
              user: { fields: ["nickname"] },
            },
          }
        );

        // 좋아요가 있으면 취소
        // 좋아요가 없으면 좋아요

        if (!post) {
          return ctx.notFound("The post cannot be found");
        }

        // 좋아요 유저 목록
        const likeIds = post.likes
          ? (post.likes as any).map((like) => like.id)
          : [];

        // post에 이 사람이 이미 좋아요를 누르고 있는지
        const alreadyLiked = likeIds.includes(userId);

        // 좋아요 상태 -> 좋아요 취소
        if (alreadyLiked) {
          const likeCancelPost = await strapi.entityService.update(
            "api::post.post",
            postId,
            { data: { ...post, likes: { disconnect: [userId] } } }
          );

          if (likeCancelPost) {
            ctx.send({
              message: "Successfully cancell the like",
              postId: likeCancelPost.id,
            });
          } else {
            ctx.badRequest("Fail to cancel the like");
          }
          // 좋아요 없는 상태 -> 좋아요 실행
        } else {
          const likePost = await strapi.entityService.update(
            "api::post.post",
            postId,
            { data: { ...post, likes: { connect: [userId] } } }
          );

          return ctx.send({
            message: "Successfully create a like",
            postId: likePost.id,
          });

          // if (likePost) {
          //   // notice 중복 여부
          //   const notice = await strapi.entityService.findMany(
          //     "api::notice.notice",
          //     {
          //       filters: {
          //         sender: userId,
          //         receiver: (post.user as any).id,
          //         event: "LIKE",
          //       },
          //     }
          //   );
          //   if (notice) {
          //     return ctx.badRequest("Already sent a like request.");
          //   }

          //   const newNotice = await strapi.entityService.create(
          //     "api::notice.notice",
          //     {
          //       data: {
          //         body: `${ctx.state.user.nickname} liked your post.`,
          //         receiver: (post.user as any).id,
          //         sender: userId,
          //         event: "FRIEND",
          //       },
          //     }
          //   );

          // } else {
          //   return ctx.badRequest("Fail to create a like.");
          // }
        }
      } catch (e) {
        return ctx.badRequest("Fail to update a like.");
      }
    },

    // 목표 검색 > 포스트 1개 조회
    async findByPostId(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid");
      }
      const { postId } = ctx.params;

      try {
        const post = await strapi.entityService.findOne(
          "api::post.post",
          postId,
          {
            populate: {
              // 게시물 사진
              photo: {
                fields: ["url"],
              },
              // 작성 유저 프로필 사진 & ID
              user: {
                fields: ["nickname"],
                populate: {
                  photo: {
                    fields: ["url"],
                  },
                },
              },
              // 댓글 > 유저 프로필 사진 & ID, 댓글, 시간

              comments: {
                sort: { createdAt: "desc" },
                populate: {
                  user: {
                    fields: ["nickname"],
                    populate: {
                      photo: {
                        fields: ["url"],
                      },
                    },
                  },
                },
              },
              likes: {
                fields: ["nickname"],
                populate: {
                  photo: {
                    fields: ["url"],
                  },
                },
              },
              goal: { fields: ["body"] },
            },
          }
        );

        const modifiedPosts = {
          id: post.id,
          photo: post.photo,
          body: post.body,
          createdAt: post.createdAt,
          public: post.public,
          commentSettings: post.commentSettings,
          user: post.user,
          goal: post.goal,
          comments: post.comments,
          likes: post.likes,
        };

        return ctx.send({
          message: "Successfully find the post",
          results: modifiedPosts,
        });
      } catch (e) {
        return ctx.badRequest("Fail to find the post");
      }
    },
    async likeShip(ctx) {
      const { postId } = ctx.params;

      if (!ctx.state.user) {
        return ctx.badRequest("Bad");
      }
      const { id: userId } = ctx.state.user;

      try {
        const post = await strapi.entityService.findOne(
          "api::post.post",
          postId,
          {
            populate: {
              likes: {
                populate: {
                  friendships_receive: {
                    populate: {
                      follow_sender: { fields: ["id", "nickname"] },
                      follow_receiver: { fields: ["id", "nickname"] },
                    },
                  },
                  friendships_send: {
                    populate: {
                      follow_sender: { fields: ["id", "nickname"] },
                      follow_receiver: { fields: ["id", "nickname"] },
                    },
                  },
                },
              },
            },
          }
        );
        // console.log(post.likes[0].friendships_send);
        const modifiedLikeUsers = (post.likes as any).map((likeUser) => {
          // 사용자와의 관계를 저장할 객체
          const relationship = {
            id: likeUser.id,
            nickname: likeUser.nickname,
            status: "UNKNOWN", // 기본적으로 상태를 알 수 없는 상태로 설정
            block: null,
            blocked: null,
          };

          // likeUser와의 관계를 찾아서 상태를 설정
          likeUser.friendships_receive.forEach((friendship) => {
            if (
              (friendship.follow_sender.id === userId ||
                friendship.follow_receiver.id === userId) &&
              friendship.status === "FRIEND"
            ) {
              relationship.status = "FRIEND";
            } else if (
              (friendship.follow_sender.id === userId ||
                friendship.follow_receiver.id === userId) &&
              friendship.status === "PENDING"
            ) {
              relationship.status = "PENDING";
            } else if (
              friendship.follow_sender.id === userId ||
              (friendship.follow_receiver.id === userId &&
                // friendship.block.id === userId &&
                friendship.status === "BLOCK_ONE")
            ) {
              console.log("hi");
              relationship.status = "BLOCK_ONE";
              relationship.block = userId;
              relationship.blocked = likeUser.id;
            } else if (
              (friendship.follow_sender.id === userId ||
                friendship.follow_receiver.id === userId) &&
              friendship.status === "BLOCK_BOTH"
            ) {
              relationship.status = "BLOCK_BOTH";
              relationship.block = userId;
              relationship.blocked = likeUser.id;
            }
          });

          likeUser.friendships_send.forEach((friendship) => {
            if (
              (friendship.follow_sender.id === userId ||
                friendship.follow_receiver.id === userId) &&
              friendship.status === "FRIEND"
            ) {
              relationship.status = "FRIEND";
            } else if (
              (friendship.follow_sender.id === userId ||
                friendship.follow_receiver.id === userId) &&
              friendship.status === "PENDING"
            ) {
              relationship.status = "PENDING";
            }
          });

          likeUser.friendships_send.map((friendship) => {
            if (
              (friendship.follow_sender.id === userId ||
                friendship.follow_receiver.id === userId) &&
              friendship.status === "FRIEND"
            ) {
              relationship.status = "FRIEND";
            } else if (
              (friendship.follow_sender.id === userId ||
                friendship.follow_receiver.id === userId) &&
              friendship.status === "PENDING"
            ) {
              relationship.status = "PENDING";
            }
          });

          // 추가적인 상태에 대한 처리
          if (relationship.status === "UNKNOWN") {
            // 예를 들어 PENDING이나 BLOCKED 상태 등을 추가적으로 처리할 수 있음
            // relationship.status = "PENDING";
            // relationship.status = "BLOCKED";
          }

          return relationship;
        });

        console.log(modifiedLikeUsers);
      } catch (e) {}
    },
  })
);
