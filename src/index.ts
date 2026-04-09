
import { router } from "./router";

export default {
  fetch(request: Request) {
    const response = router(request);
    if (response) return response;

    return new Response("Not Found", { status: 404 });
  }
};
