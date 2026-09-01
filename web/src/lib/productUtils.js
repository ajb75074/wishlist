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
  };
}

export function productToDatabaseRow(product) {
  return {
    name: product.name,
    price: product.price,
    currency: product.currency,
    image_url: product.imageUrl,
    color: product.color,
    size: product.size,
    product_url: product.productUrl,
    store: product.store,
  };
}
