
export default {
  fetch(request, env, ctx) {
    return env.ASSETS.fetch(request);
  }
};
