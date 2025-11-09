import defineConfig from "es-pkg";

export default defineConfig({
    "es": "./npm/esm",
    "cjs": "./npm/cjs",
    "typings": "./src",
    "entry":"./src",
    "publishDir":"./npm"
})