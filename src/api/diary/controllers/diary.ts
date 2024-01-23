/**
 * diary controller
 */

import { factories } from "@strapi/strapi";
import { errors } from "@strapi/utils";
const { UnauthorizedError, NotFoundError } = errors;

export default factories.createCoreController(
  "api::diary.diary",
  ({ strapi }) => ({
    // 일기 조회 (일일 또는 월별)
    async find(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid.");
      }

      if (!ctx.query.date) {
        return ctx.badRequest("date is required.");
      }
      // 날짜 형식 검증 (YYYY-MM-DD 또는 YYYY-MM)
      if (
        !(
          /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.date) ||
          /^\d{4}-\d{2}$/.test(ctx.query.date)
        )
      ) {
        return ctx.badRequest(
          "Invalid format. Please use YYYY-MM-DD or YYYY-MM."
        );
      }

      const { id: userId } = ctx.state.user;
      const { date } = ctx.query;

      try {
        let filters;

        if (date.length === 7) {
          // 월별 조회 ("YYYY-MM")
          const startDate = new Date(date + "-01");
          const endDate = new Date(
            new Date(date).setMonth(startDate.getMonth() + 1)
          );
          filters = { date: { $gte: startDate, $lt: endDate }, user: userId };
        } else {
          // 일일 조회 ("YYYY-MM-DD")
          filters = { date, user: userId };
        }

        // 일기 조회
        const diaries = await strapi.entityService.findMany(
          "api::diary.diary",
          {
            filters,
            populate: [
              "title",
              "body",
              "mood",
              "feelings",
              "companions",
              "weather",
              "remember",
            ],
          }
        );
        if (diaries.length === 0) {
          return ctx.notFound(`No diary found for ${date}.`);
        }

        return ctx.send(diaries);
      } catch (e) {
        console.error(e);
        return ctx.badRequest("Error retrieving diaries");
      }
    },

    // 일기 생성
    async create(ctx) {
      // 로그인 여부 검증
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid.");
      }

      if (!ctx.request.body.data || !ctx.query.date) {
        return ctx.badRequest("No data or query parameters available.");
      }

      // 날짜 형식 검증 (YYYY-MM-DD 또는 YYYY-MM)
      if (
        !(
          /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.date) ||
          /^\d{4}-\d{2}$/.test(ctx.query.date)
        )
      ) {
        return ctx.badRequest(
          "Invalid format. Please use YYYY-MM-DD or YYYY-MM."
        );
      }

      const { id: userId } = ctx.state.user;
      const { date } = ctx.query;

      // 같은 날짜에 일기가 기존에 있는지
      const diary = await strapi.entityService.findMany("api::diary.diary", {
        filters: { date: { $eq: date }, user: userId },
      });

      if (diary.length === 0) {
        try {
          // 일기 데이터 추출 (Strapi가 자동으로 파싱한 데이터 사용)
          const parsedData = JSON.parse(ctx.request.body.data);

          // 사진 파일 업로드
          const files = ctx.request.files;

          // // 날짜 형식 검증 (옵션)
          if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return ctx.badRequest(
              "Invalid date format. Please use YYYY-MM-DD."
            );
          }

          let data = {
            data: { date, user: userId, ...parsedData },
            files: files.file ? { photos: files.file } : {},
          };

          const newDiary = await strapi.entityService.create(
            "api::diary.diary",
            data
          );

          return ctx.send("Successfully created a diary.");
        } catch (e) {
          console.error(e);
          return ctx.badRequest("Failed to create diary.");
        }
      } else {
        return ctx.badRequest("A diary already exists for this date.");
      }
    },

    // 일기 수정
    async update(ctx) {
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid.");
      }

      if (!ctx.query.date) {
        return ctx.badRequest("date is required.");
      }

      if (!ctx.request.body.data || !ctx.query.date) {
        return ctx.badRequest("No data or query parameters available.");
      }

      // 날짜 형식 검증 (YYYY-MM-DD 또는 YYYY-MM)
      if (
        !(
          /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.date) ||
          /^\d{4}-\d{2}$/.test(ctx.query.date)
        )
      ) {
        return ctx.badRequest(
          "Invalid format. Please use YYYY-MM-DD or YYYY-MM."
        );
      }

      const { id: userId } = ctx.state.user;
      const { date } = ctx.query;
      const files = ctx.request.files;
      const parsedData = JSON.parse(ctx.request.body.data);

      try {
        // 유저와 연관된 일기 데이터 조회
        const diary = await strapi.entityService.findMany("api::diary.diary", {
          filters: { date: { $eq: date }, user: userId },
        });

        if (diary.length !== 0) {
          let data = {
            data: {
              date,
              user: userId,
              ...parsedData,
            },
            files: files.file ? { photos: files.file } : {},
          };

          const updatedDiary = await strapi.entityService.update(
            "api::diary.diary",
            diary[0].id,
            data
          );
        } else {
          return ctx.notFound("No diary found for update.");
        }

        return ctx.send("Successfully updated a diary.");
      } catch (e) {
        console.error(e);
        return ctx.badRequest("일기 수정 실패");
      }
    },

    // 일기 삭제
    async delete(ctx) {
      // 로그인 여부 검증
      if (!ctx.state.user) {
        return ctx.unauthorized("Authentication token is missing or invalid.");
      }

      // 날짜 형식 검증
      if (!ctx.query.date || !/^\d{4}-\d{2}-\d{2}$/.test(ctx.query.date)) {
        return ctx.badRequest("Invalid date format. Please use YYYY-MM-DD.");
      }

      // 날짜 파라미터 추출
      const { date } = ctx.query;

      try {
        // 해당 날짜에 일치하는 일기 조회
        const diary = await strapi.entityService.findMany("api::diary.diary", {
          filters: { date: { $eq: date } },
        });

        // // 일기가 존재하는 경우, 각 일기 삭제
        if ((diary.length as number) > 0) {
          const deletedDiary = await strapi.entityService.delete(
            "api::diary.diary",
            diary[0].id
          );
          return ctx.send(`Diaries for ${date} deleted successfully`);
        } else {
          return ctx.notFound(
            "The diary for the specified date does not exist or has already been deleted."
          );
        }
      } catch (e) {
        console.error(e);
        return ctx.badRequest("Failed to delete the diary.");
      }
    },
  })
);
