import { Icon } from "./Icon";

// 听写 / 挖空：每句独立的「检查 / 重做」按钮
export function CheckBtn({ checked, onCheck, onRedo, label }: { checked: boolean; onCheck: () => void; onRedo: () => void; label: string }) {
  return (
    <button
      aria-label={label}
      onClick={checked ? onRedo : onCheck}
      className="btn btn--sm btn--primary"
    >
      {checked ? <><Icon name="redo" size={13} /> 重做</> : <><Icon name="check" size={13} /> 检查</>}
    </button>
  );
}
