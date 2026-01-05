#!/usr/bin/env node

const url = process.argv[2];
if (!url) {
  console.error("Usage: node pokepaste-html-to-md.mjs <pokepaste-url>");
  process.exit(1);
}

const base = url.replace(/\/$/, "");

// 1. Fetch HTML + raw text
const [html, raw] = await Promise.all([
  fetch(base).then(r => r.text()),
  fetch(base + "/raw").then(r => r.text())
]);

// 2. Extract sprite URLs in order
// PokéPaste sprites look like: <img src="https://play.pokemonshowdown.com/sprites/...">
const spriteRegex = /<img[^>]+src="([^"]+pokemon[^"]+)"[^>]*>/g;
const sprites = [...html.matchAll(spriteRegex)].map(m => m[1]);

// 3. Parse raw team text
// Split on blank lines (allowing whitespace) so blocks aren't merged when blank lines contain spaces
const blocks = raw.trim().split(/\n\s*\n/);

// Parse each block into a structured object
const team = blocks.map((block, i) => {
  // Trim each line and remove blank lines so parsing isn't confused by indentation
  const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
  const header = lines[0] || "";

  const name = header.split("@")[0].trim();
  const item = header.includes("@") ? header.split("@")[1].trim() : "—";

  let ability = "—";
  let nature = "—";
  const moves = [];

  for (const line of lines.slice(1)) {
    const t = line.trim();
    if (/^Ability:/i.test(t)) {
      ability = t.replace(/^Ability:\s*/i, "").trim();
    } else if (/Nature$/i.test(t)) {
      nature = t.replace(/Nature$/i, "").trim();
    } else if (/^[-—]\s*/.test(t)) {
      // Accept hyphen or em-dash bullets
      const move = t.replace(/^[-—]\s*/, "").trim();
      if (move) moves.push(move);
    }
  }

  // If sprite is relative, prefix with the site; if it's already absolute leave it
  const rawSprite = sprites[i] || "";
  const sprite = rawSprite ? (rawSprite.startsWith('http') ? rawSprite : 'https://pokepast.es' + rawSprite) : "";

  return { name, item, ability, nature, moves, sprite };
});

// Diagnostic if numbers don't match (helps debugging mismatched parsing)
if (blocks.length !== sprites.length) {
  console.error(`Found ${blocks.length} blocks but ${sprites.length} sprites`);
}

// Render horizontal table: one row per Pokémon, read left-to-right across columns
team.forEach(p => {
  const spriteCell = p.sprite ? `<img src="${p.sprite}" alt="${p.name}" style="width: 80px;">` : '';
  const movesCell = p.moves.map(m => `• ${m}`).join('<br>');
  
  console.log(`<div style="display: flex; gap: 20px; margin-bottom: 20px;">`);
  console.log(`  <div style="flex: 0 0 80px;">`);
  console.log(`    ${spriteCell}`);
  console.log(`  </div>`);
  console.log(`  <div style="flex: 1;">`);
  console.log(`    <strong>${p.name}</strong><br>`);
  console.log(`    <em>Item:</em> ${p.item}<br>`);
  console.log(`    <em>Ability:</em> ${p.ability} | <em>Nature:</em> ${p.nature}`);
  console.log(`  </div>`);
  console.log(`  <div style="flex: 1;">`);
  console.log(`    ${movesCell}`);
  console.log(`  </div>`);
  console.log(`</div>\n`);
});

console.log();
