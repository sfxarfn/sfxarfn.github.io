These two files are here, in public/, rather than in src/ — deliberately.

v6-pulse-worklet-r7.js runs inside an AudioWorklet, which is a separate JS realm the browser
loads BY URL through ctx.audioWorklet.addModule(). It is already an ES module and it imports
v6-pulse-dsp-r7.js with a plain relative specifier, which the worklet realm resolves against
its own URL. Put these through Vite's bundler instead and that relative import has to be
rewritten, the worklet has to be emitted as its own chunk, and the whole thing breaks quietly
in a built dist/ — the engine simply falls back and nobody knows why.

public/ is copied verbatim into dist/, so the pair keeps its relative layout in development,
in a build, and on a static host alike. They must stay side by side.

Unmodified from the supplied transfer pack; see src/audio/f1-2020/ for the parts that were
ported into the game's own module graph.
