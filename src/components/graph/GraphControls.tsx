export interface GraphControlsProps {
  onFitView: () => void;
  onResetLayout: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  disabled?: boolean;
  className?: string;
  onToggleSidebar?: () => void;
  onToggleInspector?: () => void;
  isSidebarOpen?: boolean;
  isInspectorOpen?: boolean;
}

interface ControlButtonProps {
  label: string;
  icon: string;
  onClick: () => void;
  disabled: boolean;
  className?: string;
  pressed?: boolean;
}

function ControlButton({
  label,
  icon,
  onClick,
  disabled,
  className,
  pressed,
}: ControlButtonProps) {
  return (
    <button
      className={["fg-controls__button", className].filter(Boolean).join(" ")}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="fg-controls__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="fg-controls__label">{label}</span>
    </button>
  );
}

export function GraphControls({
  onFitView,
  onResetLayout,
  onZoomIn,
  onZoomOut,
  disabled = false,
  className,
  onToggleSidebar,
  onToggleInspector,
  isSidebarOpen = true,
  isInspectorOpen = true,
}: GraphControlsProps) {
  return (
    <div
      className={["fg-controls", className].filter(Boolean).join(" ")}
      role="toolbar"
      aria-label="Graph view controls"
    >
      {onToggleSidebar ? (
        <ControlButton
          className="fg-controls__button--panel fg-controls__button--sidebar"
          label={isSidebarOpen ? "Hide filters" : "Show filters"}
          icon="◧"
          pressed={isSidebarOpen}
          disabled={disabled}
          onClick={onToggleSidebar}
        />
      ) : null}

      <ControlButton
        label="Fit view"
        icon="⌗"
        disabled={disabled}
        onClick={onFitView}
      />
      <ControlButton
        label="Reset layout"
        icon="↻"
        disabled={disabled}
        onClick={onResetLayout}
      />
      <ControlButton
        label="Zoom in"
        icon="+"
        disabled={disabled}
        onClick={onZoomIn}
      />
      <ControlButton
        label="Zoom out"
        icon="−"
        disabled={disabled}
        onClick={onZoomOut}
      />

      {onToggleInspector ? (
        <ControlButton
          className="fg-controls__button--panel fg-controls__button--inspector"
          label={isInspectorOpen ? "Hide inspector" : "Show inspector"}
          icon="◨"
          pressed={isInspectorOpen}
          disabled={disabled}
          onClick={onToggleInspector}
        />
      ) : null}
    </div>
  );
}
