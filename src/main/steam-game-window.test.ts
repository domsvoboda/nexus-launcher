import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { steamWindowAppId } from './steam-game-window.js';

it('uses only the genuine matching non-Steam shortcut ID in Gamescope', () => {
  const environment = { XDG_CURRENT_DESKTOP: 'gamescope', SteamAppId: '2917300713', SteamGameId: '12529711154966036480' };
  expect(steamWindowAppId(environment)).toBe(2917300713);
  for (const changed of [{ XDG_CURRENT_DESKTOP: 'KDE' }, { SteamAppId: '123' },
    { SteamGameId: '123' }, { SteamGameId: '18446744073709551616' }, { SteamGameId: '../invalid' }])
    expect(steamWindowAppId({ ...environment, ...changed })).toBeUndefined();
});

it('repairs only the initial game layer order and respects process group ownership', () => {
  execFileSync('python3', ['-c', `
import sys
sys.path.insert(0, 'assets/overlay')
from steam_game_window import layer_order, owns_window
from game_monitor import same_game_process
appid = 2917300713
assert layer_order([413091, 769, appid], appid) == [413091, appid, 769]
assert layer_order([413091, appid, 123, 769], appid) == [413091, appid, 123, 769]
assert layer_order([413091, 769], appid) == [413091, 769]
assert same_game_process(20, 10, lambda pid: 10)
assert not same_game_process(20, 10, lambda pid: pid)
assert owns_window(10, 10, launcher=True)
assert not owns_window(20, 10, launcher=True)
`]);
});
