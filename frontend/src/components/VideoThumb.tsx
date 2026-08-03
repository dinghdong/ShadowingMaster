import { useState } from "react";
import { mediaUrl, ytThumb } from "../shared";
import { Icon } from "./Icon";

/**
 * 视频封面图（统一三级回退）：
 *   1) video.thumbnail_url（OSS 签名/相对路径，服务端返回）
 *   2) YouTube 公开缩略图 i.ytimg.com/vi/{id}/hqdefault.jpg（兜底：OSS 过期/缺文件/历史视频）
 *   3) 暖橙 hero 占位 + play/film 图标（兜底：连 ytimg 都失败，不再裸灰）
 * 用于「继续学习」卡与视频网格卡，保证两处行为一致。
 */
export function VideoThumb({
  video,
  placeholderIcon = "film",
}: {
  video: any;
  placeholderIcon?: "film" | "play";
}) {
  const primary = video?.thumbnail_url ? mediaUrl(video.thumbnail_url) : null;
  const yt = ytThumb(video?.youtube_id);
  // stage: 0=primary, 1=ytimg, 2=icon
  const [stage, setStage] = useState<0 | 1 | 2>(primary ? 0 : 1);
  const [loaded, setLoaded] = useState(false);

  const src = stage === 0 ? primary! : stage === 1 ? yt : null;

  if (!src) {
    return <Icon name={placeholderIcon} size={28} />;
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onLoad={() => setLoaded(true)}
      onError={() => setStage((s) => (s === 0 ? 1 : 2) as 0 | 1 | 2)}
      style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.15s ease" }}
    />
  );
}
