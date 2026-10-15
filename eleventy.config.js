import { build } from "esbuild";

export default function (eleventyConfig) {
  const rawPrefix = process.env.SITE_PATH_PREFIX || "/";
  const segments = rawPrefix.split("/").filter(Boolean);
  const pathPrefix = segments.length ? `/${segments.join("/")}/` : "/";
  eleventyConfig.setNunjucksEnvironmentOptions({ autoescape: true });
  eleventyConfig.watchIgnores.add(".cache/**");
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({
    ".cache/tokenizer.js": "assets/tokenizer.js",
    "node_modules/gpt-tokenizer/LICENSE": "assets/tokenizer-LICENSE.txt",
  });
  eleventyConfig.on("eleventy.before", async () => {
    await build({
      entryPoints: ["lib/tokenizer-entry.js"],
      outfile: ".cache/tokenizer.js",
      bundle: true,
      minify: true,
      format: "esm",
      platform: "browser",
      target: "es2022",
      legalComments: "inline",
    });
  });
  eleventyConfig.addFilter("jsonScript", (value) =>
    JSON.stringify(value).replace(/</g, "\\u003c"),
  );
  eleventyConfig.addFilter(
    "siteUrl",
    (path = "") => pathPrefix + path.replace(/^\/+/, ""),
  );
  eleventyConfig.addFilter("toolSearch", (tool) =>
    [tool.name, tool.type, tool.summary, ...tool.capabilities].join(" "),
  );
  return {
    pathPrefix,
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
}
