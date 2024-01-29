/**
 * comment controller
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::comment.comment",
  ({ strapi }) => ({
    // CREATE comment 생성 (client에서 postId 보내기)
    async create(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid");
      }
      if (!ctx.request.body.body) {
        return ctx.badRequest("body is required");
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
        // 2. post PUBLIC이면 관계가 어떤 것이든 상관 x
        if (
          ((post.user as any).id === userId && friendship.length === 0) ||
          post.commentSettings === "PUBLIC"
        ) {
          data = {
            data: { user: userId, post: postId, body },
          };
        }

        // 3. post commentSettings가 FRIENDS면 friendship 관계가 FRIEND만 comment를 달 수 있다.
        else if (
          post.commentSettings === "FRIENDS" &&
          friendship[0].status === "FRIEND"
        ) {
          data = {
            data: {
              user: userId,
              post: postId,
              body,
              friendship: { connect: [friendship[0].id] },
            },
          };

          // 3. post OFF면 관계가 무엇이든지 comment를 달 수 없다.
        } else if (post.commentSettings === "OFF") {
          return ctx.badRequest(
            "The owner of the post has disabled commenting on it."
          );
          // post comment 설정이 친구인 상태에서 친분이 없거나 친분이 PENDING 상태일때
        } else if (
          post.commentSettings === "FRIENDS" &&
          (friendship.length === 0 || friendship[0].status === "PENDING")
        ) {
          return ctx.forbidden(
            "Can't leave a comment as you are not friends with the owner of this post"
          );
        } else {
          return ctx.badRequest("Fail to leave a comment");
        }

        try {
          const newComment = await strapi.entityService.create(
            "api::comment.comment",
            data
          );
          return ctx.send({
            message: "Successfully create a comment",
            commentId: newComment.id,
          });
        } catch (e) {
          return ctx.badRequest("Fail to create a comment");
        }
      } catch (e) {
        return ctx.badRequest("Fail to leave a comment, error: " + e.message);
      }
    },

    // READ 댓글 조회 (query: ?postId=123)
    async find(ctx) {
      const { postId, page, size } = ctx.query;

      if (!page || !size) {
        return ctx.badRequest("page, size are required");
      }

      try {
        const post = await strapi.entityService.findOne(
          "api::post.post",
          postId
        );

        if (!post) {
          return ctx.notFound("The post cannot be found matching the postId");
        }

        const comments = await strapi.entityService.findPage(
          "api::comment.comment",
          {
            sort: { id: "desc" },
            page,
            pageSize: size,
            populate: { user: { fields: ["nickname"] } },
            filters: { post: { id: postId } },
          }
        );

        return ctx.send({
          message: "Successfully find comments",
          results: comments.results,
          pagination: comments.pagination,
        });
      } catch (e) {
        return ctx.badRequest("Fail to find comments");
      }
    },

    // UPDATE 댓글 수정
    async update(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid");
      }

      if (!ctx.request.body.body) {
        return ctx.badRequest("body is required");
      }

      const { id: userId } = ctx.state.user;
      const { body } = ctx.request.body;
      const { id: commentId } = ctx.params;
      const { postId } = ctx.query;

      try {
        const existingComment = await strapi.entityService.findOne(
          "api::comment.comment",
          commentId,
          {
            populate: { user: { fields: ["nickname"] } },
          }
        );

        if (!existingComment) {
          return ctx.notFound(
            "The comment cannot be found matching the commentId"
          );
        }

        if (userId !== (existingComment.user as any).id) {
          return ctx.forbidden("No permission to update this comment");
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
          message: "Successfully update the comment",
          comment: updatedComment.id,
        });
      } catch (e) {
        return ctx.badRequest("Fail to update a comment, error: " + e.message);
      }
    },

    // DELETE 댓글 삭제
    // comment 소유자가 삭제 && post 소유자가 삭제
    async delete(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid");
      }

      const { id: userId } = ctx.state.user;
      const { id: commentId } = ctx.params;

      try {
        const existingComment = await strapi.entityService.findOne(
          "api::comment.comment",
          commentId,
          { populate: { user: { fields: ["nickname"] } } }
        );

        if (!existingComment) {
          return ctx.notFound("The comment cannot be found");
        }

        if (userId === (existingComment.user as any).id) {
          const deletedComment = await strapi.entityService.delete(
            "api::comment.comment",
            commentId
          );

          return ctx.send({
            message: "Successfully delete a comment.",
            id: deletedComment.id,
          });
        } else {
          return ctx.forbidden("No permission to delete this todo");
        }
      } catch (e) {
        return ctx.badRequest("Fail to delete the todo");
      }
    },
  })
);
