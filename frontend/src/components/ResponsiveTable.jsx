import React from 'react';
import styles from './ResponsiveTable.module.css';

export default function ResponsiveTable({ columns, data, rowKey }) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  if (isMobile) {
    return (
      <div className={styles.mobileContainer}>
        {data.map((row, idx) => (
          <div key={row[rowKey] || idx} className={styles.mobileCard}>
            {columns.map((col) => (
              <div key={col.key} className={styles.mobileRow}>
                <div className={styles.mobileLabel}>{col.label}</div>
                <div className={styles.mobileValue}>{col.render ? col.render(row[col.key], row) : row[col.key]}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.responsiveTable}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={{ width: col.width }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={row[rowKey] || idx}>
              {columns.map((col) => (
                <td key={col.key}>
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
