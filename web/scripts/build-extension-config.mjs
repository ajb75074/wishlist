import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

const environment = loadEnv("production", process.cwd(), "VITE_");
const supabaseUrl = environment.VITE_SUPABASE_URL;
const supabasePublishableKey =
  environment.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error("Supabase environment variables are missing.");
}

const extensionConfigUrl = new URL(
  "../../extension/config.local.js",
  import.meta.url,
);

await mkdir(new URL("../../extension/", import.meta.url), { recursive: true });
await writeFile(
  fileURLToPath(extensionConfigUrl),
  `globalThis.WishlistExtensionConfig = Object.freeze(${JSON.stringify({
    supabaseUrl,
    supabasePublishableKey,
    wishlistTable: "wishitems",
  })});\n`,
);
