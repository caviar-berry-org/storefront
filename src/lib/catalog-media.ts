export function defaultJarBodyImage(id: string) {
  return ["premium", "sterlet", "hybrid", "trout"].includes(id)
    ? `/assets/img/catalog/${id}-body.webp`
    : undefined;
}
