export const id = '017_rename_audit_categories';

export function up(db) {
  const renames = [
    ['Robots / Indexability',    'Robots & Indexability'],
    ['Sitemap',                  'Sitemaps'],
    ['Monitoring & Operations',  'Security & Monitoring'],
    ['Rankings & Traffic Drops', 'Rankings & Traffic'],
  ];

  for (const [oldName, newName] of renames) {
    db.prepare(`UPDATE audit_checks  SET category = ? WHERE category = ?`).run(newName, oldName);
    db.prepare(`UPDATE audit_results SET section  = ? WHERE section  = ?`).run(newName, oldName);
  }
}
