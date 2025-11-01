export function isValidAmazonWishlist(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (!host.includes('amazon.')) return false;
    const path = u.pathname.toLowerCase();
    return (
      path.includes('/wishlist') ||
      path.includes('/hz/wishlist') ||
      path.includes('/registry/wishlist')
    );
  } catch {
    return false;
  }
}
