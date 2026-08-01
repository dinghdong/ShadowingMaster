import { useEffect, useState } from "react";

// 断点：< 900px 视为手机端（与 components.css 的 @media (max-width: 899px) 对齐）
export function useIsMobile() {
  const query = "(max-width: 899px)";
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", onChange);
    setIsMobile(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}
