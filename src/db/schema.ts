import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { JSONContent } from "@tiptap/react";

const time = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => time("created_at").defaultNow().notNull();

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  role: text("role", { enum: ["reader", "admin"] })
    .default("reader")
    .notNull(),
  createdAt: createdAt(),
  updatedAt: time("updated_at").defaultNow().notNull(),
});
export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: time("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: createdAt(),
  updatedAt: time("updated_at").defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});
export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: time("access_token_expires_at"),
  refreshTokenExpiresAt: time("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: createdAt(),
  updatedAt: time("updated_at").defaultNow().notNull(),
});
export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: time("expires_at").notNull(),
  createdAt: createdAt(),
  updatedAt: time("updated_at").defaultNow().notNull(),
});

export const books = pgTable(
  "books",
  {
    id: text("id").primaryKey(),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    subtitle: text("subtitle").default("").notNull(),
    description: text("description").notNull(),
    genre: text("genre").notNull(),
    cover: text("cover", {
      enum: ["ember", "ocean", "forest", "violet", "sand", "rose"],
    })
      .default("ember")
      .notNull(),
    status: text("status", {
      enum: ["DRAFT", "APPROVED", "PUBLISHED", "ARCHIVED"],
    })
      .default("DRAFT")
      .notNull(),
    storyStatus: text("story_status", {
      enum: ["ONGOING", "COMPLETED", "HIATUS"],
    })
      .default("ONGOING")
      .notNull(),
    premiumStatus: text("premium_status", {
      enum: ["NONE", "ACTIVE", "SUSPENDED", "REVOKED"],
    })
      .default("NONE")
      .notNull(),
    firstPremiumApprovedAt: time("first_premium_approved_at"),
    hidden: boolean("hidden").default(false).notNull(),
    featured: boolean("featured").default(false).notNull(),
    createdAt: createdAt(),
    updatedAt: time("updated_at").defaultNow().notNull(),
  },
  (t) => [index("books_catalog_idx").on(t.status, t.hidden, t.updatedAt)],
);

export const volumes = pgTable(
  "volumes",
  {
    id: text("id").primaryKey(),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id),
    title: text("title").notNull(),
    position: integer("position").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("volumes_position_idx").on(t.bookId, t.position)],
);

export const chapters = pgTable(
  "chapters",
  {
    id: text("id").primaryKey(),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id),
    volumeId: text("volume_id")
      .notNull()
      .references(() => volumes.id),
    title: text("title").notNull(),
    position: integer("position").notNull(),
    content: jsonb("content").$type<JSONContent>().notNull(),
    publishedContent: jsonb("published_content").$type<JSONContent>(),
    publishedTitle: text("published_title"),
    wordCount: integer("word_count").default(0).notNull(),
    publishedWordCount: integer("published_word_count").default(0).notNull(),
    status: text("status", { enum: ["DRAFT", "PUBLISHED"] })
      .default("DRAFT")
      .notNull(),
    accessType: text("access_type", { enum: ["FREE", "PAID"] })
      .default("FREE")
      .notNull(),
    priceMinor: integer("price_minor").default(0).notNull(),
    firstPublishedAt: time("first_published_at"),
    version: integer("version").default(1).notNull(),
    hidden: boolean("hidden").default(false).notNull(),
    createdAt: createdAt(),
    updatedAt: time("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("chapters_position_idx").on(t.volumeId, t.position),
    index("chapters_book_idx").on(t.bookId, t.status),
    check(
      "chapter_price_valid",
      sql`(${t.accessType} = 'FREE' AND ${t.priceMinor} = 0) OR (${t.accessType} = 'PAID' AND ${t.priceMinor} > 0)`,
    ),
    check(
      "published_requires_content",
      sql`${t.status} <> 'PUBLISHED' OR (${t.firstPublishedAt} IS NOT NULL AND ${t.publishedContent} IS NOT NULL AND ${t.publishedTitle} IS NOT NULL)`,
    ),
  ],
);

export const chapterRevisions = pgTable(
  "chapter_revisions",
  {
    id: text("id").primaryKey(),
    chapterId: text("chapter_id")
      .notNull()
      .references(() => chapters.id),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    content: jsonb("content").$type<JSONContent>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("revision_version_idx").on(t.chapterId, t.version)],
);

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
export const applications = pgTable(
  "applications",
  {
    id: text("id").primaryKey(),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id),
    type: text("type", { enum: ["PUBLICATION", "PREMIUM"] }).notNull(),
    status: text("status", { enum: ["PENDING", "APPROVED", "REJECTED"] })
      .default("PENDING")
      .notNull(),
    snapshot: jsonb("snapshot").$type<ApplicationSnapshot>().notNull(),
    note: text("note").default("").notNull(),
    reviewerId: text("reviewer_id").references(() => user.id),
    createdAt: createdAt(),
    reviewedAt: time("reviewed_at"),
  },
  (t) => [
    uniqueIndex("one_pending_application_idx")
      .on(t.bookId, t.type)
      .where(sql`${t.status} = 'PENDING'`),
  ],
);

export const ratings = pgTable(
  "ratings",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id),
    score: integer("score").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("rating_user_book_idx").on(t.userId, t.bookId),
    check("rating_score_range", sql`${t.score} BETWEEN 1 AND 5`),
  ],
);
export const comments = pgTable("comments", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  bookId: text("book_id")
    .notNull()
    .references(() => books.id),
  body: text("body").notNull(),
  spoiler: boolean("spoiler").default(false).notNull(),
  hidden: boolean("hidden").default(false).notNull(),
  createdAt: createdAt(),
});
export const libraryEntries = pgTable(
  "library_entries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("library_user_book_idx").on(t.userId, t.bookId)],
);
export const readingProgress = pgTable(
  "reading_progress",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id),
    chapterId: text("chapter_id")
      .notNull()
      .references(() => chapters.id),
    updatedAt: time("updated_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("progress_user_book_idx").on(t.userId, t.bookId)],
);
export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  actorId: text("actor_id")
    .notNull()
    .references(() => user.id),
  action: text("action").notNull(),
  targetId: text("target_id").notNull(),
  detail: text("detail").default("").notNull(),
  createdAt: createdAt(),
});
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").default(1).notNull(),
  windowStart: time("window_start").defaultNow().notNull(),
});

export type Book = typeof books.$inferSelect;
export type Chapter = typeof chapters.$inferSelect;
export type Actor = Pick<
  typeof user.$inferSelect,
  "id" | "role" | "emailVerified" | "name"
>;
