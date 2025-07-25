const stCharUrl = 'data/characters_st.json';
const spCharUrl = 'data/characters_sp.json';


let stImages = {}, spImages = {};
let stNames = [], spNames = [];

const STORAGE_KEY = 'tacticalTeamData';
let teamData = [];
let editIndex = null;
let currentSort = { key: null, asc: true };

let historyMap = {}; // ユーザー名 => 過去のentry[] の連想配列
const HISTORY_KEY = 'tacticalHistoryData';

const fixedTopCharacters = [
  'ホシノ',
  'ハルカ',
  'シロコ＊テラー',
  'イオリ',
  'サオリ',
  'シュン',
  'レイサ',
  'マリナ'
];

const fixedTopCharactersSP = [
  'シロコ（水着）',
  'ナギサ',
  'ヒビキ',
  'サキ',
  'アヤネ（水着）',
  'ユズ（メイド）',
  'ウタハ',
  'ミノリ'
];

console.log("固定キャラ：", fixedTopCharacters);
console.log("STキャラ候補：", stNames);

function sortCharactersByPriority(characters, usageMap, fixedTop = []) {
  return [...characters].sort((a, b) => {
    const aFixed = fixedTop.includes(a.name);
    const bFixed = fixedTop.includes(b.name);
    if (aFixed && !bFixed) return -1;
    if (!aFixed && bFixed) return 1;

    const aCount = usageMap[a.name] || 0;
    const bCount = usageMap[b.name] || 0;
    return bCount - aCount; // 使用頻度の高い順
  });
}

function saveToHistory(name, oldEntry) {
  if (!historyMap[name]) historyMap[name] = [];
  historyMap[name].unshift(oldEntry); // 最新を先頭に追加
  saveHistory();
}


function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(historyMap));
}

function loadHistory() {
  const raw = localStorage.getItem(HISTORY_KEY);
  if (raw) historyMap = JSON.parse(raw);
}


function createDropdown(targetId, characters, onSelect) {
  const wrapper = document.getElementById(`dropdown-${targetId}`);
  wrapper.innerHTML = '';

  const selected = document.createElement('div');
  selected.className = 'dropdown-select';
  selected.textContent = '選択してください';
  wrapper.appendChild(selected);

  const options = document.createElement('div');
  options.className = 'dropdown-options';

  characters.forEach(char => {
    const opt = document.createElement('div');
    opt.className = 'option';
    opt.innerHTML = `<img src="${char.image}" alt="${char.name}"><span>${char.name}</span>`;
    opt.addEventListener('click', () => {
      selected.innerHTML = `<img src="${char.image}" alt="${char.name}"><span>${char.name}</span>`;
      selected.dataset.value = char.name;
      options.style.display = 'none';
      onSelect(char.name);
    });
    options.appendChild(opt);
  });

  wrapper.appendChild(options);

  selected.addEventListener('click', () => {
    options.style.display = options.style.display === 'block' ? 'none' : 'block';
  });

  document.addEventListener('click', e => {
    if (!wrapper.contains(e.target)) {
      options.style.display = 'none';
    }
  });
}


// データ保存
function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(teamData));
}

// データ読込
function loadData() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    teamData = JSON.parse(data);
  }
}

