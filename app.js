const games = {
  ax: {
    name: 'Pokémon Ancestral X',
    intro: 'The trainers who made it through Ancestral X and earned their title "Ancestral X Champion".',
    icon: 'AXIcon.jpg',
    theme: '#111612',
  },
  yn: {
    name: 'Pokémon Y Nouveau',
    intro: 'The trainers who made it through Y Nouveau and earned their title "Y Nouveau Champion".',
    icon: 'YNIcon.svg',
    theme: '#d71945',
  },
};

const formatDateTime = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

function getDataRows(table) {
  return Array.from(table?.tBodies[0]?.rows || []).filter((row) => !row.classList.contains('empty-row'));
}

function getGameRows(game) {
  return Array.from(document.querySelectorAll(`table[data-hof-table][data-game="${game}"]`))
    .flatMap((table) => getDataRows(table));
}

function updatePanelStats(game) {
  const rows = getGameRows(game);
  const versions = rows
    .map((row) => Number.parseFloat(row.cells[3]?.textContent.trim()))
    .filter(Number.isFinite);

  document.getElementById('entryCount').textContent = rows.length;
  document.getElementById('latestVersion').textContent = versions.length ? Math.max(...versions).toFixed(1) : '—';
  document.getElementById('secondaryStatLabel').textContent = versions.length ? 'Latest version' : 'Version';
}

