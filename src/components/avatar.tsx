import { cn } from "@/lib/utils";
import { RemoteImage } from "./remote-image";

/** Profile picture, or the name's initial when none has been uploaded. */
export function Avatar({
  name,
  url,
  className = "avatar",
  size = 40,
}: {
  name: string;
  url?: string | null;
  /** avatar | small-avatar | profile-avatar */
  className?: string;
  /** Rendered CSS width in px, used to request the right image size. */
  size?: number;
}) {
  return (
    <span className={cn(className, url && "has-image")} aria-hidden="true">
      {url ? (
        <RemoteImage src={url} alt="" fill sizes={`${size}px`} />
      ) : (
        name.charAt(0).toLocaleUpperCase("tr-TR")
      )}
    </span>
  );
}
