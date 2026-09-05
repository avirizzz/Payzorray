function isValidProduct(product, hardConstraints = {}) {
  try {
    if (!product || typeof product !== 'object') return false;
    if (product.price == null || product.stock == null) return false;
    if (product.price < 0) return false;

    const requiredQty = hardConstraints.quantity || 1;
    if (product.stock < requiredQty) return false;

    if (hardConstraints.max_price != null) {
      if (typeof hardConstraints.max_price !== 'number' || isNaN(hardConstraints.max_price)) return false;
      if (product.price > hardConstraints.max_price) return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}

module.exports = { isValidProduct };
