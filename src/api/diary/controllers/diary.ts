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

    // 일기 생성
    async create(ctx) {
      try {
        // 로그인 여부 검증
        if (!ctx.state.user) {
          return ctx.unauthorized("로그인이 필요합니다");
        }

        // 일기 데이터 추출 (Strapi가 자동으로 파싱한 데이터 사용)
        const data = JSON.parse(ctx.request.body.data);

        // 사진 파일 업로드
        const files = ctx.request.files;

        // 날짜 파라미터 추출
        const { date } = ctx.params;

        // // 날짜 형식 검증 (옵션)
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return ctx.badRequest("Invalid date format. Please use YYYY-MM-DD.");
        }

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

    // 일기 수정
    async update(ctx) {
      try {
        const userId = ctx.state.user.id; // 유저 ID 추출
        const { date } = ctx.params; // 날짜 파라미터 추출
        const files = ctx.request.files; // 사진 파일 데이터 추출
        const updateData = JSON.parse(ctx.request.body.data); // 수정할 데이터 추출

        // 유저와 연관된 일기 데이터 조회
        const userWithDiaries = await strapi.entityService.findOne(
          "plugin::users-permissions.user",
          userId,
          {
            populate: { diaries: true },
          }
        );

        if (!userWithDiaries || !userWithDiaries.diaries) {
          return ctx.notFound("유저 또는 유저의 일기를 찾을 수 없습니다.");
        }

        const diaries = userWithDiaries.diaries as any[];

        // 해당 날짜에 맞는 일기 필터링
        const diaryToUpdate = diaries.find((diary) => diary.date === date);

        if (!diaryToUpdate) {
          return ctx.notFound("해당 날짜의 일기를 찾을 수 없습니다.");
        }

        console.log(diaryToUpdate);

        // 일기 업데이트
        const updatedDiary = await strapi.entityService.update(
          "api::diary.diary",
          diaryToUpdate.id,
          {
            data: updateData,
            files: { photos: files.file },
          }
        );

        return ctx.send({
          message: "성공적으로 일기가 수정되었습니다",
          diary: updatedDiary,
        });
      } catch (e) {
        console.error(e);
        return ctx.badRequest("일기 수정 실패");
      }
    },

    async delete(ctx) {
      try {
        // 로그인 여부 검증
        if (!ctx.state.user) {
          return ctx.unauthorized("로그인이 필요합니다");
        }

        // 날짜 파라미터 추출
        const { date } = ctx.params;

        // 날짜 형식 검증
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return ctx.badRequest("Invalid date format. Please use YYYY-MM-DD.");
        }

        // 해당 날짜에 일치하는 일기 조회
        const diariesToDelete = (await strapi.entityService.findMany(
          "api::diary.diary",
          {
            filters: { date },
          }
        )) as any[];

        // 일기가 존재하는 경우, 각 일기 삭제
        if (diariesToDelete.length > 0) {
          await Promise.all(
            diariesToDelete.map((diary) =>
              strapi.entityService.delete("api::diary.diary", diary.id)
            )
          );
          return ctx.send(`Diaries for ${date} deleted successfully`);
        } else {
          return ctx.notFound(
            "해당 날짜의 일기가 존재하지 않거나 이미 삭제되었습니다"
          );
        }
      } catch (e) {
        console.error(e);
        return ctx.badRequest("Error deleting diaries");
      }
    },
  })
);
