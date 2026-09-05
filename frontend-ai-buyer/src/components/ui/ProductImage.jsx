import { resolveImageUrl, getPlaceholderImageUrl } from '../../api/client';

export default function ProductImage({ src, alt, ...props }) {
  const placeholder = getPlaceholderImageUrl(alt);
  const realSrc = resolveImageUrl(src);

  return (
    <img
      src={realSrc || placeholder}
      alt={alt}
      onError={(e) => {
        if (e.target.src !== placeholder) {
          e.target.onerror = null;
          e.target.src = placeholder;
        }
      }}
      {...props}
    />
  );
}
