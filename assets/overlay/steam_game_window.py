"""Associate only this launch's X11 windows with its genuine Steam shortcut."""
import ctypes
import os
import sys
import time
from game_monitor import WindowPids, same_game_process


def layer_order(values, appid):
    # Repair the initial handover only; never invent an ID or reorder other apps.
    if appid not in values or 769 not in values or values.index(appid) < values.index(769):
        return values
    result = [value for value in values if value != appid]
    result.insert(result.index(769), appid)
    return result


def owns_window(owner, pid, launcher=False):
    return owner == pid if launcher else same_game_process(owner, pid)


class SteamWindows(WindowPids):
    def __init__(self):
        super().__init__()
        self.lib.XDefaultRootWindow.argtypes = [ctypes.c_void_p]
        self.lib.XDefaultRootWindow.restype = ctypes.c_ulong
        self.lib.XQueryTree.argtypes = [ctypes.c_void_p, ctypes.c_ulong,
            ctypes.POINTER(ctypes.c_ulong), ctypes.POINTER(ctypes.c_ulong),
            ctypes.POINTER(ctypes.POINTER(ctypes.c_ulong)), ctypes.POINTER(ctypes.c_uint)]
        self.lib.XChangeProperty.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_ulong,
            ctypes.c_ulong, ctypes.c_int, ctypes.c_int, ctypes.c_void_p, ctypes.c_int]
        self.lib.XGetGeometry.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.POINTER(ctypes.c_ulong),
            ctypes.POINTER(ctypes.c_int), ctypes.POINTER(ctypes.c_int), ctypes.POINTER(ctypes.c_uint),
            ctypes.POINTER(ctypes.c_uint), ctypes.POINTER(ctypes.c_uint), ctypes.POINTER(ctypes.c_uint)]
        self.root = self.lib.XDefaultRootWindow(self.display)
        self.previous = self.lib.XSetErrorHandler(ctypes.cast(self.error, ctypes.c_void_p))

    def values(self, window, name):
        atom = self.lib.XInternAtom(self.display, name.encode(), False)
        kind, fmt, count, remaining = ctypes.c_ulong(), ctypes.c_int(), ctypes.c_ulong(), ctypes.c_ulong()
        data = ctypes.POINTER(ctypes.c_ubyte)()
        try:
            status = self.lib.XGetWindowProperty(self.display, window, atom, 0, 512, False,
                self.cardinal, ctypes.byref(kind), ctypes.byref(fmt), ctypes.byref(count),
                ctypes.byref(remaining), ctypes.byref(data))
            if status == 0 and kind.value == self.cardinal and fmt.value == 32 and not remaining.value and data:
                return list(ctypes.cast(data, ctypes.POINTER(ctypes.c_ulong))[:count.value])
            return []
        finally:
            if data:
                self.lib.XFree(data)

    def write(self, window, name, values):
        atom = self.lib.XInternAtom(self.display, name.encode(), False)
        data = (ctypes.c_ulong * len(values))(*values)
        self.lib.XChangeProperty(self.display, window, atom, self.cardinal, 32, 0, data, len(values))
        self.lib.XSync(self.display, False)

    def windows(self):
        root, parent, count = ctypes.c_ulong(), ctypes.c_ulong(), ctypes.c_uint()
        children = ctypes.POINTER(ctypes.c_ulong)()
        try:
            if self.lib.XQueryTree(self.display, self.root, ctypes.byref(root), ctypes.byref(parent),
                    ctypes.byref(children), ctypes.byref(count)):
                return list(children[:min(count.value, 4096)])
            return []
        finally:
            if children:
                self.lib.XFree(children)

    def substantial(self, window):
        root, x, y = ctypes.c_ulong(), ctypes.c_int(), ctypes.c_int()
        width, height, border, depth = (ctypes.c_uint() for _ in range(4))
        return self.lib.XGetGeometry(self.display, window, ctypes.byref(root), ctypes.byref(x), ctypes.byref(y),
            ctypes.byref(width), ctypes.byref(height), ctypes.byref(border), ctypes.byref(depth)) and width.value * height.value >= 6400


def main(pid, appid, launcher=False):
    game = SteamWindows()
    # Gamescope's Steam control display is :0; use the same server host prefix.
    display = os.environ.get('DISPLAY', '')
    if ':' not in display:
        return
    os.environ['DISPLAY'] = display.rsplit(':', 1)[0] + ':0'
    control = SteamWindows()
    known = set()
    try:
        while (os.path.exists('/proc/' + str(pid)) if launcher else same_game_process(pid, pid)):
            live = set()
            for window in game.windows():
                owner = game.read(window)
                if not owns_window(owner, pid, launcher) or not game.substantial(window):
                    continue
                live.add(window)
                if window in known:
                    continue
                game.write(window, 'STEAM_GAME', [appid])
                order = control.values(control.root, 'GAMESCOPECTRL_BASELAYER_APPID')
                updated = layer_order(order, appid)
                if updated != order:
                    control.write(control.root, 'GAMESCOPECTRL_BASELAYER_APPID', updated)
                # Once associated, let Steam menus and user focus changes win.
                known.add(window)
            known.intersection_update(live)
            time.sleep(0.25)
    finally:
        control.close()
        game.close()


if __name__ == '__main__':
    pid, appid = map(int, sys.argv[1:3])
    if not 0 < pid < 2**31 or not 0x80000000 <= appid <= 0xffffffff:
        raise ValueError('Invalid Steam game identity')
    main(pid, appid, '--launcher' in sys.argv[3:])
