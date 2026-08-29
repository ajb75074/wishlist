import "./Header.css";
import Sticker from "./sticker";

function Header({ searchTerm, onSearchChange }) {
  return (
    <header className="header">

      {/* Scattered interactive stickers */}
      <Sticker
        src="bags.png"
        className="header-decor--bags"
      />

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

        <div className="header-title-wrap">
          <img
            className="header-note"
            src="tagline.png"
            alt="Things I want"
          />

          <h1>Wishlist</h1>
        </div>

        <p>
          a visual archive of pieces i love right now ♡
        </p>

      </div>


      {/* Navigation + search */}
      <div className="header-bottom">

        <nav className="header-nav">
          <button className="active">All Saves</button>
          <button>Collections</button>
          <button>Outfits</button>
        </nav>

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

    </header>
  );
}

export default Header;