/**
 * quote controller
 */

import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::quote.quote",
  ({ strapi }) => ({
    // 명언 조회
    async find(ctx) {
      try {
        const quotes = await strapi.entityService.findMany("api::quote.quote", {
          populate: { image: { populate: { formats: { fields: ["url"] } } } },
        });

        const modifiedQuotes = (quotes as any).map((quote) => ({
          id: quote.id,
          author: quote.author,
          body: quote.body,
          image: quote.url,
        }));

        return ctx.send(modifiedQuotes);
      } catch (error) {
        return ctx.notFound("The quotes do not exist.");
      }
    },

    async findOne(ctx) {
      const { id: quoteId } = ctx.params;

      try {
        const quote = await strapi.entityService.findOne(
          "api::quote.quote",
          quoteId,
          {
            populate: { image: { populate: { formats: { fields: ["url"] } } } },
          }
        );
        const modifiedQuote = {
          id: quote.id,
          author: quote.author,
          body: quote.body,
          image: quote.url,
        };

        return ctx.send(modifiedQuote);
      } catch (e) {
        return ctx.notFound("The quote does not exist.");
      }
    },
  })
);
