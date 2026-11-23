export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'textContent') node.textContent = value;
    else if (key === 'className') node.className = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'dataset') {
      for (const [dataKey, dataValue] of Object.entries(value)) node.dataset[dataKey] = dataValue;
    } else if (value !== false && value != null) node.setAttribute(key, value);
  }
  for (const child of (Array.isArray(children) ? children : [children])) {
    if (child != null) node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function formatPrice(priceCents) {
  if (!Number.isInteger(priceCents) || priceCents < 0) throw new TypeError('Price must be non-negative whole cents');
  return `₦${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(priceCents / 100)}`;
}
