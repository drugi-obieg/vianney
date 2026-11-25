import { loadSettings, saveSettings } from '../shared/config.js';
import { formatDuration, isDue } from '../core/breaktimer.js';

const $ = (id) => document.getElementById(id);

async function init() {
  const settings = await loadSettings();
  const { log = [], breakState = null } = await chrome.storage.local.get(['log', 'breakState']);

  $('enabled').checked = settings.enabled;
  $('enabled').addEventListener('change', async () => { settings.enabled = $('enabled').checked; await saveSettings(settings); });

  const start = new Date(); start.setHours(0, 0, 0, 0);
  $('flagged').textContent = String(log.filter((e) => e.t >= start.getTime() && e.flagged && e.flagged.length).length);
  $('watch').textContent = breakState ? formatDuration(breakState.accumSeconds) : '-';
  $('due').hidden = !isDue(breakState, settings.brk);

  $('open').addEventListener('click', () => { chrome.runtime.openOptionsPage(); window.close(); });
}

init();
