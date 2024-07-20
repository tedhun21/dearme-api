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
      const { goalId, body, isPrivate, commentSettings } = JSON.parse(
        ctx.request.body.data
      );
      const { file } = ctx.request.files;

      try {
        let data = {
          data: {
            user: userId,
            goal: { connect: [goalId] },
            body,
            private: isPrivate,
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

    // READ: 전체 / 친구 공개 게시물 조회 (query: ?isPrivate=false)
    // 1. 그냥 최신순으로
    // 2. query public을 넣었을 경우
    // 3. 유저와 관련된 친구가 가지고 있는 post들만 가져오기
    async find(ctx) {
      const { page, size, userId, isPrivate, friend } = ctx.query;

      let filters = {};

      // 1. post 중 public이 true인 것만 (private === false)
      // jwt 필요 없음
      if (isPrivate === "false") {
        filters = { private: { $eq: false } };
      }

      // 2. 친구꺼
      // jwt 필수
      else if (ctx.state.user && friend === "true") {
        const { id: userId } = ctx.state.user;
        const friendsList = await getFriendsList(userId);
        filters = {
          user: [...friendsList],
        };
      }

      // 3. 한 유저의 모든 포스트
      // jwt 필요 없음
      else if (userId) {
        filters = { user: { id: userId } };
      }

      // 4. 나의 모든 포스트
      // jwt 필요
      else if (ctx.state.user && friend === "false") {
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

            comments: true,
            // {
            //   sort: { createdAt: "desc" },
            //   populate: {
            //     user: {
            //       fields: ["nickname"],
            //       populate: {
            //         photo: {
            //           fields: ["url"],
            //         },
            //       },
            //     },
            //   },
            // },
            likes: {
              fields: ["nickname"],
              populate: {
                photo: {
                  fields: ["url"],
                },
              },
            },
            goal: { fields: ["title"] },
          },
          page,
          pageSize: size,
        });

        const modifiedPosts = posts.results.map((post) => ({
          id: post.id,
          photo: post.photo,
          body: post.body,
          createdAt: post.createdAt,
          private: post.private,
          commentSettings: post.commentSettings,
          user: post.user,
          goal: post.goal,
          // comments: post.comments,
          comments: Array.isArray(post.comments) && post.comments.length,
          likes: post.likes,
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
                  follow_sender: { id: userId },
                  status: { $eq: "FRIEND" },
                },
                {
                  follow_receiver: { id: userId },
                  status: { $eq: "FRIEND" },
                },
              ],
            } as any,
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
          const { goal, body, isPrivate, commentSettings } = JSON.parse(
            ctx.request.body.data
          );
          const { file } = ctx.request.files;

          let data = {
            data: {
              body,
              user: userId,
              goal,
              private: isPrivate,
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

    async findByPostId(ctx) {
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

              comments: true,
              likes: {
                fields: ["nickname"],
                populate: {
                  photo: {
                    fields: ["url"],
                  },
                },
              },
              goal: { fields: ["title"] },
            },
          }
        );

        const modifiedPosts = {
          id: post.id,
          photo: post.photo,
          body: post.body,
          createdAt: post.createdAt,
          private: post.private,
          commentSettings: post.commentSettings,
          user: post.user,
          goal: post.goal,
          comments: Array.isArray(post.comments) && post.comments.length,
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

    // 좋아요 유저 목록 & 관계 (photo, nickname, friendship)
    async likeShip(ctx) {
      const { postId } = ctx.params;
      const { all } = ctx.query;

      // 일단 포스트 하나 불러와서 likes 가져오기 첫번째
      const post = await strapi.entityService.findOne(
        "api::post.post",
        postId,
        {
          populate: {
            likes: {
              populate: { photo: { fields: ["id", "url"] } },
              fields: ["id", "nickname"],
            },
          },
        }
      );

      const likes = post.likes;

      if (all) {
        const modifiedLikes =
          Array.isArray(likes) &&
          likes.map((like) => ({
            likeId: like.id,
            userPhoto: like.photo?.url,
            nickname: like.nickname,
            status: "public",
          }));
        return ctx.send({
          message: "Successfully find the likes and friendship",
          results: modifiedLikes,
        });
      }
      const likeIds = (likes as any).map((likeUser) => likeUser.id);

      const { id: userId } = ctx.state.user;

      const friendships = await strapi.entityService.findMany(
        "api::friendship.friendship",
        {
          filters: {
            $or: [
              {
                follow_receiver: { id: userId },
                follow_sender: { id: { $in: likeIds } },
              },
              {
                follow_receiver: { id: { $in: likeIds } },
                follow_sender: { id: userId },
              },
            ],
          } as any,
          populate: {
            follow_receiver: { fields: ["id"] },
            follow_sender: { fields: ["id"] },
            block: { fields: ["id"] },
            blocked: { fields: ["id"] },
          },
        }
      );

      const modifiedFriendships =
        Array.isArray(likes) &&
        likes.map((like: any) => {
          const friendship =
            Array.isArray(friendships) &&
            friendships.find(
              (f: any) =>
                (like.id !== userId &&
                  f.follow_sender &&
                  f.follow_sender.id === like.id) ||
                (like.id !== userId &&
                  f.follow_receiver &&
                  f.follow_receiver.id === like.id)
            );

          if (friendship) {
            const likeItem = {
              likeId: like.id,
              userPhoto: like.photo !== null ? like.photo.url : null,
              nickname: like.nickname,
            };

            switch (friendship.status) {
              case "FRIEND":
                return { ...likeItem, status: "friend" };

              case "BLOCK_ONE":
              case "BLOCK_BOTH":
                return {
                  likeItem,
                  status:
                    friendship.block?.[0]?.id === userId
                      ? "blocked user"
                      : undefined,
                };
              case "PENDING":
                return {
                  ...likeItem,
                  status:
                    (friendship.follow_sender as any).id === userId
                      ? "requested"
                      : (friendship.follow_receiver as any).id === userId &&
                        "pending",
                };
              default:
            }
          } else {
            return {
              likeId: like.id,
              userPhoto: like.photo !== null ? like.photo.url : null,
              nickname: like.nickname,
              status: like.id === userId ? "me" : "not found",
            };
          }
        });

      return ctx.send({
        message: "Successfully find the likes and friendship",
        results: modifiedFriendships,
      });
    },

    // 포스트가 가지고 있는 골의 title에 완전 똑같은 포스트들만 찾기
    async findOnGoal(ctx) {
      const { searchTerm } = ctx.query;

      const posts = await strapi.entityService.findMany("api::post.post", {
        filters: {
          sort: { createdAt: "desc" },
          goal: { title: { $eq: searchTerm } },
          private: false,
        },
        populate: { photo: { fields: ["id", "url"] } },
      });

      const modifiedPosts = (posts as any).map((post: any) => ({
        id: post.id,
        photo: post.photo,
      }));

      return ctx.send(modifiedPosts);
    },
  })
);