// 表描画
function populateTable() {
  const tbody = document.querySelector('#teamTable tbody');
  tbody.innerHTML = '';

  teamData.forEach((entry, index) => {
    const row = document.createElement('tr');
    if (hasDuplicateCharacters(entry)) {
      row.classList.add('warning');
    }

    row.innerHTML = `
  <td>${entry.name}</td>
  <td>${renderCharacterCell(entry.D1)}</td>
  <td>${renderCharacterCell(entry.D2)}</td>
  <td>${renderCharacterCell(entry.D3)}</td>
  <td>${renderCharacterCell(entry.D4)}</td>
  <td>${renderCharacterCell(entry.S1)}</td>
  <td>${renderCharacterCell(entry.S2)}</td>
  <td>${entry.date}</td>
  <td class="memo-cell">${entry.memo || ''}</td> <!-- ✅ 追加 -->
   
  <td>
    <button onclick="editEntry(${index})">🔧編集</button>
    <button onclick="deleteEntry(${index})">🗑️削除</button>
    <button class="history-btn" data-name="${entry.name}">📜履歴</button>
    <button class="inventory-btn" data-name="${entry.name}">🗃️手持ち</button>
    <button class="share-btn" data-index="${index}">🐦共有</button>
  </td>
`;


    tbody.appendChild(row);
    // ✅ 追加（この位置が正解）
row.addEventListener('click', () => {
  document.querySelectorAll('#teamTable tbody tr').forEach(r => r.classList.remove('selected'));
  row.classList.add('selected');
});
  row.querySelector('.history-btn').addEventListener('click', () => {
  const name = entry.name;
  const existing = tbody.querySelector(`.history-${name}`);
  if (existing) {
    existing.remove(); // 折りたたみ
    return;
  }

  const history = (historyMap[name] || []).slice(0, 20); // 最新20件だけ表示
  if (history.length === 0) return;

  const allImages = { ...stImages, ...spImages };

  const historyRow = document.createElement('tr');
  historyRow.className = `history-row history-${name}`;
  historyRow.innerHTML = `<td colspan="8">
    <div class="history-container">
      ${history.map((e, i) => `
        <div class="history-entry">
          <strong>${e.date}</strong>：
          ${[e.D1, e.D2, e.D3, e.D4].filter(Boolean).map(ch => `
            <img src="${allImages[ch] || ''}" alt="${ch}" class="history-icon" title="${ch}">
          `).join('')}
          <span style="margin: 0 8px;"></span>
          ${[e.S1, e.S2].filter(Boolean).map(ch => `
            <img src="${allImages[ch] || ''}" alt="${ch}" class="history-icon" title="${ch}">
          `).join('')}
          <button class="delete-history-btn" data-index="${i}">❌</button>
        </div>
      `).join('')}
    </div>
  </td>`;
  row.after(historyRow);

  historyRow.querySelectorAll('.delete-history-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const i = parseInt(btn.dataset.index);
    Swal.fire({
      title: '履歴削除の確認',
      text: `この履歴（${history[i].date}）を削除しますか？`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '削除',
      cancelButtonText: 'キャンセル',
    }).then(result => {
      if (result.isConfirmed) {
        historyMap[name].splice(i, 1);
        saveHistory();
        populateTable(); // 表を更新

      }
    });
  });
});


});
row.querySelector('.inventory-btn').addEventListener('click', () => {
  const name = entry.name;
  const existing = tbody.querySelector(`.inventory-${name}`);
  if (existing) {
    existing.remove(); // 折りたたみ
    return;
  }

  const history = historyMap[name] || [];
  if (history.length === 0) return;

  const allImages = { ...stImages, ...spImages };

  // キャラ名重複なしセット作成
  const allChars = new Set();
  history.forEach(h => {
    [h.D1, h.D2, h.D3, h.D4, h.S1, h.S2].forEach(c => {
      if (c && c !== '未選択') allChars.add(c);
    });
  });

  const inventoryRow = document.createElement('tr');
  inventoryRow.className = `inventory-row inventory-${name}`;
  inventoryRow.innerHTML = `<td colspan="10">
    <div class="inventory-container">
      ${[...allChars].map(c => `
        <img src="${allImages[c] || ''}" alt="${c}" class="history-icon" title="${c}">
      `).join('')}
    </div>
  </td>`;
  row.after(inventoryRow);
});

