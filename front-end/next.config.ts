import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images:{
    remotePatterns: [
      new URL('https://res.cloudinary.com/**'),
      new URL('https://picsum.photos/**'),
      new URL('https://lh3.googleusercontent.com/**'),
    ],

  }
};


export default nextConfig;
