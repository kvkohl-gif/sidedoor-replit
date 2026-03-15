import esbuild from "esbuild";
import { cpSync, mkdirSync } from "fs";

await esbuild.build({
  entryPoints: ["backend/index.ts"],
  platform: "node",
  packages: "external",
  bundle: true,
  format: "esm",
  outdir: "dist",
  alias: {
    "@shared": "./backend/shared",
  },
});

// Copy data files needed at runtime
mkdirSync("dist/data", { recursive: true });
cpSync("backend/data", "dist/data", { recursive: true });
