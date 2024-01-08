/**
 * post controller
 */

import { factories } from "@strapi/strapi";
import post from "../routes/post";

export default factories.createCoreController(
  "api::post.post",
  ({ strapi }) => ({
    // CREATE: post 생성
    async create(ctx) {
      if (!ctx.state.user) {
        ctx.send("로그인 필요");
      } else {
        try {
          const { goal, body, isPublic, commentSettings } = JSON.parse(
            ctx.request.body.data
          );
          const files = ctx.request.files;
          const user = ctx.state.user.id;

          let data = {
            data: {
              user: user,
              goal,
              body,
              public: isPublic,
              commentSettings,
            },
            files: files && files.file ? { photo: files.file } : {},
          };

          const newPost = await strapi.entityService.create(
            "api::post.post",
            data
          );
          ctx.send({
            message: "Uploaded your post successfully",
            post: newPost,
          });
        } catch (e) {
          return ctx.badRequest(
            "Failed to upload your post, error: " + e.message
          );
        }
      }
    },

    // READ: 전체 / 친구 공개 게시물 조회 (query: ?isPublic=false)
    async find(ctx) {
      const isPublic = ctx.query.isPublic;
      console.log("ispublic:", isPublic);
      let condition: any;

      // 게시물: private (친구 공개)
      if (isPublic === "false") {
        if (ctx.state.user) {
          const userId = ctx.state.user.id;
          // 친구 리스트
          // TODO: 친구 relation?
          const friendsList = await strapi.entityService.findOne(
            "plugin::users-permissions.user",
            userId,
            { populate: { friend: true } }
          );
          console.log(friendsList);

          condition = {
            // $and: [{ public: false, user: { $in: friendList } }],
          };
        } else {
          return ctx.send("No access");
        }
      } else {
        console.log("public:true");
        condition = { public: true };
      }

      const posts = await strapi.entityService.findMany("api::post.post", {
        // 필터링 & 정렬 : public 설정 & 최신순
        filters: condition,
        sort: { createdAt: "desc" },
        populate: {
          // 게시물 사진
          photo: true,
          // 작성 유저 프로필 사진 & ID
          user: {
            fields: ["nickname"],
            populate: {
              photo: true,
            },
          },
          // 댓글 > 유저 프로필 사진 & ID, 댓글, 시간
          comments: {
            populate: {
              user: {
                fields: ["nickname"],
                populate: {
                  photo: true,
                },
              },
            },
          },
        },
      });

      console.log(posts);

      const postsData = Array.isArray(posts)
        ? posts.map((post) => ({
            id: post.id,
            userPhoto: (post.user as any).photo
              ? (post.user as any).photo.formats.thumbnail.url
              : null,
            nickname: (post.user as any).nickname,
            goal: post.goal,
            photo: post.photo
              ? (post.photo as any).formats.thumbnail.url
              : null,
            body: post.body,
            createdAt: post.createdAt,
            comments: Array.isArray(post.comments)
              ? post.comments.map((comment) => ({
                  id: comment.id,
                  user: comment.user.nickname,
                  userPhoto: comment.user.photo
                    ? comment.user.photo.formats.thumbnail.url
                    : null,
                  body: comment.body,
                  createdAt: comment.createdAt,
                }))
              : [],
          }))
        : [];

      try {
        ctx.send({ posts: postsData });
      } catch (e) {
        console.log(e);
      }
    },

    // UPDATE: 게시물 수정
    async update(ctx) {
      if (!ctx.state.user) {
        ctx.send("No access");
      }
      try {
        const postId = ctx.params.id;
        const userId = ctx.state.user.id;

        const existingPost = await strapi.entityService.findOne(
          "api::post.post",
          postId,
          { populate: { user: true, comments: true } }
        );

        console.log(existingPost);
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
              comments: existingPost.comments,
              user: userId,
              goal,
              public: isPublic,
              commentSettings,
            },
            files: files && files.file ? { photo: files.file } : {},
          };

          const updatedPost = await strapi.entityService.update(
            "api::post.post",
            postId,
            data as any
          );

          ctx.send({
            message: "Updated your post Successfully",
            post: updatedPost,
          });
        } else {
          return ctx.unauthorized("You can only edit your own posts");
        }
      } catch (e) {
        console.log(e);
      }
    },

    // DELETE:게시물 삭제
    async delete(ctx) {
      if (!ctx.state.user) {
        ctx.send("No access");
      }
      const postId = ctx.params.id;
      const user = ctx.state.user.id;

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

      if (user === (post.user as any).id) {
        try {
          const deletedPost = await strapi.entityService.delete(
            "api::post.post",
            postId
          );
          ctx.send({
            message: "Dleted your post successfully",
            id: deletedPost.id,
          });
        } catch (e) {
          console.log(e);
        }
      } else {
        ctx.send("You can only delete your own posts.");
      }
    },
  })
);
