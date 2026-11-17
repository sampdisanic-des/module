/* Pruebas del parser .STY (node tests/styParser.test.js).
 * Transpila src/services/styParser.ts con el compilador de TypeScript del proyecto
 * y sustituye expo-file-system por un stub (solo se prueba el parseo binario). */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

function loadTs(file, stubs) {
  const src = fs.readFileSync(file, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
  }).outputText;
  const m = new Module(file, module);
  m.filename = file;
  m.paths = Module._nodeModulePaths(path.dirname(file));
  const origRequire = m.require.bind(m);
  m.require = (id) => (id in stubs ? stubs[id] : origRequire(id));
  m._compile(out, file);
  return m.exports;
}

const parser = loadTs(path.join(__dirname, '..', 'src', 'services', 'styParser.ts'), {
  'expo-file-system': { getInfoAsync: async () => ({ exists: false }) },
});

// ---------- Constructor de SMF ----------
function vlq(n) {
  const bytes = [n & 0x7f];
  while ((n >>= 7)) bytes.unshift((n & 0x7f) | 0x80);
  return bytes;
}
function u32(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; }
function u16(n) { return [(n >> 8) & 255, n & 255]; }
function str(s) { return [...s].map((c) => c.charCodeAt(0)); }

class Track {
  constructor() { this.events = []; } // [absTick, bytes[]]
  add(tick, bytes) { this.events.push([tick, bytes]); return this; }
  marker(tick, text) { return this.add(tick, [0xff, 0x06, ...vlq(text.length), ...str(text)]); }
  tempo(tick, bpm) { const us = Math.round(60000000 / bpm); return this.add(tick, [0xff, 0x51, 0x03, (us >> 16) & 255, (us >> 8) & 255, us & 255]); }
  note(tick, dur, ch, note, vel = 100) {
    this.add(tick, [0x90 | (ch - 1), note, vel]);
    return this.add(tick + dur, [0x80 | (ch - 1), note, 0]);
  }
  bytes() {
    const sorted = this.events.map((e, i) => [...e, i]).sort((a, b) => a[0] - b[0] || a[2] - b[2]);
    let last = 0;
    const body = [];
    for (const [tick, b] of sorted) { body.push(...vlq(tick - last), ...b); last = tick; }
    body.push(0x00, 0xff, 0x2f, 0x00);
    return [...str('MTrk'), ...u32(body.length), ...body];
  }
}
function smf(tracks, ppq = 480) {
  return Uint8Array.from([...str('MThd'), ...u32(6), ...u16(tracks.length > 1 ? 1 : 0), ...u16(tracks.length), ...u16(ppq),
    ...tracks.flatMap((t) => t.bytes())]);
}

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.log('  FALLA ' + name + '\n       ' + e.message); process.exitCode = 1; }
}

console.log('Parser .STY');
const BAR = 1920;

test('secciones Yamaha con marcador desconocido intermedio', () => {
  const t = new Track();
  t.tempo(0, 96);
  t.marker(0, 'SFF1').marker(0, 'SInt');
  t.add(0, [0xc0 | 10, 33]); // bajo: programa 33 (canal 11)
  t.marker(BAR, 'Main A');
  t.note(BAR, 240, 10, 36).note(BAR, 400, 11, 36).note(BAR * 2 + 960, 2000, 12, 60); // la última se pasa del final
  t.marker(BAR * 3, 'Fill In AA');
  t.note(BAR * 3, 120, 10, 38);
  t.marker(BAR * 4, 'Fill In BA'); // break: no reconocido, no debe sumarse a FILL_A
  t.note(BAR * 4, 120, 10, 49);
  t.marker(BAR * 5, 'Ending A');
  t.note(BAR * 5, 960, 10, 49);
  const st = parser.parseMidiStyleBinary(smf([t]), 'Prueba');

  assert.strictEqual(st.defaultBpm, 96);
  assert.strictEqual(st.ppq, 480);
  assert.deepStrictEqual(Object.keys(st.sections).sort(), ['ENDING_A', 'FILL_A', 'MAIN_A']);
  assert.strictEqual(st.sections.MAIN_A.totalTicks, BAR * 2);
  assert.strictEqual(st.sections.FILL_A.totalTicks, BAR, 'FILL_A no absorbe el break');
  assert.strictEqual(st.sections.FILL_A.events.length, 1);
  assert.strictEqual(st.sections.ENDING_A.totalTicks, BAR, 'ENDING redondeado al compás');
  const main = st.sections.MAIN_A.events;
  assert.strictEqual(main[0].tick, 0, 'ticks relativos a la sección');
  const bass = main.find((e) => e.channel === 11);
  assert.strictEqual(bass.program, 33, 'programa del canal aplicado');
  assert.strictEqual(bass.isDrum, false);
  assert.strictEqual(main.find((e) => e.channel === 10).isDrum, true);
  const chord = main.find((e) => e.channel === 12);
  assert.strictEqual(chord.tick + chord.durationTicks, BAR * 2, 'duración recortada al final de la sección');
  for (let i = 1; i < main.length; i++) assert.ok(main[i].tick >= main[i - 1].tick, 'eventos ordenados');
});

test('running status tras evento meta no corrompe el parseo', () => {
  // Note On, luego meta (cancela running status), luego Note On con estado explícito y running status
  const body = [
    0x00, 0xff, 0x06, 0x06, ...str('Main A'),
    0x00, 0x99, 36, 100,
    0x00, 38, 90,              // running status (0x99)
    0x60, 0xff, 0x01, 0x01, 0x41, // texto
    0x00, 0x89, 36, 0,
    0x00, 38, 0,               // running status (0x89)
    0x00, 0xff, 0x2f, 0x00,
  ];
  const bytes = Uint8Array.from([...str('MThd'), ...u32(6), ...u16(0), ...u16(1), ...u16(480), ...str('MTrk'), ...u32(body.length), ...body]);
  const st = parser.parseMidiStyleBinary(bytes, 'RS');
  const ev = st.sections.MAIN_A.events;
  assert.strictEqual(ev.length, 2);
  assert.deepStrictEqual(ev.map((e) => e.note).sort(), [36, 38]);
  assert.ok(ev.every((e) => e.durationTicks === 0x60));
});

test('archivo sin marcadores: todo en MAIN', () => {
  const t = new Track();
  t.note(0, 240, 10, 36).note(960, 240, 10, 38);
  const st = parser.parseMidiStyleBinary(smf([t]), 'Sin marcadores');
  assert.ok(st.sections.MAIN_A && st.sections.MAIN_A.events.length === 2);
});

test('cabecera inválida lanza error', () => {
  assert.throws(() => parser.parseMidiStyleBinary(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8])));
});

test('estilos integrados: todas las secciones tienen eventos dentro de su duración', () => {
  for (const id of ['st_1', 'st_2', 'st_3', 'st_4', 'st_5']) {
    const st = parser.generateProceduralStyle(id);
    for (const [key, sec] of Object.entries(st.sections)) {
      assert.ok(sec.events.length > 0, `${id} ${key} vacío`);
      for (const e of sec.events) {
        assert.ok(e.tick >= 0 && e.tick < sec.totalTicks, `${id} ${key} evento fuera de rango`);
        assert.ok(e.note >= 0 && e.note <= 127 && e.velocity > 0 && e.velocity <= 127);
      }
    }
  }
});

console.log(`\n${passed} pruebas OK`);
