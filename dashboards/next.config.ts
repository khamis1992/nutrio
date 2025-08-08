import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@supabase/supabase-js'],
  },
  images: {
    domains: ['images.unsplash.com', 'loepcagitrijlfksawfm.supabase.co'],
  },
};

export default nextConfig;
