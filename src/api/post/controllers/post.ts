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

      try {
        const { goal, body, isPublic, commentSettings } = JSON.parse(
          ctx.request.body.data
        );

        const files = ctx.request.files;
        const { id: userId } = ctx.state.user;

        let data = {
          data: {
            user: userId,
            goal,
            body,
            public: isPublic,
            commentSettings,
          },
          files: files.file ? { photo: files.file } : {},
        };

        const newPost = await strapi.entityService.create(
          "api::post.post",
          data
        );

        return ctx.send({
          message: "Successfully created a post.",
          post: newPost,
        });
      } catch (e) {
        return ctx.badRequest(
          "Failed to upload your post, error: " + e.message
        );
      }
    },

    // READ: 전체 / 친구 공개 게시물 조회 (query: ?isPublic=false)
    // 1. 그냥 최신순으로
    // 2. query public을 넣었을 경우
    // 3. 유저와 관련된 친구가 가지고 있는 post들만 가져오기 (여긴 친구가 public을 하든 안 하든 보이기)
    async find(ctx) {
      const { public: isPublic } = ctx.query;
      const { page, size } = ctx.query;

      // 필터링 조건
      let filters = {};

      // 1. 최신순 (public === true)
      if (isPublic === "true") {
        filters = { public: { $eq: true } };
      }

      // 2. 친구꺼 (public === true || public === false)
      if (ctx.state.user) {
        const { id: userId } = ctx.state.user;

        const friendsList = await getFriendsList(userId);
        filters = {
          user: [...friendsList],
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
              fields: ["nickname"],
              populate: {
                photo: {
                  fields: ["url"],
                },
              },
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
          likes: post.likes,
        }));

        return ctx.send({ posts: modifiedPosts, pagination: posts.pagination });
      } catch (e) {
        console.log(e);
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
        // console.log(friendship);

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
        return ctx.unauthorized("Authentication token is missing or invalid.");
      }

      try {
        const { id: postId } = ctx.params;
        const { id: userId } = ctx.state.user;

        const existingPost = await strapi.entityService.findOne(
          "api::post.post",
          postId,
          { populate: { user: { fields: ["nickname"] }, comments: true } }
        );

        if (!existingPost) {
          return ctx.notFound("Post not found");
        }

        if (userId === (existingPost.user as any).id) {
          const { goal, body, isPublic, commentSettings } = JSON.parse(
            ctx.request.body.data
          );
          const files = ctx.request.files;

          let data = {
            data: {
              body,
              user: userId,
              goal,
              public: isPublic,
              commentSettings,
            },
            files: files.file ? { photo: files.file } : {},
          };

          const updatedPost = await strapi.entityService.update(
            "api::post.post",
            postId,
            data as any
          );

          return ctx.send({
            message: "Updated your post Successfully",
            post: updatedPost,
          });
        } else {
          return ctx.unauthorized("You can only edit your own posts.");
        }
      } catch (e) {
        return ctx.badRequest("Failed to update a post.");
      }
    },

    // DELETE:게시물 삭제
    async delete(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid.");
      }

      const { id: userId } = ctx.state.user;
      const { id: postId } = ctx.params;

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
        try {
          const deletedPost = await strapi.entityService.delete(
            "api::post.post",
            postId
          );

          return ctx.send({
            message: "Successfully deleted a post.",
            id: deletedPost.id,
          });
        } catch (e) {
          return ctx.badRequest("Failed to delete a post.");
        }
      } else {
        ctx.send("You can only delete your own posts.");
      }
    },

    //UPDATE Like(post)
    async like(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid.");
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
          return ctx.notFound("Post not Found");
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
            ctx.send("Successfully cancelled a like.");
          } else {
            ctx.badRequest("Failed to cancel a like.");
          }
          // 좋아요 없는 상태 -> 좋아요 실행
        } else {
          const likePost = await strapi.entityService.update(
            "api::post.post",
            postId,
            { data: { ...post, likes: { connect: [userId] } } }
          );

          if (likePost) {
            // notice 중복 여부
            const notice = await strapi.entityService.findMany(
              "api::notice.notice",
              {
                filters: {
                  sender: userId,
                  receiver: (post.user as any).id,
                  event: "LIKE",
                },
              }
            );
            if (notice) {
              return ctx.badRequest("Already sent a like request.");
            }

            const newNotice = await strapi.entityService.create(
              "api::notice.notice",
              {
                data: {
                  body: `${ctx.state.user.nickname} liked your post.`,
                  receiver: (post.user as any).id,
                  sender: userId,
                  event: "FRIEND",
                },
              }
            );

            return ctx.send("Successfully created a like.");
          } else {
            return ctx.badRequest("Failed to create a like.");
          }
        }
      } catch (e) {
        return ctx.badRequest("Error");
      }
    },
  })
);
