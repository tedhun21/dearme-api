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

      return ctx.send("Successfully created a user.");
    } catch (e) {
      return ctx.send("Failed to create a user.");
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
        return ctx.notfound("Can't find a user.");
      }

      const modifiedUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        nickname: user.nickname,
        photo: (user.photo as any).url,
        background: (user.background as any).url,
        address: user.address,
        private: user.private,
      };

      return ctx.send(modifiedUser);
    } catch (e) {
      return ctx.badRequest("Can't find a user.");
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
        phone: user.phone,
        address: user.address,
        photo: user.photo,
        background: user.background,
      };

      return ctx.send(modifiedUser);
    } catch (e) {
      return ctx.badRequest("Can't find me.");
    }
  };

  // 유저 정보 수정
  plugin.controllers.user.update = async (ctx) => {
    const { id: userId } = ctx.params;

    if (!ctx.state.user || ctx.state.user.id !== +userId) {
      return ctx.unauthorized("Authentication token is missing or invalid.");
    }
    const { photo, background } = ctx.request.files;

    let data;

    const parsedData = JSON.parse(ctx.request.body.data);
    if (photo && background) {
      data = { data: { ...parsedData }, files: { photo, background } };
    } else if (photo) {
      data = { data: { ...parsedData }, files: { photo } };
    } else if (background) {
      data = { data: { ...parsedData }, files: { background } };
    }

    try {
      const updatedUser = await strapi.entityService.update(
        "plugin::users-permissions.user",
        userId,
        data
      );

      return ctx.send("Successfully updated a user.");
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
    if (ctx.state.user.id === +ctx.params.id) {
      try {
        const deleteUser = await strapi.entityService.delete(
          "plugin::users-permissions.user",
          userId
        );

        return ctx.send("Successfully deleted a user.");
      } catch (e) {
        return ctx.badRequest("Failed to delete a user.");
      }
    }
  };

  return plugin;
};
