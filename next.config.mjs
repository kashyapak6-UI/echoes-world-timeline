/** @type {import('next').NextConfig} */
const isStatic = process.env.STATIC_EXPORT === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || (isStatic ? "/echoes-world-timeline" : "");

const nextConfig = isStatic
  ? {
      output: "export",
      trailingSlash: true,
      images: { unoptimized: true },
      ...(basePath ? { basePath, assetPrefix: basePath } : {}),
    }
  : {};

export default nextConfig;
