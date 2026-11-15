import type { Product } from "@/domain/catalog";
import { Photo } from "@/components/ui/photo";
import { JarMedia } from "./jar-media";
import { defaultJarBodyImage } from "@/lib/catalog-media";
export function Jar({
  product,
  sizes = "(max-width: 760px) 40vw, 20vw",
}: {
  product: Pick<Product, "id" | "jarImage" | "jarBodyImage" | "lidImage">;
  sizes?: string;
}) {
  const body = product.jarBodyImage || defaultJarBodyImage(product.id);
  if (product.jarImage)
    return (
      <JarMedia staticPhoto>
        <Photo src={product.jarImage} alt="" sizes={sizes} />
      </JarMedia>
    );
  return (
    <JarMedia>
      {body ? (
        <Photo
          src={body}
          alt=""
          sizes={sizes}
          quality={90}
          className="block size-full object-contain"
        />
      ) : (
        <img
          src={`/assets/jars/${product.id}.svg`}
          alt=""
          loading="lazy"
          width={200}
          height={200}
        />
      )}
      <div className="lid lid-img">
        <Photo src={product.lidImage} alt="" sizes={sizes} />
      </div>
    </JarMedia>
  );
}
