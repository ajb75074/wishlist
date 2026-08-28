export function databaseRowToProduct(row) {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    currency: row.currency,
    imageUrl: row.image_url,
    color: row.color,
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
    product_url: product.productUrl,
    store: product.store,
  };
}
