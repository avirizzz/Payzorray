export default function Skeleton({ style, className = '', ...props }) {
  return <div className={`skeleton ${className}`} style={style} {...props} />;
}
