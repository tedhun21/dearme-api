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
              filters,
              populate: { photos: { fields: ["url"] } },
              fields: ["id", "mood", "date", "title", "weatherId", "weather"],
              sort: { date: "asc" },
            }
          );

          const modifiedRemembers =
            Array.isArray(remembers) &&
            remembers.map((remember) => ({
              ...remember,
              date: (remember as any).date,
              photos: (remember as any).photos[0].url,
            }));

          if ((remembers as any).length === 0) {
            return ctx.notFound(`No diary found for ${date}`);
          }

          return ctx.send(modifiedRemembers);
        } else if (date.length === 7) {
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
              filters,
              populate: { photos: { fields: ["id", "url"] } },
              page,
              pageSize: size,
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
              populate: { photos: { fields: ["id", "url"] } },
              page,
              pageSize: size,
            }
          );

          if (diaries.length === 0) {
            return ctx.notFound(`No diary found for ${date}`);
          }

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

      try {
        // 같은 날짜에 일기가 기존에 있는지
        const diary = await strapi.entityService.findMany("api::diary.diary", {
          filters: { date: { $eq: date }, user: userId },
        });

        if (diary.length === 0) {
          // 일기 데이터 추출 (Strapi가 자동으로 파싱한 데이터 사용)
          const parsedData = JSON.parse(ctx.request.body.data);

          // 사진 파일 업로드
          const { photos, todayPickImage } = ctx.request.files;

          let uploadFiles = {
            ...(photos && { photos: photos }),
            ...(todayPickImage && { todayPickImage: todayPickImage }),
          };

          let data = {
            data: { date, user: userId, ...parsedData },
            files: uploadFiles ? uploadFiles : null,
          };

          const newDiary = await strapi.entityService.create(
            "api::diary.diary",
            data
          );

          return ctx.send({
            message: "Successfully create a diary",
            diaryId: newDiary.id,
          });
        } else {
          return ctx.badRequest("A diary already exists for this date");
        }
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

      const { remember }: { remember?: boolean } = ctx.query;

      const { id: userId } = ctx.state.user;
      const { diaryId } = ctx.request.params;
      const { file } = ctx.request.files;
      const parsedData = JSON.parse(ctx.request.body.data);

      if (remember) {
        try {
          const diary = await strapi.entityService.findOne(
            "api::diary.diary",
            diaryId,
            { populate: { user: { fields: ["id", "nickname"] } } }
          );

          if ((diary.user as any).id !== userId) {
            return ctx.unauthorized("No permission to update this diary");
          }

          const updatedDiary = await strapi.entityService.update(
            "api::diary.diary",
            diary.id,
            { data: { remember } } as any
          );

          return ctx.send({ remember: updatedDiary.remember });
        } catch (e) {}
      } else {
        try {
          const diary = await strapi.entityService.findOne(
            "api::diary.diary",
            diaryId,
            { populate: { user: { fields: ["id", "nickname"] } } }
          );

          if ((diary.user as any).id !== userId) {
            return ctx.unauthorized("No permission to update this diary");
          }

          let data = {
            data: {
              user: userId,
              ...parsedData,
            },
            files: file ? { photos: file } : null,
          };

          const updatedDiary = await strapi.entityService.update(
            "api::diary.diary",
            diary.id,
            data
          );

          return ctx.send(updatedDiary);
        } catch (e) {
          return ctx.badRequest("Fail to update the diary");
        }
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
  })
);
