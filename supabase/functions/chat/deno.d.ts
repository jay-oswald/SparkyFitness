/// <reference lib="deno.window" />
/// <reference lib="deno.worker" />
/// <reference lib="deno.unstable" />

declare namespace Deno {
  export const env: {
    get(key: string): string | undefined;
  };
}

declare module "https://deno.land/std@0.224.0/http/server.ts" {
  export function serve(handler: (req: Request) => Promise<Response> | Response): Promise<void>;
}