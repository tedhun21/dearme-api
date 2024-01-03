/**
 * diary controller
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::diary.diary",
  ({ strapi }) => ({
    // 일기 조회 (일일 또는 월별)
    async find(ctx) {
      try {
        // 날짜 또는 월 파라미터 추출
        const { dateOrMonth } = ctx.params;

        // 날짜 형식 검증 (YYYY-MM-DD 또는 YYYY-MM)
        if (
          !dateOrMonth ||
          !(
            /^\d{4}-\d{2}-\d{2}$/.test(dateOrMonth) ||
            /^\d{4}-\d{2}$/.test(dateOrMonth)
          )
        ) {
          return ctx.badRequest(
            "Invalid format. Please use YYYY-MM-DD or YYYY-MM."
          );
        }

        let filters;
        if (dateOrMonth.length === 7) {
          // 월별 조회 ("YYYY-MM")
          const startDate = new Date(dateOrMonth + "-01");
          const endDate = new Date(
            new Date(dateOrMonth).setMonth(startDate.getMonth() + 1)
          );
          filters = { date: { $gte: startDate, $lt: endDate } };
        } else {
          // 일일 조회 ("YYYY-MM-DD")
          filters = { date: dateOrMonth };
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

        return ctx.send(diaries);
      } catch (e) {
        console.error(e);
        return ctx.badRequest("Error retrieving diaries");
      }
    },

    // 일기 일일 생성
    async create(ctx) {
      try {
        // // 로그인 여부 검증
        // if (!ctx.state.user) {
        //     ctx.send("로그인이 필요합니다");
        // }

        // 일기 데이터 추출 (Strapi가 자동으로 파싱한 데이터 사용)
        const data = JSON.parse(ctx.request.body.data);

        // 사진 파일 업로드
        const files = ctx.request.files;

        const { date } = ctx.params;

        // // 날짜 형식 검증 (옵션)
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return ctx.badRequest("Invalid date format. Please use YYYY-MM-DD.");
        }

        // 일기 생성
        const newdiary = await strapi.entityService.create("api::diary.diary", {
          data: {
            date,
            title: data.title,
            body: data.body,
            mood: data.mood,
            feelings: data.feelings,
            companions: data.companions,
            weather: data.weather,
            remember: data.remember,
            startSleep: data.startSleep,
            endSleep: data.endSleep,
          },
          files: { photos: files.file },
        });

        const diaryWithPhotos = await strapi.entityService.findOne(
          "api::diary.diary",
          newdiary.id,
          { populate: ["photos"] }
        );

        return ctx.send({ diary: diaryWithPhotos });
      } catch (e) {
        console.error(e);
        return ctx.badRequest("일기 생성 실패");
      }
    },

    // async delete(ctx) {
    //   try {
    //     // // 로그인 여부 검증
    //     // if (!ctx.state.user) {
    //     //     ctx.send("로그인이 필요합니다");
    //     // }

    //     const { date } = ctx.params;

    //     // // 날짜 형식 검증 (옵션)
    //     if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    //       return ctx.badRequest("Invalid date format. Please use YYYY-MM-DD.");
    //     }

    //     // 해당 날짜에 일치하는 일기 조회 및 삭제
    //     await strapi.entityService.delete("api::diary.diary", date);

    //     return ctx.send({
    //       message: `Diaries for ${date} deleted successfully`,
    //     });
    //   } catch (e) {
    //     console.error(e);
    //     return ctx.badRequest("일기를 삭제하지 못했습니다");
    //   }
    // },
  })
);
