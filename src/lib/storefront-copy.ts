import copy from "@/content/copy.json";
import english from "@/content/storefront.en.json";
import posts from "@/content/posts.json";
import images from "@/content/images.json";
import type { Locale } from "@/i18n/routing";

export function editorialCopy(locale: Locale) {
  return locale === "en" ? english : copy;
}

export function qualityStepsFor(locale: Locale) {
  return copy.steps.map((step) => {
    const localized =
      locale === "en"
        ? (english.steps.find(({ n }) => n === step.n) ?? step)
        : step;
    return { ...localized, image: step.image };
  });
}

export function postsFor(locale: Locale) {
  return posts.map((post, index) => ({
    ...(locale === "en" ? english.posts[index]! : post),
    image: images[post.ph as keyof typeof images],
  }));
}
