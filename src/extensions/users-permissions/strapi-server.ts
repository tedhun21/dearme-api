module.exports = (plugin) => {
  plugin.controllers.user.me = async (ctx) => {
    if (!ctx.state.user) {
      return ctx.badRequest("로그인을 해주세요");
    }
    try {
      const user = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        ctx.state.user.id,
        {
          populate: {
            photo: true,
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
      };

      ctx.send(modifiedUser);
    } catch (e) {
      console.log(e);
    }
  };
  return plugin;
};
