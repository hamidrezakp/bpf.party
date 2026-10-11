import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

const exercisesCollection = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/exercises" }),
});

export const collections = {
  exercises: exercisesCollection,
};
