"""Small Pygbag-to-browser bridge. Network requests never block the game."""
import json
import pathlib
import sys


class Leaderboard:
    def __init__(self):
        self.window = None
        if sys.platform != "emscripten":
            return
        try:
            import platform
            root = pathlib.Path(__file__).resolve().parent
            config = json.loads((root / "leaderboard_config.json").read_text(encoding="utf-8"))
            source = (root / "leaderboard.js").read_text(encoding="utf-8")
            # Keep the Pygbag bridge ASCII-only; decode Unicode in JavaScript.
            # Passing raw UTF-8 source through window.eval can garble Chinese.
            platform.window.eval("(0,eval)(" + json.dumps(source, ensure_ascii=True) + ")")
            self.window = platform.window
            self.call("setup", config)
        except Exception as exc:
            print("Leaderboard unavailable; local game continues:", exc)

    def call(self, method, *args):
        if self.window is None:
            return
        try:
            payload = ",".join(json.dumps(arg, ensure_ascii=True) for arg in args)
            self.window.eval("window.SnakeBoard." + method + "(" + payload + ")")
        except Exception as exc:
            print("Leaderboard bridge:", exc)

    def start(self, difficulty):
        self.call("startRound", difficulty)

    def finish(self, score, difficulty, duration, eligible):
        self.call("endRound", score, difficulty, round(duration, 2), eligible)
