
import { router } from "./router";

export interface Env {
  DB: D1Database;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {

    const response = router(request);
    if (response) return response;

    return new Response("Not Found", { status: 404 });
  }
};

