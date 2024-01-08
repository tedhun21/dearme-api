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
        ctx.send("No access");
      } else {
        try {
          const { postId, body } = JSON.parse(ctx.request.body.data);
          const user = ctx.state.user.id;

          let data = {
            data: {
              user: user,
              post: postId,
              body,
            },
          };

          const newComment = await strapi.entityService.create(
            "api::comment.comment",
            data
          );

          ctx.send({
            message: "Uploaded your comment successfully",
            comment: newComment,
          });
        } catch (e) {
          return ctx.badRequest(
            "Failed to upload your post, error: " + e.message
          );
        }
      }
    },

    // READ 댓글 조회 (query: ?postId=123)
    async find(ctx) {
      const { postId } = ctx.query;
      if (!postId) {
        return ctx.badRequest("Please enter the Post ID");
      }
      const comments = await strapi.entityService.findMany(
        "api::comment.comment",
        {
          filters: { post: postId },
          populate: { user: { fields: ["nickname"] } },
        }
      );
      ctx.send({ comments });
    },

    // UPDATE 댓글 수정
    async update(ctx) {
      if (!ctx.state.user) {
        ctx.send("No access");
      }
      try {
        const { body, postId } = JSON.parse(ctx.request.body.data);
        const commentId = ctx.params.id;
        const user = ctx.state.user.id;

        const existingComment = await strapi.entityService.findOne(
          "api::comment.comment",
          commentId,
          {
            populate: { user: { fields: ["nickname"] } },
          }
        );
        // console.log(commentId);
        // console.log(existingComment);
        // console.log(user);
        // console.log((existingComment.user as any).id);

        if (!existingComment) {
          return ctx.notFound("Comment not found");
        }

        if (user !== (existingComment.user as any).id) {
          return ctx.unauthorized("You can only edit your own comments");
        }

        let data = {
          data: {
            body,
            post: postId,
            user,
          },
        };

        console.log(data);

        const updatedComment = await strapi.entityService.update(
          "api::comment.comment",
          commentId,
          data as any
        );
        ctx.send({
          message: "Comment updated successfully",
          comment: updatedComment,
        });
      } catch (e) {
        return ctx.badRequest(
          "Failed to update your comment, error: " + e.message
        );
      }
    },

    // DELETE 댓글 삭제
    async delete(ctx) {
      if (!ctx.state.user) {
        ctx.send("No access");
      }
      const user = ctx.state.user.id;
      const commentId = ctx.params.id;

      const existingComment = await strapi.entityService.findOne(
        "api::comment.comment",
        commentId,
        { populate: { user: { fields: ["id"] } } }
      );

      console.log(existingComment);
      console.log(user);
      if (user === (existingComment.user as any).id) {
        try {
          const deletedComment = await strapi.entityService.delete(
            "api::comment.comment",
            commentId
          );
          ctx.send({
            message: "Deleted your comment successfully",
            id: deletedComment.id,
          });
        } catch (e) {
          console.log(e);
        }
      } else {
        ctx.send("You can only delete your own comments.");
      }
    },
  })
);
