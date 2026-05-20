import './Table.css'

export default function Table({
  columns,
  rows,
  onRowClick,
  loading = false,
  emptyText = 'Aucun résultat.',
}) {
  return (
    <div className="ui-table-wrapper">
      <table className="ui-table">
        <thead className="ui-thead">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="ui-th">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="ui-td-empty">
                Chargement...
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="ui-td-empty">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr
                key={row.id ?? idx}
                className={`ui-tr${onRowClick ? ' ui-tr-clickable' : ''}`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td key={col.key} className="ui-td">
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
