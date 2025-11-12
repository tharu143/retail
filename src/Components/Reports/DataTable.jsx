import React from 'react';
import { Loader2 } from 'lucide-react';

const DataTable = ({ columns, data, title = 'Report', loading = false, onRowClick }) => (
  <div className="bg-white rounded-xl shadow-sm border p-6">
    <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
      {title} ({data.length} records)
    </h3>
    {loading ? (
      <div className="flex justify-center items-center h-32">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    ) : data.length === 0 ? (
      <p className="text-center text-slate-500 py-8">No records found</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((col, i) => (
                <th key={i} className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className="border-b hover:bg-slate-50 cursor-pointer"
                onClick={() => onRowClick && onRowClick(row)}
              >
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className="py-3 px-4 text-sm">
                    {row[col.fieldname] !== null && row[col.fieldname] !== undefined
                      ? row[col.fieldname]
                      : '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

export default DataTable;