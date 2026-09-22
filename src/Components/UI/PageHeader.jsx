/** Presentation-only header: callers retain every action, condition and handler. */
export default function PageHeader({ children, className = '', ...props }) {
  return <div {...props} className={`erp-page-header ${className}`}>{children}</div>;
}
