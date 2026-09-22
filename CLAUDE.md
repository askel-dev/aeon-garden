# AEON Garden

A cozy emoji meadow where rabbits and foxes live their own lives and you watch what
emerges. **This is a game.** Balancing for fun is allowed and is the job; realism is
optional. It grew out of the AEON artificial-life lab (`~/programming/AEON`, finished and
closed); none of that project's rules apply here.

- `sim.js`: the world. No drawing. Runs in the browser and under node.
- `game.js`: drawing, UI, news feed, the inspector, the optional Ollama diary.
- `index.html`: layout and styles.
- `balance.js`: headless check, `node balance.js [years] [seeds]`.

Run: `python3 -m http.server 8765`, then open http://localhost:8765 (`?seed=123` replays
a meadow). The diary button talks to Ollama on localhost:11434 (qwen3:8b, else qwen3:4b).

Every animal uses one ladder: danger > sleep > love > food > friends > wander. Keep new
behaviour small and readable. If a rule needs a paragraph to explain, it's probably too big.

After touching the sim, run `balance.js` over several seeds. The goal is visible
boom-and-bust cycles that recover, not a flat line and not extinction.
