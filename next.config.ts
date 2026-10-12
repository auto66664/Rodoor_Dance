import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // รูปโปรไฟล์จาก Supabase Storage (bucket avatars)
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/avatars/**",
      },
    ],
  },
};

export default nextConfig;
