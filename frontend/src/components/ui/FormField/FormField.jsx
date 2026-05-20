import './FormField.css'

export default function FormField({
  label,
  name,
  value,
  onChange,
  error,
  type = 'text',
  options,
  rows = 3,
  required = false,
  placeholder = '',
}) {
  return (
    <div className="ff-field">
      <label className="ff-label">{label}</label>

      {type === 'select' ? (
        <select
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          className={`ff-input${error ? ' ff-has-error' : ''}`}
        >
          <option value="">—</option>
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          rows={rows}
          required={required}
          placeholder={placeholder}
          className={`ff-input${error ? ' ff-has-error' : ''}`}
        />
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          placeholder={placeholder}
          className={`ff-input${error ? ' ff-has-error' : ''}`}
        />
      )}

      {error && <span className="ff-error">{error}</span>}
    </div>
  )
}