row.querySelector('.share-btn').addEventListener('click', () => {
  const entry = teamData[index];
  const characters = [entry.D1, entry.D2, entry.D3, entry.D4, entry.S1, entry.S2]
    .filter(Boolean).join(' / ');
  const tweet = `沼った防衛\n${characters}\n#ブルアカ #戦術対抗戦`;
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`;
  window.open(url, '_blank');
});


  });
}

function renderCharacterCell(name) {
  if (!name) return '';
  const allImages = { ...stImages, ...spImages };
  
  // 🔽 未選択だったらnoimageにフォールバック
  const imageUrl = allImages[name] || allImages["未選択"];
  if (!imageUrl) return `<div>${name}</div>`;

  return `<img src="${imageUrl}" alt="${name}" title="${name}"><div>${name}</div>`;
}



function deleteEntry(index) {
  Swal.fire({
    title: '削除の確認',
    text: 'この編成を本当に削除しますか？',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: '削除する',
    cancelButtonText: 'キャンセル',
  }).then((result) => {
    if (result.isConfirmed) {
      teamData.splice(index, 1);
      saveData();
      populateTable();

      Swal.fire('削除されました', '', 'success');
    }
  });
}



function editEntry(index) {
  const entry = teamData[index];
  document.getElementById('username').value = entry.name;
  editIndex = index;

  setDropdown('D1', entry.D1);
  setDropdown('D2', entry.D2);
  setDropdown('D3', entry.D3);
  setDropdown('D4', entry.D4);
  setDropdown('S1', entry.S1);
  setDropdown('S2', entry.S2);

  document.getElementById('memo').value = entry.memo || '';
  document.getElementById('teamForm').classList.add('editing');
  document.getElementById('submitBtn').textContent = '更新';
  document.getElementById('cancelBtn').style.display = 'inline-block';

  // ✅ 追加：フォームへスクロール
  document.getElementById('teamForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}



function setDropdown(id, name) {
  const selected = document.querySelector(`#dropdown-${id} .dropdown-select`);
  const targetData = id.startsWith('S') ? spCharacterData : stCharacterData;
  const match = targetData.find(c => c.name === name);
  if (match) {
    selected.innerHTML = `<img src="${match.image}" alt="${match.name}"><span>${match.name}</span>`;
    selected.dataset.value = match.name;
  }
}

//ここかな？
document.getElementById('submitBtn').addEventListener('click', e => {
  e.preventDefault();

  const name = document.getElementById('username').value.trim();
  if (!name) {
    console.warn("ユーザー名が未入力です！");
    return;
  }

  const getValue = (id) => {
    const el = document.querySelector(`#dropdown-${id} .dropdown-select`);
    return el && el.dataset.value ? el.dataset.value : '';
  };

  const D1 = getValue('D1');
  const D2 = getValue('D2');
  const D3 = getValue('D3');
  const D4 = getValue('D4');
  const S1 = getValue('S1');
  const S2 = getValue('S2');
  

  const now = new Date();
  const today = now.toLocaleString('ja-JP', {
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

  const memo = document.getElementById('memo').value.trim();
  const entry = { name, D1, D2, D3, D4, S1, S2, date: today, memo };
  const existingIndex = teamData.findIndex(e => e.name === name);

  // 🔧 entry定義後にチェック
  if (editIndex !== null) {
    saveToHistory(teamData[editIndex].name, { ...teamData[editIndex] });
    teamData[editIndex] = entry;
    editIndex = null;
    finalizeForm();
    return;
  }

  if (existingIndex !== -1) {
    Swal.fire({
      title: '上書き確認',
      text: `同じ名前のデータ（${name}）があります。\n上書きしますか？`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '上書きする',
      cancelButtonText: 'キャンセル',
    }).then((result) => {
      if (result.isConfirmed) {
        saveToHistory(teamData[existingIndex].name, { ...teamData[existingIndex] });
        teamData[existingIndex] = entry;
        increaseUsage(D1, D2, D3, D4, S1, S2);
        finalizeForm();
      }
    });
    return;
  }

  teamData.push(entry);
  increaseUsage(D1, D2, D3, D4, S1, S2);
  finalizeForm();
});




// 初期化
let stCharacterData = [], spCharacterData = [];

Promise.all([
  fetch(stCharUrl).then(res => res.json()),
  fetch(spCharUrl).then(res => res.json())
]).then(([stData, spData]) => {
  stData.forEach(c => {
    stNames.push(c.name);
    stImages[c.name] = c.image;
  });
  spData.forEach(c => {
    spNames.push(c.name);
    spImages[c.name] = c.image;
  });

  stCharacterData = stData;
  spCharacterData = spData;

  loadFreq(); // 使用頻度読み込み

  const sortedSt = sortCharactersByPriority(stCharacterData, usageFreq, fixedTopCharacters);
  const sortedSp = sortCharactersByPriority(spCharacterData, usageFreq, fixedTopCharactersSP);

  // 🔽 この中で createDropdown 実行するように
createDropdown('D1', sortedSt, () => {});
createDropdown('D2', sortedSt, () => {});
createDropdown('D3', sortedSt, () => {});
createDropdown('D4', sortedSt, () => {});
createDropdown('S1', sortedSp, () => {});
createDropdown('S2', sortedSp, () => {});


  loadData();
  populateTable();

});


function populateDropdown(idList, names, fixedTopCharacters) {
  const uniqueNames = [...new Set(names)];

  // 固定キャラをフィルタして前に
  const fixed = fixedTopCharacters.filter(name => uniqueNames.includes(name));

  // 残りを頻度順にソート（固定キャラ除外）
  const others = uniqueNames.filter(name => !fixed.includes(name));
  const sortedOthers = others.sort((a, b) => {
    const fa = usageFreq[a] || 0;
    const fb = usageFreq[b] || 0;
    return fb - fa;
  });

  const sortedNames = [...fixed, ...sortedOthers];

  idList.forEach(id => {
    const select = document.getElementById(id);
    select.innerHTML = '';
    sortedNames.forEach(name => {
      const opt = document.createElement('option');
      opt.value = opt.textContent = name;
      select.appendChild(opt);
    });
  });
}


// エクスポート機能
document.getElementById('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(teamData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tactical_teams.json';
  a.click();
  URL.revokeObjectURL(url);
});

// インポート機能
document.getElementById('importFile').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (Array.isArray(imported)) {
        teamData = imported;
        saveData();      // ローカルにも保存
        populateTable(); // 表更新

        alert('インポート成功！');
      } else {
        alert('無効なファイル形式です。');
      }
    } catch (err) {
      alert('読み込みに失敗しました。');
    }
  };
  reader.readAsText(file);
});

