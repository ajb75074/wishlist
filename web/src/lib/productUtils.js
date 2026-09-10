export function databaseRowToProduct(row) {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    currency: row.currency,
    imageUrl: row.image_url,
    cutoutImageUrl: row.cutout_image_url,
    color: row.color,
    size: row.size,
    productUrl: row.product_url,
    store: row.store,
    dateSaved: row.date_saved,
    // Defensive only - the column is NOT NULL DEFAULT false.
    isOwned: row.is_owned ?? false,
    itemImagePath: row.item_image_path ?? null,
  };
}

export function productToDatabaseRow(product) {
  return {
    // Only set for manual items that generate their own id before upload;
    // undefined is dropped from the insert payload.
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
    item_image_path: product.itemImagePath,
  };
}
