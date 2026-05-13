
/// <reference types="@cloudflare/workers-types" />
/// <reference path="../worker-configuration.d.ts" />


interface Env extends Cloudflare.Env {
  DB: D1Database;
  JWT_SECRET: string;
  SESSION_SECRET: string;
  ASSETS: Fetcher;
}



