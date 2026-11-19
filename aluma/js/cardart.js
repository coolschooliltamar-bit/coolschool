// Card art – replaced by the full illustrated SVG set (see cards/ and tools/build-cards.mjs).
export function cardArt(c, { mini = false } = {}) {
  return `<span class="art-emoji ${c.rarity}" aria-hidden="true">${c.emoji}</span>`;
}
