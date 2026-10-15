export default function (eleventyConfig) {
  const rawPrefix = process.env.SITE_PATH_PREFIX || "/";
  const segments = rawPrefix.split("/").filter(Boolean);
  const pathPrefix = segments.length ? `/${segments.join("/")}/` : "/";
  eleventyConfig.setNunjucksEnvironmentOptions({ autoescape: true });
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
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
