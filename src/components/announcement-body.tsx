import { readAnnouncementBlocks } from "@/modules/site-content/announcement-content";
import { RemoteImage } from "./remote-image";

export function AnnouncementBody({
  content,
  body,
}: {
  content: unknown;
  body: string;
}) {
  return (
    <div className="announcement-body">
      {readAnnouncementBlocks(content, body).map((block) =>
        block.type === "text" ? (
          <p key={block.id}>{block.text}</p>
        ) : (
          <figure key={block.id}>
            <RemoteImage
              src={block.url}
              alt={block.alt}
              width={block.width}
              height={block.height}
              sizes="(max-width: 800px) 100vw, 800px"
            />
          </figure>
        ),
      )}
    </div>
  );
}