const FREQ_KEY = 'characterUsageFreq';
let usageFreq = {};

// 頻度読み込み
function loadFreq() {
  const stored = localStorage.getItem(FREQ_KEY);
  if (stored) usageFreq = JSON.parse(stored);
}

// 頻度保存
function saveFreq() {
  localStorage.setItem(FREQ_KEY, JSON.stringify(usageFreq));
}

// 使用キャラの頻度アップ
function increaseUsage(...names) {
  names.forEach(name => {
    if (!usageFreq[name]) usageFreq[name] = 0;
    usageFreq[name]++;
  });
  saveFreq();
}

function hasDuplicateCharacters(entry) {
  const chars = [entry.D1, entry.D2, entry.D3, entry.D4, entry.S1, entry.S2];
  const seen = new Set();
  return chars.some(char => {
    if (!char || char === '未選択') return false; // ❗未選択をスキップ
    if (seen.has(char)) return true;
    seen.add(char);
    return false;
  });
}



function sortTableBy(key) {
  // 昇降切り替え
  if (currentSort.key === key) {
    currentSort.asc = !currentSort.asc;
  } else {
    currentSort.key = key;
    currentSort.asc = true;
  }

  // ソート実行
  teamData.sort((a, b) => {
    let valA = a[key];
    let valB = b[key];
    if (key === 'date') {
      valA = new Date(valA);
      valB = new Date(valB);
    }
    if (valA < valB) return currentSort.asc ? -1 : 1;
    if (valA > valB) return currentSort.asc ? 1 : -1;
    return 0;
  });

  // 🔧 見た目を更新（ソート記号）
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    if (th.getAttribute('data-sort') === key) {
      th.classList.add(currentSort.asc ? 'sorted-asc' : 'sorted-desc');
    }
  });

  populateTable();

}

function finalizeForm() {
  document.getElementById('username').value = '';
  document.getElementById('memo').value = '';
  document.getElementById('teamForm').classList.remove('editing');
  document.getElementById('submitBtn').textContent = '追加';
  document.getElementById('cancelBtn').style.display = 'none';

  const ids = ['D1', 'D2', 'D3', 'D4', 'S1', 'S2'];
  ids.forEach(id => {
    const el = document.querySelector(`#dropdown-${id} .dropdown-select`);
    el.innerHTML = '選択してください';
    el.dataset.value = '';
  });

  populateTable();

  saveData();
}





// ソートヘッダーにクリックイベントを追加
document.querySelectorAll('th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.getAttribute('data-sort');
    sortTableBy(key);
  });
});

function toggleHistory(button, name) {
  const row = button.closest('tr');
  const nextRow = row.nextElementSibling;

  if (nextRow && nextRow.classList.contains('history-row')) {
    nextRow.remove(); // すでに表示 → 削除
    return;
  }

  const entries = historyMap[name] || [];
  const historyHtml = entries.map(e => `
    <tr class="history-row">
      <td colspan="9" style="background:#f7f7f7;">
        <strong>${e.date} 登録時:</strong>
        D1:${e.D1}, D2:${e.D2}, D3:${e.D3}, D4:${e.D4}, S1:${e.S1}, S2:${e.S2}
      </td>
    </tr>
  `).join('');

  row.insertAdjacentHTML('afterend', historyHtml);
}

document.addEventListener('DOMContentLoaded', () => {
  loadHistory();     // 🔁 まず履歴データ読み込み
  loadData();        // ✅ チームデータ読み込み
  populateTable();   // ✅ 表に反映
});

document.getElementById('cancelBtn').addEventListener('click', () => {
  editIndex = null;
  finalizeForm();
});

document.getElementById('pageShareBtn').addEventListener('click', () => {
  const tweet = `ブルアカ対抗戦の編成管理に便利なツール！\n使ってみてください👇\n${location.href}\n#ブルアカ #対抗戦 #編成記録ツール`;
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`;
  window.open(url, '_blank');
});

