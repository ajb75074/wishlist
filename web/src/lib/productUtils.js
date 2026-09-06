export function databaseRowToProduct(row) {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    currency: row.currency,
    // The retailer/extension URL only - resolving a manual item's
    // private itemImagePath into something displayable happens
    // separately (see lib/itemImages.js), never here. This mapper
    // stays a pure, synchronous row->object translation.
    imageUrl: row.image_url,
    cutoutImageUrl: row.cutout_image_url,
    color: row.color,
    size: row.size,
    productUrl: row.product_url,
    store: row.store,
    dateSaved: row.date_saved,
    // Defensive fallback for any row created before this column
    // existed, or any other case where it's absent/null - the DB
    // column is NOT NULL DEFAULT false so this should already always
    // be a real boolean, but this keeps the mapper honest either way.
    isOwned: row.is_owned ?? false,
    itemImagePath: row.item_image_path ?? null,
  };
}

export function productToDatabaseRow(product) {
  return {
    // Only ever present for manually-created items that generate
    // their own id client-side before upload (see wishlist.js's
    // uploadItemImage) - undefined here is dropped from the insert
    // payload entirely, letting the column's own gen_random_uuid()
    // default apply, exactly as it already does for every
    // extension-created row today.
    id: product.id,
    name: product.name,
    price: product.price,
    currency: product.currency,
    image_url: product.imageUrl,
    color: product.color,
    size: product.size,
    product_url: product.productUrl,
    store: product.store,
    is_owned: product.isOwned ?? false,
    // Same "undefined is dropped" reasoning as id - only ever set for
    // a manual item whose photo was already uploaded before this row
    // is inserted (see wishlist.js's creation-order comment).
    item_image_path: product.itemImagePath,
  };
}
