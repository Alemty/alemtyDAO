
/// <reference types="@cloudflare/workers-types" />
/// <reference path="../worker-configuration.d.ts" />

interface Env extends Cloudflare.Env {
  SESSION_SECRET: string;
}


