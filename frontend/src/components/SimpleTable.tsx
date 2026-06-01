import type { TableRow } from "../appTypes";

export function SimpleTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: TableRow[];
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const cells = Array.isArray(row) ? row : row.cells;
            const className = Array.isArray(row) ? undefined : row.className;
            return (
              <tr className={className} key={index}>
                {cells.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
