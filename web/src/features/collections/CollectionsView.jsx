import CollectionThumbnail from "./CollectionThumbnail";
import "./CollectionsView.css";

// Same pixel-style trash icon as ProductCard's - not shared/exported
// there, so duplicated here (matches this app's existing convention of
// small local icon components per file).
function TrashIcon() {
  return (
    <svg viewBox="0 0 32 32" width="14" height="14" aria-hidden="true">
      <path d="m25.905 8.38 0 16.76 1.53 0 0 -16.76 3.04 0 0 -1.52 -1.52 0 0 -1.53 -6.1 0 0 -3.05 -1.52 0 0 3.05 -10.67 0 0 -3.05 -1.52 0 0 3.05 -6.09 0 0 1.53 -1.53 0 0 1.52 3.05 0 0 16.76 1.52 0 0 -16.76 19.81 0z" fill="currentColor" />
      <path d="M24.385 25.14h1.52v4.57h-1.52Z" fill="currentColor" />
      <path d="M7.625 29.71h16.76v1.53H7.625Z" fill="currentColor" />
      <path d="M21.335 11.43h1.52v12.19h-1.52Z" fill="currentColor" />
      <path d="M19.815 23.62h1.52v3.04h-1.52Z" fill="currentColor" />
      <path d="M15.245 11.43h1.52v15.23h-1.52Z" fill="currentColor" />
      <path d="M10.665 0.76h10.67v1.52h-10.67Z" fill="currentColor" />
      <path d="M10.665 23.62h1.53v3.04h-1.53Z" fill="currentColor" />
      <path d="M9.145 11.43h1.52v12.19h-1.52Z" fill="currentColor" />
      <path d="M6.095 25.14h1.53v4.57h-1.53Z" fill="currentColor" />
    </svg>
  );
}

// Presentation only - collections/handlers all come from App.jsx.
// No Supabase calls and no modal logic live here.
function CollectionsView({
  collections,
  onCreateCollection,
  onSelectCollection,
  onDeleteCollection,
}) {
  const hasCollections = collections.length > 0;

  return (
    <div className="collections-view">
      {hasCollections ? (
        <div className="collections-grid">
          {collections.map((collection) => (
            <div key={collection.id} className="collection-card-wrapper">
              <button
                type="button"
                className="collection-card"
                onClick={() => onSelectCollection(collection)}
              >
                <span className="collection-card__visual">
                  <CollectionThumbnail
                    imageUrl={collection.imageUrl}
                    color={collection.color}
                    className="collection-card__image"
                  />

                  {/* Purely decorative jewel frame, layered above the
                      photo (not a CSS border-image) so the photo/color
                      shows through its transparent center. Bare
                      relative filename, same convention as every other
                      public/ image in this app (e.g. header.jsx's
                      src="bags.png") - resolved by the browser at
                      runtime relative to the current document, which
                      works in both dev and the packaged Chrome
                      extension without going through Vite's build-time
                      CSS url() rewriting. */}
                  <img
                    className="collection-card__frame"
                    src="border.png"
                    alt=""
                    aria-hidden="true"
                  />
                </span>

                <span className="collection-card__name">{collection.name}</span>
              </button>

              {/* Sibling, not nested, to the card button above - hidden
                  until hover, same affordance-on-hover language used by
                  ProductCard's own save/delete controls. */}
              <button
                type="button"
                className="collection-card__delete"
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteCollection(collection);
                }}
                aria-label={`Delete ${collection.name}`}
                title="Delete collection"
              >
                <TrashIcon />
              </button>
            </div>
          ))}

          <button
            type="button"
            className="collection-card collection-card--new"
            onClick={onCreateCollection}
          >
            <span className="collection-card--new__plus">+</span>
            <span className="collection-card__name">new collection</span>
          </button>
        </div>
      ) : (
        <div className="collections-empty">
          <p className="collections-empty__title">no collections yet ♡</p>
          <p className="collections-empty__subtitle">
            start organizing your saves by trip, vibe, or occasion
          </p>
          <button type="button" onClick={onCreateCollection}>
            create collection
          </button>
        </div>
      )}
    </div>
  );
}

export default CollectionsView;
