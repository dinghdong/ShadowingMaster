/**
 * 全局偏好读写（localStorage）——原 useApp 内的 lsGet / lsSet 原样搬出，
 * 供 usePlayer（播放速度）/ useExercises（字幕·练习模式）/ useApp（统一持久化）复用。
 * 隐私模式等异常一律静默降级，行为与拆分前一致。
 */
export const lsGet = (k: string, fb: string) => {
  try { const v = localStorage.getItem(k); return v == null ? fb : v; } catch { return fb; }
};

export const lsSet = (k: string, v: string) => {
  try { localStorage.setItem(k, v); } catch { /* 忽略：隐私模式等 */ }
};
