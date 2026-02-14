import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves a toiletry image_url to a displayable URL.
 * Handles both legacy full public URLs and new storage paths.
 */
export function useToiletryImageUrl(imageUrl: string | null | undefined): string | null {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setSignedUrl(null);
      return;
    }

    // Legacy: already a full URL (from when bucket was public)
    if (imageUrl.startsWith("http")) {
      // Try to extract the path from the old public URL and create a signed URL
      const match = imageUrl.match(/\/toiletry-images\/(.+)$/);
      if (match) {
        supabase.storage
          .from("toiletry-images")
          .createSignedUrl(match[1], 3600)
          .then(({ data }) => setSignedUrl(data?.signedUrl ?? null));
      } else {
        setSignedUrl(imageUrl);
      }
      return;
    }

    // New format: just a storage path
    supabase.storage
      .from("toiletry-images")
      .createSignedUrl(imageUrl, 3600)
      .then(({ data }) => setSignedUrl(data?.signedUrl ?? null));
  }, [imageUrl]);

  return signedUrl;
}
