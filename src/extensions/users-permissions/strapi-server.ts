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
            role: {
              connect: [{ id: 2 }],
            },
          },
        }
      );

      ctx.send("Create User Success");
    } catch (e) {
      console.log(e);
    }
  };

  // 유저 정보 수정
  plugin.controllers.user.update = async (ctx) => {
    const { id: userId } = ctx.params;
    if (!ctx.state.user || ctx.state.user.id !== +userId) {
      return ctx.badRequest("Not Authorized");
    }

    try {
      const updatedUser = await strapi.entityService.update(
        "plugin::users-permissions.user",
        ctx.state.user.id,
        { data: { ...ctx.request.body } }
      );

      ctx.send("Update User Success");
    } catch (e) {
      console.log(e);
    }
  };

  // 나의 정보 조회
  plugin.controllers.user.me = async (ctx) => {
    if (!ctx.state.user) {
      return ctx.badRequest("Not Authorized");
    }
    try {
      const user = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        ctx.state.user.id,
        {
          populate: {
            photo: true,
            friendships_receive: {
              fields: ["status"],
              populate: { follow_sender: { fields: ["nickname"] } },
            },
          },
        }
      );

      const modifiedUser = {
        email: user.email,
        username: user.username,
        nickname: user.nickname,
        phone: user.phone,
        address: user.address,
        photo: user.photo,
        friendships_receive: user.friendships_receive,
      };

      ctx.send(modifiedUser);
    } catch (e) {
      console.log(e);
    }
  };

  // 유저 삭제
  plugin.controllers.user.destroy = async (ctx) => {
    if (!ctx.state.user || ctx.state.user.id !== +ctx.params.id) {
      return ctx.badRequest("Not Authorized");
    } else if (ctx.state.user.id === +ctx.params.id) {
      try {
        const deleteUser = await strapi.entityService.delete(
          "plugin::users-permissions.user",
          ctx.state.user.id
        );

        ctx.send("Delete User Success");
      } catch (e) {
        console.log(e);
      }
    }
  };

  return plugin;
};
