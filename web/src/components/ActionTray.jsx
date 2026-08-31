import "./ActionTray.css";

// Generic floating bottom tray - purely a container. Callers decide
// what buttons/content go inside, so this can be reused for both the
// All Saves Edit/Donate tray and the Collection Detail "remove from
// this rack" tray later.
function ActionTray({ children }) {
  return (
    <div className="action-tray">
      <div className="action-tray__inner">{children}</div>
    </div>
  );
}

export default ActionTray;
