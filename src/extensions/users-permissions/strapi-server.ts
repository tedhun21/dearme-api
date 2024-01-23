module.exports = (plugin) => {
  // 유저 등록
  plugin.controllers.auth.register = async (ctx) => {
    try {
      const newMember = await strapi.entityService.create(
        "plugin::users-permissions.user",
        {
          data: {
            ...ctx.request.body,
            provider: "local",
            private: false,
            role: {
              connect: [{ id: 2 }],
            },
          },
        }
      );

      return ctx.send({ status: 201, message: "Successfully created a user." });
    } catch (e) {
      return ctx.badRequest("Failed to create a user.");
    }
  };

  // 유저 한명 조회
  plugin.controllers.user.findOne = async (ctx) => {
    const { id: userId } = ctx.params;

    try {
      const user = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        userId,
        {
          populate: {
            posts: true,
            todos: true,
            goals: true,
            diaries: true,
            photo: { fields: ["url"] },
            background: { fields: ["url"] },
          },
        }
      );
      if (!user) {
        return ctx.notFound("Can't find a user.");
      }

      const modifiedUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        nickname: user.nickname,
        photo: user.photo ? user.photo : null,
        background: user.background ? user.background : null,
        private: user.private,
      };

      return ctx.send({ status: 200, data: modifiedUser });
    } catch (e) {
      return ctx.notFound("Can't find a user.");
    }
  };

  // 나의 정보 조회
  plugin.controllers.user.me = async (ctx) => {
    if (!ctx.state.user) {
      return ctx.unauthorized("Authentication token is missing or invalid.");
    }

    try {
      const user = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        ctx.state.user.id,
        {
          populate: {
            photo: { fields: ["url"] },
            friendships_receive: {
              fields: ["status"],
              populate: { follow_sender: { fields: ["nickname"] } },
            },
          },
        }
      );

      const modifiedUser = {
        id: user.id,
        email: user.email,
        username: user.username,
        nickname: user.nickname,
        photo: user.photo ? user.photo : null,
        background: user.background ? user.background : null,
      };

      return ctx.send({ status: 200, data: modifiedUser });
    } catch (e) {
      return ctx.notFound("Can't find me.");
    }
  };

  // 유저 정보 수정
  plugin.controllers.user.update = async (ctx) => {
    const { id: userId } = ctx.params;

    if (!ctx.state.user || ctx.state.user.id !== +userId) {
      return ctx.unauthorized("Authentication token is missing or invalid.");
    }
    const { photo, background } = ctx.request.files;

    const parsedData = JSON.parse(ctx.request.body.data);

    try {
      const updatedUser = await strapi.entityService.update(
        "plugin::users-permissions.user",
        userId,
        {
          data: { ...parsedData },
          files:
            photo && background
              ? { photo: photo, background: background }
              : photo
              ? { photo: photo }
              : background
              ? { background: background }
              : null,
        }
      );

      return ctx.send({ status: 200, message: "Successfully updated a user." });
    } catch (e) {
      return ctx.badRequest("Failed to update a user.");
    }
  };

  // 유저 삭제
  plugin.controllers.user.destroy = async (ctx) => {
    const { id: userId } = ctx.state.user;

    if (!ctx.state.user || ctx.state.user.id !== +userId) {
      return ctx.unauthorized("Authentication token is missing or invalid.");
    }
    if (ctx.state.user.id !== +ctx.params.id) {
      return ctx.unauthorized("User does not match.");
    } else {
      try {
        const deleteUser = await strapi.entityService.delete(
          "plugin::users-permissions.user",
          userId
        );

        return ctx.send({
          status: 200,
          message: "Successfully deleted a user.",
        });
      } catch (e) {
        return ctx.badRequest("Failed to delete a user.");
      }
    }
  };

  return plugin;
};
