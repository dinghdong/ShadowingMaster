import { AppState } from "../useApp";
import { Icon } from "./Icon";

// ─── 未登录门禁（生词本 / 添加视频 / 个人中心 共用）───
// 受保护页未登录时就地渲染此组件，视觉与交互统一：锁图标 + 一句说明 + 登录按钮。
// 点击登录通过 goLogin(currentPage) 记录回跳意图，登录成功后自动回到本页。
export function LoginGate({
  app,
  title,
  hint,
  returnPage,
}: {
  app: AppState;
  title: string;
  hint: string;
  returnPage: "wordbook" | "add" | "profile";
}) {
  return (
    <div className="locked-state">
      <span className="locked-state__icon"><Icon name="lock" size={48} /></span>
      <div>{hint}</div>
      <button className="btn btn--primary" onClick={() => app.goLogin(returnPage)}>登录后查看{title}</button>
    </div>
  );
}
