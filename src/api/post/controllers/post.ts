/**
 * post controller
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::post.post",
  ({ strapi }) => ({
    // Create: post 생성
    // TODO: 로그인한 사용자만 추가 (user permissions: public -> authenticated)
    async create(ctx) {
      const { goal, body, isPublic, commentSettings } = JSON.parse(
        ctx.request.body.data
      );
      const files = ctx.request.files;

      console.log(ctx.request.body.data);

      let data = {
        data: { goal, body, public: isPublic, commentSettings },
        files: files && files.photo ? { photo: files.file } : {},
      };

      console.log(data);

      try {
        const newPost = await strapi.entityService.create(
          "api::post.post",
          data
        );
        ctx.send({ message: "Uploaded your post successfully", post: newPost });
      } catch (e) {
        return ctx.badRequest(
          "Failed to upload your post, error: " + e.message
        );
      }
    },

    // Read: 전체 / 친구 공개 게시물 조회 (query ?isPublic=true)
    // TODO: response 정리
    async find(ctx) {
      const isPublic = ctx.query.isPublic === "true";
      const posts = await strapi.entityService.findMany("api::post.post", {
        // 필터링 & 정렬 : public 설정 & 최신순
        filters: {
          public: isPublic,
        },
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
              users: {
                fields: ["nickname"],
                populate: {
                  photo: true,
                },
              },
            },
          },
        },
      });

      // const customedPosts = Array.isArray(posts)
      //   ? posts.map((post) => ({
      //       nickname: post.user.nickname,
      //       photo: post.user.photo
      //         ? post.user.photo.formats.thumbnail.url
      //         : null,
      //     }))
      //   : [];

      // console.log(posts[0].user.nickname);
      try {
        ctx.send({ posts: posts });
      } catch (e) {
        console.log(e);
      }
    },

    // Update: 게시물 수정
    // TODO: if(로그인한 사용자 === 작성자) -> 수정 가능
    // async update(ctx) {
    //   const postId = ctx.params.id;
    //   const { goal, body, isPublic, commentSettings } = JSON.parse(
    //     ctx.request.body.data
    //   );
    //   const files = ctx.request.files;

    //   let data = {
    //     data: { goal, body, public: isPublic, commentSettings },
    //     files: files && files.photo ? { photo: files.file } : {},
    //   };

    //   try {
    //     const updatedPost = await strapi.entityService.update(
    //       "api::post.post",
    //       postId,
    //       { data }
    //     );
    //     ctx.send("Updated your post Successfully");
    //   } catch (e) {
    //     console.log(e);
    //   }
    // },

    // Delete:게시물 삭제
    // TODO: if(로그인한 사용자 === 작성자) -> 삭제 가능
    async delete(ctx) {
      if (!ctx.state.user) {
        ctx.send("로그인 후 이용해주세요.");
      } else {
        const userId = ctx.state.user.id;
        const postId = ctx.params.id;

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

        // console.log(userId);
        console.log(post);
        console.log(post.user);
        // if (userId === post.user.id) {
        //   try {
        //     const deletedPost = await strapi.entityService.delete(
        //       "api::post.post",
        //       postId
        //     );
        //     ctx.send({
        //       message: "Dleted your post successfully",
        //       id: deletedPost.id,
        //     });
        //   } catch (e) {
        //     console.log(e);
        //   }
        // }
      }
    },
  })
);
