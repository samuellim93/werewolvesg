const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'werewolf.db'));

// Create roles table
db.exec(`
  CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    alignment TEXT NOT NULL, -- 'Good' or 'Bad'
    description TEXT,
    ability TEXT
  )
`);

// Seed original 预女猎白 roles
const insertRole = db.prepare('INSERT INTO roles (name, alignment, description, ability) VALUES (?, ?, ?, ?)');

const rolesData = [
  ['狼人', 'Bad', '四张狼人牌互相认识，每晚可以共同睁眼杀死任意一名玩家。', '每晚杀一人，可自爆跳过白天。'],
  ['预言家', 'Good', '村民阵营的灵魂，每晚可以查验一位玩家的真实身份。', '每晚查验一人，获知其阵营（好人/坏人）。'],
  ['女巫', 'Good', '拥有解药和毒药，控制生死的强大神牌。', '昨晚狼人杀人后可选择是否救人或使用毒药，不能自救。'],
  ['猎人', 'Good', '被杀或被投出后可带走一人。', '死亡后开枪发射子弹，带走一名玩家。'],
  ['白痴', 'Good', '放逐出局后翻牌自证，可发言但失投票权。', '被投出后免死一次，失去投票权，继续发言。'],
  ['平民', 'Good', '没有任何特殊功能的普通村民。', '白天投票放逐狼人。']
];

// Check if seeded
const count = db.prepare('SELECT count(*) as count FROM roles').get().count;
if (count === 0) {
  for (const role of rolesData) {
    insertRole.run(...role);
  }
}

module.exports = {
  getRoles: () => db.prepare('SELECT * FROM roles').all(),
  getRoleByName: (name) => db.prepare('SELECT * FROM roles WHERE name = ?').get(name)
};
