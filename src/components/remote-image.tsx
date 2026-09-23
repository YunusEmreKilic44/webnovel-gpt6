"use client";
import Image, { type ImageProps } from "next/image";
import { imageSource } from "@/lib/cloudinary-loader";

/**
 * next/image for uploaded media. The Cloudinary loader is a function, which a
 * Server Component cannot pass to a Client Component, so it is attached here.
 */
export function RemoteImage(props: Omit<ImageProps, "src"> & { src: string }) {
  // alt is required by ImageProps and forwarded with the rest of props.
  // eslint-disable-next-line jsx-a11y/alt-text
  return <Image {...props} {...imageSource(props.src)} />;
}
