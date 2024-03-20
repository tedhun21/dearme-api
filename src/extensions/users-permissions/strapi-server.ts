module.exports = (plugin) => {
  // 유저 등록
  plugin.controllers.auth.register = async (ctx) => {
    const { username, email, nickname, password } = ctx.request.body;

    try {
      // 닉네임 중복 체크
      const existingUserWithNickname = await strapi.entityService.findMany(
        "plugin::users-permissions.user",
        { filters: { nickname } }
      );

      if ((existingUserWithNickname as any).length > 0) {
        return ctx.conflict("The username already exists.");
      }

      // email 중복체크
      const existingUserWithEmail = await strapi.entityService.findMany(
        "plugin::users-permissions.user",
        { filters: { email } }
      );

      if ((existingUserWithEmail as any).length > 0) {
        return ctx.conflict("The email already exists.");
      }

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

      return ctx.send({
        message: "Successfully create a user.",
        userId: newMember.id,
      });
    } catch (e) {
      return ctx.badRequest("Fail to create a user.");
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
        return ctx.notFound("The user cannot be found");
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

      return ctx.send(modifiedUser);
    } catch (e) {
      return ctx.notFound("The user cannot be found");
    }
  };

  // 나의 정보 조회
  plugin.controllers.user.me = async (ctx) => {
    if (!ctx.state.user) {
      return ctx.unauthorized("Authentication token is missing or invalid");
    }

    try {
      const me = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        ctx.state.user.id,
        {
          populate: {
            photo: { fields: ["url"] },
            background: { fields: ["url"] },
            friendships_receive: {
              fields: ["status"],
              populate: { follow_sender: { fields: ["nickname"] } },
            },
          },
        }
      );

      // 친구 카운트
      const [entries, count] = await strapi.db
        .query("api::friendship.friendship")
        .findWithCount({
          where: {
            $or: [
              {
                $and: [{ follow_sender: me.id }, { status: "FRIEND" }],
              },
              {
                $and: [{ follow_receiver: me.id }, { status: "FRIEND" }],
              },
              {
                $and: [{ $not: { block: me.id } }, { status: "BLOCK_ONE" }],
              },
            ],
          },
        });

      const modifiedMe = {
        id: me.id,
        email: me.email,
        username: me.username,
        nickname: me.nickname,
        phone: me.phone,
        body: me.body,
        photo: me.photo ? me.photo : null,
        background: me.background ? me.background : null,
        private: me.private,
        friendCount: count && count,
      };

      return ctx.send(modifiedMe);
    } catch (e) {
      return ctx.notFound("The user cannot be found");
    }
  };

  // 유저 정보 수정
  plugin.controllers.user.update = async (ctx) => {
    const { id: userId } = ctx.params;

    if (!ctx.state.user || ctx.state.user.id !== +userId) {
      return ctx.unauthorized("Authentication token is missing or invalid");
    }

    const { photo, background } = ctx.request.files;

    const parsedData = JSON.parse(ctx.request.body.data);

    if (Object.keys(parsedData).length > 0 && parsedData.nickname.length < 2) {
      return ctx.badRequest("nickname has to be more than 1 character", {
        field: "nickname",
      });
    }

    try {
      const me = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        userId
      );

      if (parsedData.nickname) {
        const existingUserWithNickname = await strapi.entityService.findMany(
          "plugin::users-permissions.user",
          {
            filters: {
              nickname: { $eq: parsedData.nickname, $not: me.nickname },
            },
          }
        );

        if (
          existingUserWithNickname &&
          (existingUserWithNickname as any).length > 0
        ) {
          return ctx.badRequest("Already nickname exists", {
            field: "nickname",
          });
        }
      }

      if (parsedData.phone) {
        const existingUserWithPhone = await strapi.entityService.findMany(
          "plugin::users-permissions.user",
          { filters: { phone: { $eq: parsedData.phone, $not: me.phone } } }
        );

        if (
          existingUserWithPhone &&
          (existingUserWithPhone as any).length > 0
        ) {
          return ctx.badRequest("Already phone exists", {
            field: "phone",
          });
        }
      }

      const updatedUser = await strapi.entityService.update(
        "plugin::users-permissions.user",
        userId,
        {
          data: { ...parsedData },
          files:
            photo && background
              ? { photo: photo, background: background }
              : photo && !background
              ? { photo: photo }
              : background && !photo
              ? { background: background }
              : null,
        }
      );

      return ctx.send({
        message: "Successfully update this user",
        userId: updatedUser.id,
      });
    } catch (e) {
      return ctx.badRequest("Fail to update the user");
    }
  };

  // 유저 삭제
  plugin.controllers.user.destroy = async (ctx) => {
    const { id: userId } = ctx.state.user;

    if (!ctx.state.user || ctx.state.user.id !== +userId) {
      return ctx.unauthorized("Authentication token is missing or invalid");
    }
    if (ctx.state.user.id !== +ctx.params.id) {
      return ctx.unauthorized("User does not match");
    } else {
      try {
        const deleteUser = await strapi.entityService.delete(
          "plugin::users-permissions.user",
          userId
        );

        return ctx.send({
          message: "Successfully delete the user",
          userId: deleteUser.id,
        });
      } catch (e) {
        return ctx.badRequest("Fail to delete the user");
      }
    }
  };

  // nickname 중복 체크
  plugin.controllers.user.checkNickname = async (ctx) => {
    const { nickname } = ctx.query;

    try {
      const existingUserWithNickname = await strapi.entityService.findMany(
        "plugin::users-permissions.user",
        { filters: { nickname } }
      );
      if ((existingUserWithNickname as any).length > 0) {
        return ctx.send({ duplicate: true });
      } else {
        return ctx.send({ duplicate: false });
      }
    } catch (e) {
      return ctx.badRequest("Fail to check duplicate");
    }
  };

  // email 중복 체크
  plugin.controllers.user.checkEmail = async (ctx) => {
    const { email } = ctx.query;
    try {
      const existingUserWithEmail = await strapi.entityService.findMany(
        "plugin::users-permissions.user",
        { filters: { email } }
      );
      if ((existingUserWithEmail as any).length > 0) {
        return ctx.send({ duplicate: true });
      } else {
        return ctx.send({ duplicate: false });
      }
    } catch (e) {
      return ctx.badRequest("Fail to check duplicate");
    }
  };

  // Email로 사용자 조회
  plugin.controllers.user.findByEmail = async (ctx) => {
    const { email } = ctx.query;

    if (!email) {
      return ctx.badRequest("email is missing");
    }

    try {
      const user = await strapi.entityService.findMany(
        "plugin::users-permissions.user",
        {
          filters: { email },
          fields: ["email", "phone"],
        }
      );

      if (!user) {
        return ctx.notFound("User not found");
      }

      // return ctx.send(user[0]);
      return ctx.send({
        email: user[0].email,
        phone: user[0].phone,
      });
    } catch (error) {
      return ctx.badRequest("Fail to find user");
    }
  };

  // user 검색
  plugin.controllers.user.searchUsers = async (ctx) => {
    const { searchTerm } = ctx.query;

    try {
      const users = await strapi.db
        .query("plugin::users-permissions.user")
        .findMany({
          populate: {
            photo: true,
          },
          where: {
            nickname: {
              $containsi: searchTerm,
            },
          },
        });

      const usersData = users.map((user) => ({
        id: user.id,
        photo: user.photo && user.photo.formats.thumbnail.url,
        nickname: user.nickname,
      }));

      return ctx.send(usersData);
    } catch (e) {
      return ctx.badRequest("Fail to search users");
    }
  };

  // nickname 중복 체크 route
  plugin.routes["content-api"].routes.push({
    method: "GET",
    path: "/check-nickname",
    handler: "user.checkNickname",
    config: {
      prefix: "",
    },
  });

  // email 중복 체크 route
  plugin.routes["content-api"].routes.push({
    method: "GET",
    path: "/check-email",
    handler: "user.checkEmail",
    config: {
      prefix: "",
    },
  });

  // Email 사용자 조회 route
  plugin.routes["content-api"].routes.push({
    method: "GET",
    path: "/find-by-email",
    handler: "user.findByEmail",
    config: {
      prefix: "",
    },
  });

  // user 검색 route
  plugin.routes["content-api"].routes.push({
    method: "GET",
    path: "/search-users",
    handler: "user.searchUsers",
    config: {
      prefix: "",
    },
  });

  return plugin;
};
