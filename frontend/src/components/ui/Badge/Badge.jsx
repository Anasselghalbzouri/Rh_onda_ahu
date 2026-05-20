import './Badge.css'

const VARIANTS = ['success', 'error', 'warning', 'info', 'default']

export default function Badge({ variant = 'default', children }) {
  const v = VARIANTS.includes(variant) ? variant : 'default'
  return <span className={`badge badge-${v}`}>{children}</span>
}
