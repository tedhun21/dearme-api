/**
 * diary controller
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::diary.diary",
  ({ strapi }) => ({
    // 일기 조회 (일일 또는 월별)
    async find(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid");
      }

      if (!ctx.query.date) {
        return ctx.badRequest("date is required");
      }
      // 날짜 형식 검증 (YYYY-MM-DD 또는 YYYY-MM)
      if (
        !(
          /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.date) ||
          /^\d{4}-\d{2}$/.test(ctx.query.date)
        )
      ) {
        return ctx.badRequest(
          "Invalid format. Please use YYYY-MM-DD or YYYY-MM"
        );
      }

      const { id: userId } = ctx.state.user;
      const { date, remember, page, size } = ctx.query;

      try {
        let filters;

        // diary 중 remember만
        if (date.length === 7 && remember) {
          const startDate = new Date(date + "-01");
          const endDate = new Date(
            new Date(date).setMonth(startDate.getMonth() + 1)
          );

          filters = {
            date: { $gte: startDate, $lt: endDate },
            user: userId,
            remember,
          };

          const remembers = await strapi.entityService.findMany(
            "api::diary.diary",
            {
              sort: { date: "asc" },
              filters,
              populate: { photos: { fields: ["url"] } },
            }
          );

          const modifiedRemembers = (remembers as any).map((remember) => ({
            ...remember,
            feelings: JSON.parse(remember.feelings),
          }));

          return ctx.send(modifiedRemembers);
        } else if (date.length === 7 && !remember) {
          // 월별 조회 ("YYYY-MM")
          const startDate = new Date(date + "-01");
          const endDate = new Date(
            new Date(date).setMonth(startDate.getMonth() + 1)
          );

          filters = { date: { $gte: startDate, $lt: endDate }, user: userId };

          // 일기 조회
          const diaries = await strapi.entityService.findMany(
            "api::diary.diary",
            {
              sort: { date: "asc" },
              filters,
              populate: { photos: { fields: ["id", "url"] } },
            }
          );

          return ctx.send(diaries);
        } else if (date.length === 10) {
          // 일일 조회 ("YYYY-MM-DD")
          filters = { date, user: userId };

          // 일기 조회
          const diaries = await strapi.entityService.findMany(
            "api::diary.diary",
            {
              filters,
              populate: {
                photos: { fields: ["id", "url"] },
                today_picks: { populate: { image: { fields: ["id", "url"] } } },
              },
              page,
              pageSize: size,
            }
          );

          // if (diaries.length === 0) {
          //   return ctx.notFound(`No diary found for ${date}`);
          // }

          return ctx.send(diaries[0]);
        }
      } catch (e) {
        return ctx.notFound("The diaries cannot be found");
      }
    },

    // 일기 생성
    async create(ctx) {
      // 로그인 여부 검증
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid");
      }

      if (!ctx.request.body.data || !ctx.query.date) {
        return ctx.badRequest("No data or query parameters available");
      }

      // 날짜 형식 검증 (YYYY-MM-DD 또는 YYYY-MM)
      if (
        !(
          /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.date) ||
          /^\d{4}-\d{2}$/.test(ctx.query.date)
        )
      ) {
        return ctx.badRequest(
          "Invalid format. Please use YYYY-MM-DD or YYYY-MM"
        );
      }

      const { id: userId } = ctx.state.user;
      const { date } = ctx.query;
      const parsedData = JSON.parse(ctx.request.body.data);
      const { photos } = ctx.request.files;

      // 같은 날짜에 일기가 기존에 있는지
      const diary = await strapi.entityService.findMany("api::diary.diary", {
        filters: { date: { $eq: date }, user: userId },
      });

      if ((diary as any)?.length > 0) {
        return ctx.badRequest("A diary already exists for this date");
      }

      try {
        let data = {
          data: {
            ...parsedData,
            date,
            feelings: JSON.stringify(parsedData.feelings),
            user: { id: userId },
            remember: false,
          },
          files: photos ? { photos } : null,
        };

        const newDiary = await strapi.entityService.create(
          "api::diary.diary",
          data
        );

        return ctx.send({
          message: "Successfully create a diary",
          diaryId: newDiary.id,
        });
      } catch (e) {
        return ctx.badRequest("Fail to create a diary.");
      }
    },

    // 일기 수정
    async update(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid");
      }

      if (!ctx.request.params) {
        return ctx.badRequest("No data or query parameters available");
      }

      const { id: userId } = ctx.state.user;
      const { diaryId } = ctx.request.params;
      const { photos } = ctx.request.files;
      const parsedData = JSON.parse(ctx.request.body.data);

      const { remember }: { remember?: boolean } = ctx.query;

      try {
        const diary = await strapi.entityService.findOne(
          "api::diary.diary",
          diaryId,
          { populate: { user: { fields: ["id", "nickname"] } } }
        );

        if ((diary.user as any).id !== userId) {
          return ctx.unauthorized("No permission to update this diary");
        }

        let data;
        if (remember) {
          data = { data: { remember: !diary.remember } };
        } else {
          data = {
            data: {
              user: { id: userId },
              ...parsedData,
              feelings: JSON.stringify(parsedData.feelings),
            },
            files: photos ? { photos } : null,
          };
        }

        const updatedDiary = await strapi.entityService.update(
          "api::diary.diary",
          diary.id,
          data
        );

        return ctx.send({
          messsage: "Successfully update the diary",
          diaryId: updatedDiary.id,
          remember: updatedDiary.remember,
        });
      } catch (e) {
        return ctx.badRequest("Fail to update the diary");
      }
    },

    // 일기 삭제
    async delete(ctx) {
      // 로그인 여부 검증
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid");
      }

      // 날짜 파라미터 추출
      const { diaryId } = ctx.params;
      const { id: userId } = ctx.state.user;

      try {
        // 해당 날짜에 일치하는 일기 조회
        const diary = await strapi.entityService.findOne(
          "api::diary.diary",
          diaryId,
          { populate: { user: { fields: ["id"] } } }
        );

        // 일기가 존재하지 않을 때
        if (!diary) {
          return ctx.notFound("The diary cannot be found");
        }

        // 일치의 소유자와 일치하지 않을 때
        if ((diary.user as any).id !== userId) {
          return ctx.forbidden("No permission to delete the diary");
        }

        const deletedDiary = await strapi.entityService.delete(
          "api::diary.diary",
          diary.id
        );
        return ctx.send({
          diaryId: deletedDiary.id,
        });
      } catch (e) {
        return ctx.badRequest("Fail to delete the diary");
      }
    },

    // 일기 검색 (월별 다이어리)
    async search(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid");
      }

      const { searchTerm, date } = ctx.query;

      try {
        const startDate = new Date(date + "-01");
        const endDate = new Date(
          new Date(date).setMonth(startDate.getMonth() + 1)
        );

        const diaries = await strapi.db.query("api::diary.diary").findMany({
          filters: {
            $and: [
              {
                $or: [
                  { title: { $containsi: searchTerm } },
                  { body: { $containsi: searchTerm } },
                ],
              },
              { date: { $gte: startDate, $lt: endDate } },
            ],
          },
        });

        const modifiedDiaries =
          Array.isArray(diaries) && diaries.map((diary) => diary.id);

        return ctx.send(modifiedDiaries);
      } catch (e) {
        return ctx.badRequest("Fail to search the diary");
      }
    },
  })
);
