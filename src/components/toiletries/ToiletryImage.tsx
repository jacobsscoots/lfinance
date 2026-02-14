import { useToiletryImageUrl } from "@/hooks/useToiletryImageUrl";
import { cn } from "@/lib/utils";

interface ToiletryImageProps {
  imageUrl: string | null | undefined;
  alt: string;
  className?: string;
}

export function ToiletryImage({ imageUrl, alt, className }: ToiletryImageProps) {
  const src = useToiletryImageUrl(imageUrl);
  
  if (!src) return null;
  
  return (
    <img src={src} alt={alt} className={cn("h-full w-full object-cover", className)} />
  );
}
