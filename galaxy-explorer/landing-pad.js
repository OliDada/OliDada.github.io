// A landing pad, drawn the same way wherever ships set down: on a spaceport's apron and
// on a station's deck. A dark deck with a paler landing field, a striped warning rim, a
// bold ring, four chevrons pointing to the middle, a lit centre and lights round the edge.
// On the ground (raised) it also has blast walls on three sides and lamp masts.
//
// padPieces(THREE, r, { raised }) returns pieces in the pad's own frame (y up, the deck at
// y = 0): [{ geo, colour, glow }], colour one of 'field' | 'mark' | 'dark' | 'metal' | 'light'.
// The caller places them and maps the colour names to its own palette.
export function padPieces(THREE, r, { raised = false } = {}) {
  const out = [], TAU = Math.PI * 2;
  const flat = (g, y) => g.rotateX(-Math.PI / 2).translate(0, y, 0);
  const put = (geo, colour, glow = false) => out.push({ geo, colour, glow });
  put(flat(new THREE.CircleGeometry(r * .9, 40), .012), 'field');
  for (let i = 0; i < 24; i++) put(flat(new THREE.RingGeometry(r * .9, r, 3, 1, i / 24 * TAU, TAU / 24), .016), i % 2 ? 'mark' : 'dark');
  put(flat(new THREE.RingGeometry(r * .6, r * .67, 40), .02), 'mark');
  put(flat(new THREE.RingGeometry(r * .13, r * .19, 20), .02), 'mark');
  put(flat(new THREE.CircleGeometry(r * .08, 12), .024), 'light', true);
  const chevron = new THREE.Shape([[0, r * .26], [r * .16, r * .5], [r * .16, r * .56], [0, r * .36], [-r * .16, r * .56], [-r * .16, r * .5]].map(([x, y]) => new THREE.Vector2(x, y)));
  for (let i = 0; i < 4; i++) put(flat(new THREE.ShapeGeometry(chevron), .02).rotateY(i * Math.PI / 2 + Math.PI / 4), 'mark');
  for (let i = 0; i < 12; i++) { const a = (i + .5) / 12 * TAU; put(new THREE.BoxGeometry(r * .035, r * .02, r * .035).translate(Math.cos(a) * r * .95, r * .012, Math.sin(a) * r * .95), 'light', true); }
  if (raised) {
    for (let k = 0; k < 3; k++) for (let j = -1; j <= 1; j++) { // blast walls: three leaning plates on each of three sides
      const a = k / 3 * TAU + .5 + j * .26;
      put(new THREE.BoxGeometry(r * .3, r * .18, r * .04).translate(0, r * .09, 0).rotateX(-.35).translate(0, 0, r * 1.14).rotateY(a), 'metal');
    }
    for (let k = 0; k < 3; k++) { // lamp masts between them
      const a = k / 3 * TAU + .5 + TAU / 6, x = Math.cos(a) * r * 1.16, z = Math.sin(a) * r * 1.16;
      put(new THREE.CylinderGeometry(r * .012, r * .02, r * .7, 5).translate(x, r * .35, z), 'metal');
      put(new THREE.BoxGeometry(r * .08, r * .03, r * .08).translate(x * .96, r * .7, z * .96), 'light', true);
    }
  }
  return out;
}
