import { renderHtml } from "./renderHtml";

export default {
  async fetch() {
    return new Response(renderHtml(), {
      headers: {
        "content-type": "text/html",
      },
    });
  },
} satisfies ExportedHandler<Env>;
