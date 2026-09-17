import type { JSONContent } from "@tiptap/react";
import type { User } from "@/generated/prisma/client";
export type { Book, Chapter } from "@/generated/prisma/client";
export type Actor = Pick<User, "id" | "role" | "emailVerified" | "name">;
export type ApplicationSnapshot = {
  title: string;
  description: string;
  genre: string;
  chapters: {
    id: string;
    title: string;
    version: number;
    content: JSONContent;
  }[];
};
