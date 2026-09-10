import "./ActionTray.css";

function ActionTray({ children }) {
  return (
    <div className="action-tray">
      <div className="action-tray__inner">{children}</div>
    </div>
  );
}

export default ActionTray;
