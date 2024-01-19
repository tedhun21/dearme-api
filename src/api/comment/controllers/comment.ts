/**
 * comment controller
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::comment.comment",
  ({ strapi }) => ({
    // CREATE comment 생성 (client에서 postId 보내기)
    // TODO: commentSettings (public, friends, off)
    async create(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid.");
      }
      if (!ctx.request.body.body) {
        return ctx.badRequest("body is required.");
      }

      const { id: userId } = ctx.state.user;
      const { postId } = ctx.query;
      const { body } = ctx.request.body;

      try {
        // post 불러오기
        const post = await strapi.entityService.findOne(
          "api::post.post",
          postId,
          { populate: { user: { fields: ["nickname"] } } }
        );

        const friendship = await strapi.entityService.findMany(
          "api::friendship.friendship",
          {
            filters: {
              $and: [
                {
                  $or: [
                    {
                      $and: [
                        { follow_sender: userId },
                        { follow_receiver: (post.user as any).id },
                      ],
                    },
                    {
                      $and: [
                        { follow_receiver: userId },
                        { follow_sender: (post.user as any).id },
                      ],
                    },
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

        let data;

        // 1. 유저는 자기 소유의 포스트에 댓글을 무조건 달 수 있다.
        if ((post.user as any).id === userId && friendship.length === 0) {
          data = {
            data: { user: userId, post: postId },
          };

          try {
            const newComment = await strapi.entityService.create(
              "api::comment.comment",
              data
            );

            return ctx.send("Successfully created a comment.");
          } catch (e) {
            return ctx.send("Failed to create a comment.");
          }
        }

        // 2. post PUBLIC이면 관계가 어떤 것이든 상관 x
        else if (post.commentSettings === "PUBLIC") {
          data = {
            data: {
              user: userId,
              post: postId,
              body,
            },
          };

          try {
            const newComment = await strapi.entityService.create(
              "api::comment.comment",
              data
            );
            return ctx.send("Successfully created a comment.");
          } catch (e) {
            return ctx.badRequest("Failed to create a comment.");
          }

          // 3. post FRIENDS면 관계가 FRIEND만 comment를 달 수 있다.
        } else if (
          post.commentSettings === "FRIENDS" &&
          friendship[0].status === "FRIEND"
        ) {
          data = {
            data: {
              user: userId,
              post: postId,
              body,
              friendship: friendship[0].id,
            },
          };

          try {
            const newComment = await strapi.entityService.create(
              "api::comment.comment",
              data
            );
            return ctx.send("Successfully created a comment.");
          } catch (e) {
            return ctx.badRequest("Failed to create a comment.");
          }

          // 3. post OFF면 관계가 무엇이든지 comment를 달 수 없다.
        } else if (post.commentSettings === "OFF") {
          return ctx.send(
            "The owner of the post has disabled commenting on it."
          );
          // post comment 설정이 친구인 상태에서 친분이 없거나 친분이 PENDING 상태일때
        } else if (
          post.commentSettings === "FRIENDS" &&
          (friendship.length === 0 || friendship[0].status === "PENDING")
        ) {
          return ctx.badRequest(
            "Cannot leave a comment as you are not friends with the owner of this post."
          );
        } else {
          return ctx.badRequest("Failed to leave a comment");
        }
      } catch (e) {
        return ctx.badRequest("Failed to leave a comment, error: " + e.message);
      }
    },

    // READ 댓글 조회 (query: ?postId=123)
    async find(ctx) {
      const { postId, page, size } = ctx.query;

      if (!page || !size) {
        return ctx.badRequest("page, size are required.");
      }

      const post = await strapi.entityService.findOne("api::post.post", postId);

      if (!post) {
        return ctx.badRequest("Could not find a post matching the postId.");
      }

      let filters;
      if (postId) {
        filters = { post: +postId };
      }

      if (page && size) {
        const comments = await strapi.entityService.findPage(
          "api::comment.comment",
          {
            sort: { id: "desc" },
            page,
            pageSize: size,
            populate: { user: { fields: ["nickname"] } },
            filters,
          }
        );

        return ctx.send(comments);
      }
    },

    // UPDATE 댓글 수정
    async update(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid.");
      }

      if (!ctx.request.body.body) {
        return ctx.badRequest("body is required.");
      }
      try {
        const { id: userId } = ctx.state.user;
        const { body } = ctx.request.body;
        const { id: commentId } = ctx.params;
        const { postId } = ctx.query;

        const existingComment = await strapi.entityService.findOne(
          "api::comment.comment",
          commentId,
          {
            populate: { user: { fields: ["nickname"] } },
          }
        );

        if (!existingComment) {
          return ctx.notFound("Comment not found");
        }

        if (userId !== (existingComment.user as any).id) {
          return ctx.unauthorized("You can only edit your own comments");
        }

        let data = {
          data: {
            body,
            post: postId,
            user: userId,
          },
        };

        const updatedComment = await strapi.entityService.update(
          "api::comment.comment",
          commentId,
          data as any
        );

        return ctx.send({
          message: "Successfully updated a comment.",
          comment: updatedComment,
        });
      } catch (e) {
        return ctx.badRequest(
          "Failed to update a comment, error: " + e.message
        );
      }
    },

    // DELETE 댓글 삭제
    // comment 소유자가 삭제 && post 소유자가 삭제
    async delete(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid.");
      }

      const { id: userId } = ctx.state.user;
      const { id: commentId } = ctx.params;

      const existingComment = await strapi.entityService.findOne(
        "api::comment.comment",
        commentId,
        { populate: { user: { fields: ["nickname"] } } }
      );

      console.log(existingComment);

      if (userId === (existingComment.user as any).id) {
        try {
          const deletedComment = await strapi.entityService.delete(
            "api::comment.comment",
            commentId
          );

          return ctx.send({
            message: "Successfully deleted a comment.",
            id: deletedComment.id,
          });
        } catch (e) {
          console.log(e);
        }
      } else {
        return ctx.badRequest("You can only delete your own comments.");
      }
    },
  })
);
