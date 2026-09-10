import "./SelectModeBar.css";

// Material Symbols "more_vert" - fill uses currentColor so CSS controls
// its (pink) color instead of the baked-in grey from the source asset.
function KebabIcon() {
  return (
    <svg viewBox="0 -960 960 960" width="18" height="18" aria-hidden="true">
      <path
        d="M480-160q-33 0-56.5-23.5T400-240q0-33 23.5-56.5T480-320q33 0 56.5 23.5T560-240q0 33-23.5 56.5T480-160Zm0-240q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm0-240q-33 0-56.5-23.5T400-720q0-33 23.5-56.5T480-800q33 0 56.5 23.5T560-720q0 33-23.5 56.5T480-640Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SelectModeBar({ isActive, selectedCount, onEnter, onCancel }) {
  if (!isActive) {
    return (
      <button
        type="button"
        className="select-mode-bar__enter"
        onClick={onEnter}
        title="edit"
        aria-label="edit"
      >
        <KebabIcon />
      </button>
    );
  }

  return (
    <div className="select-mode-bar">
      <button type="button" className="select-mode-bar__cancel" onClick={onCancel}>
        cancel
      </button>

      <span className="select-mode-bar__count">{selectedCount} selected</span>
    </div>
  );
}

export default SelectModeBar;
