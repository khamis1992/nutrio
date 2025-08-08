/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  images: {
    domains: ['images.unsplash.com', 'loepcagitrijlfksawfm.supabase.co'],
  },
}

module.exports = nextConfig
