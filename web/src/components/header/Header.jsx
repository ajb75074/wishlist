import "./Header.css";
import Sticker from "./Sticker";

function Header({
  title = "Wishlist",
  tagline = "a visual archive of pieces i love right now ♡",
  showSearch = true,
  showNote = true,
  searchTerm,
  onSearchChange,
}) {
  return (
    <header className="header">

      {/* Scattered interactive stickers */}
      <Sticker
        src="flower.png"
        className="header-decor--flower"
      />

      <Sticker
        src="planet.png"
        className="header-decor--planet"
      />

      <Sticker
        src="pin.png"
        className="header-decor--pin"
      />

      <Sticker
        src="stem.png"
        className="header-decor--stem"
      />

      <Sticker
        src="shoppingbag.png"
        className="header-decor--bag"
      />


      {/* Main title area */}
      <div className="header-title">

        {showNote ? (
          <div className="header-title-wrap">
            <img
              className="header-note"
              src="tagline.png"
              alt="Things I want"
            />

            <h1>{title}</h1>
          </div>
        ) : (
          <h1>{title}</h1>
        )}

        <p>
          {tagline}
        </p>

      </div>


      {/* Search - major navigation now lives in the Sidebar */}
      {showSearch && (
        <div className="header-bottom">

          <label className="header-search">
            <input
              type="search"
              placeholder="search my archive..."
              aria-label="Search wishlist"
              value={searchTerm}
              onChange={(event) => onSearchChange(event.target.value)}
            />

            <span>⌕</span>
          </label>

        </div>
      )}

    </header>
  );
}

export default Header;