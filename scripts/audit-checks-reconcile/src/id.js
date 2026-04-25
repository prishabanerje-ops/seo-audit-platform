export function allocateIds(rows) {
  let counter = 1;
  return rows.map(row => {
    if (row.check_id) return row;
    const id = `C${String(counter).padStart(3, '0')}`;
    counter++;
    return { ...row, check_id: id };
  });
}