function setGame(game, { updateUrl = true } = {}) {
  if (!games[game]) return;

  document.body.dataset.game = game;
  document.querySelectorAll('[data-game-switch]').forEach((tab) => {
    const selected = tab.dataset.gameSwitch === game;
    tab.classList.toggle('is-active', selected);
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  document.querySelectorAll('[data-game-panel]').forEach((panel) => {
    const selected = panel.dataset.gamePanel === game;
    panel.classList.toggle('is-active', selected);
    panel.hidden = !selected;
  });
  document.querySelectorAll('[data-about-copy]').forEach((copy) => {
    copy.hidden = copy.dataset.aboutCopy !== game;
  });

  document.getElementById('gameKicker').textContent = games[game].name;
  document.getElementById('gameIntro').textContent = games[game].intro;
  document.getElementById('siteFavicon').href = games[game].icon;
  document.querySelector('meta[name="theme-color"]').content = games[game].theme;
  document.title = `${games[game].name} — Hall of Fame`;
  updatePanelStats(game);

  try {
    localStorage.setItem('hall-of-fame-game', game);
  } catch (_) {
    // The switcher still works when browser storage is unavailable.
  }
  if (updateUrl) history.replaceState(null, '', `#${game}`);
}

function filterTable(input) {
  const table = document.getElementById(input.dataset.tableSearch);
  const query = input.value.trim().toLowerCase();
  const rows = getDataRows(table);
  let visible = 0;

  rows.forEach((row) => {
    const matches = !query || row.textContent.toLowerCase().includes(query) ||
      Array.from(row.querySelectorAll('img[alt]')).some((image) => image.alt.toLowerCase().includes(query));
    row.hidden = !matches;
    if (matches) visible += 1;
  });

  const count = document.getElementById(`${table.id.replace('Table', '')}ResultCount`);
  if (count) count.textContent = `${visible} ${visible === 1 ? 'trainer' : 'trainers'}`;
}

function sortTable(button) {
  const table = button.closest('table');
  const tbody = table.tBodies[0];
  const column = Number(button.dataset.sortColumn);
  const direction = button.dataset.sortDirection === 'asc' ? 'desc' : 'asc';
  const rows = getDataRows(table);

  table.querySelectorAll('[data-sort-column]').forEach((control) => {
    control.removeAttribute('data-sort-direction');
    control.removeAttribute('aria-sort');
  });
  button.dataset.sortDirection = direction;
  button.setAttribute('aria-sort', direction === 'asc' ? 'ascending' : 'descending');

  rows
    .sort((a, b) => {
      const aValue = Number.parseFloat(a.cells[column]?.textContent) || 0;
      const bValue = Number.parseFloat(b.cells[column]?.textContent) || 0;
      return direction === 'asc' ? aValue - bValue : bValue - aValue;
    })
    .forEach((row) => tbody.appendChild(row));
}

function setYnSheet(sheet) {
  document.querySelectorAll('[data-yn-sheet]').forEach((tab) => {
    const selected = tab.dataset.ynSheet === sheet;
    tab.classList.toggle('is-active', selected);
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  document.querySelectorAll('[data-yn-sheet-panel]').forEach((panel) => {
    const selected = panel.dataset.ynSheetPanel === sheet;
    panel.classList.toggle('is-active', selected);
    panel.hidden = !selected;
  });
}

function updateUniqueTeamLeaders() {
  const rows = getDataRows(document.getElementById('axTable'));
  const frequency = new Map();

  rows.forEach((row) => {
    const team = new Set(Array.from(row.querySelectorAll('.mons img[alt]'), (image) => image.alt.trim().toLowerCase()));
    team.forEach((name) => frequency.set(name, (frequency.get(name) || 0) + 1));
  });

  const scores = rows.map((row) => {
    const team = new Set(Array.from(row.querySelectorAll('.mons img[alt]'), (image) => image.alt.trim().toLowerCase()));
    return { row, score: Array.from(team).filter((name) => frequency.get(name) === 1).length };
  });
  const highScore = Math.max(0, ...scores.map(({ score }) => score));
  const tooltip = 'Gold marks a player with one of the most unique Elite Four teams, based on Pokémon used only once across all entries.';

  scores.forEach(({ row, score }) => {
    const cell = row.cells[0];
    cell.classList.toggle('unique-team-leader', highScore > 0 && score === highScore);
    if (highScore > 0 && score === highScore) {
      cell.title = tooltip;
      cell.dataset.uniqueTooltip = tooltip;
    } else {
      cell.removeAttribute('title');
      delete cell.dataset.uniqueTooltip;
    }
  });
}

function updateLatestEntry() {
  const rows = getDataRows(document.getElementById('axTable'));
  if (!rows.length) return;

  const datedRows = rows
    .map((row) => ({ row, date: new Date(row.dataset.entryAt || '') }))
    .filter(({ date }) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.date - a.date);
  const latest = datedRows[0] || { row: rows[rows.length - 1], date: new Date(document.lastModified) };

  document.getElementById('lastEntryPlayer').textContent = latest.row.cells[0]?.textContent.trim() || 'Unknown';
  document.getElementById('lastEntryUpdated').textContent = formatDateTime(latest.date);
}

function updateLastUpdated() {
  const target = document.getElementById('lastUpdated');
  if (target) target.textContent = formatDateTime(document.lastModified);
}

function openAbout() {
  const dialog = document.getElementById('aboutDialog');
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function closeAbout() {
  const dialog = document.getElementById('aboutDialog');
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
}

document.addEventListener('DOMContentLoaded', () => {
  updateUniqueTeamLeaders();
  updateLatestEntry();
  updateLastUpdated();

  const tabs = Array.from(document.querySelectorAll('[data-game-switch]'));
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => setGame(tab.dataset.gameSwitch));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
      tabs[next].focus();
      setGame(tabs[next].dataset.gameSwitch);
    });
  });

  document.querySelectorAll('[data-table-search]').forEach((input) => input.addEventListener('input', () => filterTable(input)));
  document.querySelectorAll('[data-sort-column]').forEach((button) => button.addEventListener('click', () => sortTable(button)));
  const ynSheetTabs = Array.from(document.querySelectorAll('[data-yn-sheet]'));
  ynSheetTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => setYnSheet(tab.dataset.ynSheet));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'ArrowRight' ? (index + 1) % ynSheetTabs.length : (index - 1 + ynSheetTabs.length) % ynSheetTabs.length;
      ynSheetTabs[next].focus();
      setYnSheet(ynSheetTabs[next].dataset.ynSheet);
    });
  });
  document.querySelector('.site-brand').addEventListener('click', (event) => {
    event.preventDefault();
    setGame('ax');
  });
  document.querySelector('[data-open-about]').addEventListener('click', openAbout);
  document.querySelectorAll('[data-close-about]').forEach((button) => button.addEventListener('click', closeAbout));
  document.getElementById('aboutDialog').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeAbout();
  });

  let savedGame = 'ax';
  try {
    savedGame = localStorage.getItem('hall-of-fame-game') || 'ax';
  } catch (_) {
    // Use the default game.
  }
  const hashGame = window.location.hash.slice(1);
  setGame(games[hashGame] ? hashGame : savedGame);
});
