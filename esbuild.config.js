import esbuild from "esbuild";

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
