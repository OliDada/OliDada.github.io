// Slice shape library.
// Every shape is drawn in a ~200x200 box and is deliberately NOT mirror-symmetric,
// so there is no obvious axis to cut along.
// draw(h, v)  -> solid silhouette (anything drawn here counts as area)
// deco(h, v)  -> paint-only details, clipped to the silhouette (never changes area)
// p(r)        -> per-day proportions; r() is the seeded random 0..1
// Daily variety = which shapes + proportions + tilt + mirror flip.

const INK = '#1E1B24';
const rnd = (r, a, b) => a + r() * (b - a);

window.SLICE_SHAPES = [
  {
    id: 'duck', name: 'Rubber duck', color: '#FFD23F',
    p: r => ({ head: rnd(r, 26, 36), body: rnd(r, 60, 74), tail: rnd(r, 20, 34) }),
    draw(h, v) {
      h.e(108, 132, v.body, 40).o(72, 80, v.head).e(72 - v.head - 6, 86, 18, 8, -0.15)
       .p([[108 + v.body - 14, 116], [108 + v.body + v.tail * .8, 116 - v.tail], [108 + v.body + 4, 140]]);
    },
    deco(h, v) {
      h.col('#FF8A2B').e(72 - v.head - 6, 86, 18, 8, -0.15);
      h.col(INK).o(66, 72, 5);
      h.col('rgba(30,27,36,.3)').q(96, 122, 124, 152, 154, 122, 4);
    }
  },
  {
    id: 'mug', name: 'Mug', color: '#5B8CFF',
    p: r => ({ w: rnd(r, 84, 110), hgt: rnd(r, 100, 130), hr: rnd(r, 28, 42) }),
    draw(h, v) {
      h.ring(40 + v.w, 108, v.hr, v.hr * .9, 15).rr(40, 168 - v.hgt, v.w, v.hgt, [6, 6, 22, 22]);
    },
    deco(h, v) {
      h.col('rgba(255,255,255,.85)').rr(52, 182 - v.hgt, 10, v.hgt * .6, 5);
      h.col('rgba(30,27,36,.22)').rr(40, 168 - v.hgt, v.w, 10, 0);
    }
  },
  {
    id: 'teapot', name: 'Teapot', color: '#2FB3A3',
    p: r => ({ spout: rnd(r, 34, 52), handle: rnd(r, 20, 30), lid: rnd(r, 20, 30) }),
    draw(h, v) {
      h.e(100, 124, 58, 44).e(100, 82, v.lid, 9).o(100, 70, 8)
       .p([[146, 128], [146, 104], [150 + v.spout, 72], [158 + v.spout, 76], [160, 136]])
       .ring(46, 120, v.handle, v.handle * 1.25, 11);
    },
    deco(h, v) {
      h.col('rgba(255,255,255,.6)').q(70, 108, 82, 96, 100, 96, 6);
      h.col('rgba(30,27,36,.25)').rr(40, 120, 120, 6, 3);
    }
  },
  {
    id: 'boot', name: 'Boot', color: '#B5733E',
    p: r => ({ shaft: rnd(r, 90, 130), toe: rnd(r, 60, 90), heel: rnd(r, 10, 18) }),
    draw(h, v) {
      h.rr(60, 160 - v.shaft, 56, v.shaft + 10, [10, 10, 0, 0])
       .path(c => { c.moveTo(60, 150); c.lineTo(116, 140); c.quadraticCurveTo(116 + v.toe, 140, 116 + v.toe, 168); c.lineTo(116 + v.toe, 178); c.lineTo(60, 178); })
       .rr(56, 176, 34, v.heel, 3);
    },
    deco(h, v) {
      h.col('rgba(30,27,36,.35)');
      for (let i = 0; i < 4; i++) h.l([[72, 170 - v.shaft + 22 + i * 18], [104, 164 - v.shaft + 22 + i * 18]], 4);
      h.col('rgba(30,27,36,.28)').rr(56, 170, 140, 8, 0);
    }
  },
  {
    id: 'snail', name: 'Snail', color: '#F08AB4',
    p: r => ({ shell: rnd(r, 40, 52), body: rnd(r, 140, 175), ant: rnd(r, 22, 34) }),
    draw(h, v) {
      h.rr(20, 140, v.body, 28, 14).o(80, 140 - v.shell + 6, v.shell)
       .l([[20 + v.body - 18, 146], [20 + v.body - 6, 146 - v.ant]], 5)
       .l([[20 + v.body - 8, 148], [20 + v.body + 8, 148 - v.ant * .8]], 5);
    },
    deco(h, v) {
      h.col('#C2D96A').rr(20, 140, v.body, 28, 14);
      const cx = 80, cy = 146 - v.shell;
      h.col('rgba(30,27,36,.4)').spiral(cx, cy, v.shell * .8, 5);
    }
  },
  {
    id: 'key', name: 'Key', color: '#F2B33D',
    p: r => ({ bow: rnd(r, 24, 34), len: rnd(r, 90, 120), teeth: Math.floor(rnd(r, 2, 4.99)) }),
    draw(h, v) {
      h.ring(50, 100, v.bow, v.bow, 16).rr(48 + v.bow, 92, v.len, 16, 4);
      const end = 48 + v.bow + v.len;
      for (let i = 0; i < v.teeth; i++) h.rr(end - 14 - i * 16, 104, 10, 14 + (i % 2) * 8, 2);
    },
    deco(h, v) { h.col('rgba(255,255,255,.6)').l([[48 + v.bow + 6, 96], [48 + v.bow + v.len - 10, 96]], 3); }
  },
  {
    id: 'cat', name: 'Cat', color: '#8C8A99',
    p: r => ({ head: rnd(r, 26, 34), tail: rnd(r, 50, 75), body: rnd(r, 44, 54) }),
    draw(h, v) {
      h.e(100, 130, v.body, 52).o(84, 70, v.head)
       .p([[60, 58], [62, 28], [80, 46]]).p([[92, 44], [108, 28], [110, 58]])
       .q(140, 168, 140 + v.tail * .9, 160, 150 + v.tail * .6, 90, 13);
    },
    deco(h, v) {
      h.col(INK).o(74, 66, 4).o(94, 66, 4);
      h.col('#F08AB4').p([[80, 76], [88, 76], [84, 81]]);
      h.col('rgba(255,255,255,.25)').e(90, 140, 22, 34);
    }
  },
  {
    id: 'bird', name: 'Bird', color: '#E8603A',
    p: r => ({ head: rnd(r, 22, 30), tail: rnd(r, 34, 54), beak: rnd(r, 14, 24) }),
    draw(h, v) {
      h.e(96, 112, 56, 40, -0.15).o(144, 76, v.head)
       .p([[144 + v.head - 4, 72], [144 + v.head + v.beak, 80], [144 + v.head - 4, 86]])
       .p([[48, 104], [48 - v.tail, 84 + v.tail * .2], [44 - v.tail * .9, 108], [52, 126]])
       .l([[90, 148], [84, 176]], 4).l([[108, 148], [110, 176]], 4);
    },
    deco(h, v) {
      h.col('#F2B33D').p([[144 + v.head - 4, 72], [144 + v.head + v.beak, 80], [144 + v.head - 4, 86]]);
      h.col(INK).o(150, 70, 4.5);
      h.col('rgba(30,27,36,.25)').e(84, 108, 34, 18, -0.3);
      h.col('#FFE2C8').e(120, 120, 24, 22, 0);
    }
  },
  {
    id: 'cactus', name: 'Cactus', color: '#4FAF5A',
    p: r => ({ a1: rnd(r, 70, 110), a2: rnd(r, 40, 80), l1: rnd(r, 26, 40), l2: rnd(r, 32, 52), hgt: rnd(r, 120, 150) }),
    draw(h, v) {
      h.rr(84, 172 - v.hgt, 34, v.hgt, 17)
       .l([[90, v.a1], [90 - v.l1, v.a1], [90 - v.l1, v.a1 - 30]], 20)
       .l([[112, v.a2], [112 + v.l2, v.a2], [112 + v.l2, v.a2 - 26]], 20)
       .p([[64, 162], [138, 162], [130, 196], [72, 196]]);
    },
    deco(h, v) {
      h.col('#D9773A').p([[64, 162], [138, 162], [130, 196], [72, 196]]);
      h.col('rgba(30,27,36,.3)').rr(64, 162, 74, 8, 0);
      h.col('rgba(255,255,255,.35)').l([[96, 180 - v.hgt], [96, 150]], 3);
    }
  },
  {
    id: 'whale', name: 'Whale', color: '#4F7FD9',
    p: r => ({ len: rnd(r, 120, 150), tail: rnd(r, 26, 38), fin: rnd(r, 18, 28) }),
    draw(h, v) {
      const x0 = 20, x1 = 20 + v.len;
      h.path(c => { c.moveTo(x0, 110); c.bezierCurveTo(x0, 60, x1 - 30, 70, x1, 104); c.lineTo(x1 + 6, 118); c.bezierCurveTo(x1 - 30, 150, x0, 150, x0, 110); })
       .p([[x1 - 4, 110], [x1 + v.tail, 110 - v.tail * .9], [x1 + v.tail * .55, 112], [x1 + v.tail, 112 + v.tail * .8]])
       .e(70, 138, v.fin, 8, 0.5);
    },
    deco(h, v) {
      h.col('#CFE0FA').path(c => { c.moveTo(24, 120); c.bezierCurveTo(50, 146, 110, 146, 20 + v.len, 116); c.lineTo(20 + v.len, 140); c.lineTo(20, 140); });
      h.col(INK).o(46, 104, 4);
    }
  },
  {
    id: 'lamp', name: 'Desk lamp', color: '#F25C54',
    p: r => ({ a: rnd(r, 50, 80), b: rnd(r, 50, 75), ang: rnd(r, .5, 1.0) }),
    draw(h, v) {
      const j = [70 + v.a * .45, 172 - v.a], t = [j[0] + v.b * Math.cos(-v.ang + .1) , j[1] + v.b * Math.sin(-v.ang + 1.3) * .4];
      h.rr(30, 172, 80, 14, 7).l([[70, 172], j, t], 9).o(j[0], j[1], 8)
       .path(c => { c.save(); c.translate(t[0], t[1]); c.rotate(.5); c.moveTo(-12, -6); c.lineTo(12, -6); c.lineTo(32, 34); c.lineTo(-32, 34); c.closePath(); c.restore(); });
    },
    deco(h, v) { h.col('rgba(30,27,36,.3)').rr(30, 180, 80, 6, 0); }
  },
  {
    id: 'pear', name: 'Pear', color: '#B7D84B',
    p: r => ({ bot: rnd(r, 44, 54), top: rnd(r, 24, 32), lean: rnd(r, -16, -4), leaf: rnd(r, 16, 26) }),
    draw(h, v) {
      h.o(100, 140, v.bot).o(100 + v.lean, 86, v.top)
       .path(c => { c.moveTo(100 - v.bot, 140); c.lineTo(100 + v.lean - v.top, 86); c.lineTo(100 + v.lean + v.top, 86); c.lineTo(100 + v.bot, 140); })
       .l([[100 + v.lean, 62], [96 + v.lean, 40]], 6).e(110 + v.lean + v.leaf * .3, 46, v.leaf, 8, -0.5);
    },
    deco(h, v) {
      h.col('#7A4A1E').l([[100 + v.lean, 62], [96 + v.lean, 40]], 6);
      h.col('#4FAF5A').e(110 + v.lean + v.leaf * .3, 46, v.leaf, 8, -0.5);
      h.col('rgba(255,255,255,.5)').e(80, 130, 8, 18, .3);
    }
  },
  {
    id: 'pan', name: 'Frying pan', color: '#3A3F4B',
    p: r => ({ r: rnd(r, 44, 60), handle: rnd(r, 70, 100) }),
    draw(h, v) { h.o(70, 100, v.r).rr(70 + v.r - 6, 92, v.handle, 16, 8); },
    deco(h, v) {
      h.col('#5A6070').o(70, 100, v.r - 8);
      h.col('#B5733E').rr(70 + v.r + 20, 92, v.handle - 26, 16, 8);
      h.col('rgba(255,255,255,.25)').q(44, 80, 52, 66, 70, 62, 5);
    }
  },
  {
    id: 'hammer', name: 'Hammer', color: '#9AA3B2',
    p: r => ({ head: rnd(r, 70, 96), handle: rnd(r, 110, 140), claw: rnd(r, 20, 30) }),
    draw(h, v) {
      h.rr(60, 30, v.head, 30, 4)
       .p([[60, 32], [60 - v.claw, 22], [60 - v.claw * .6, 46], [60, 56]])
       .rr(60 + v.head * .45, 56, 18, v.handle, 6);
    },
    deco(h, v) { h.col('#B5733E').rr(60 + v.head * .45, 64, 18, v.handle - 8, 6); h.col('rgba(255,255,255,.5)').rr(64, 34, v.head - 8, 5, 2); }
  },
  {
    id: 'sock', name: 'Sock', color: '#E8603A',
    p: r => ({ leg: rnd(r, 90, 120), foot: rnd(r, 60, 90), w: rnd(r, 40, 50) }),
    draw(h, v) {
      h.l([[80, 30], [80, 30 + v.leg], [80 + v.foot, 30 + v.leg + 18]], v.w);
    },
    deco(h, v) {
      h.col('#FFFFFF');
      for (let i = 0; i < 3; i++) h.rr(40, 30 + i * 14, 80, 6, 0);
      h.col('#FFD23F').o(80 + v.foot + v.w * .25, 30 + v.leg + 18, v.w * .6);
    }
  },
  {
    id: 'dino', name: 'Dinosaur', color: '#6CC27A',
    p: r => ({ neck: rnd(r, 50, 75), tail: rnd(r, 50, 70), body: rnd(r, 46, 58) }),
    draw(h, v) {
      h.e(110, 128, v.body, 32)
       .q(80, 116, 60, 90, 60, 116 - v.neck - 20, 18).e(52, 116 - v.neck - 24, 18, 11, -0.2)
       .q(150, 120, 160 + v.tail * .4, 140, 150 + v.tail, 150, 13)
       .rr(80, 140, 16, 40, 6).rr(100, 144, 16, 36, 6).rr(124, 144, 16, 36, 6).rr(140, 140, 16, 40, 6);
    },
    deco(h, v) { h.col(INK).o(46, 116 - v.neck - 27, 3.5); h.col('rgba(255,255,255,.3)').e(110, 116, 30, 10); }
  },
  {
    id: 'elephant', name: 'Elephant', color: '#A3A8B8',
    p: r => ({ head: rnd(r, 28, 34), trunk: rnd(r, 40, 60), ear: rnd(r, 18, 26) }),
    draw(h, v) {
      h.e(116, 112, 58, 40).o(58, 94, v.head)
       .q(34, 104, 22, 130, 30, 104 + v.trunk, 14)
       .rr(76, 130, 22, 50, 6).rr(104, 136, 22, 44, 6).rr(140, 136, 22, 44, 6).rr(156, 128, 20, 52, 6)
       .l([[172, 104], [184, 128]], 4);
    },
    deco(h, v) {
      h.col('rgba(30,27,36,.18)').e(76, 96, v.ear, v.ear * 1.3, .2);
      h.col(INK).o(48, 88, 3.5);
      h.col('#FFFFFF').q(40, 112, 30, 118, 26, 112, 5);
    }
  },
  {
    id: 'sailboat', name: 'Sailboat', color: '#F4F1EA',
    p: r => ({ sail: rnd(r, 50, 70), jib: rnd(r, 26, 40), mast: rnd(r, 100, 120), hull: rnd(r, 140, 170) }),
    draw(h, v) {
      const x0 = 100 - v.hull / 2, x1 = 100 + v.hull / 2;
      h.p([[x0, 140], [x1, 140], [x1 - 22, 170], [x0 + 10, 170]])
       .rr(96, 140 - v.mast, 6, v.mast, 2)
       .p([[104, 144 - v.mast], [104, 132], [104 + v.sail, 132]])
       .p([[94, 150 - v.mast * .8], [94, 132], [94 - v.jib, 132]])
       .p([[99, 140 - v.mast], [120, 132 - v.mast], [99, 124 - v.mast]]);
    },
    deco(h, v) {
      const x0 = 100 - v.hull / 2, x1 = 100 + v.hull / 2;
      h.col('#E8603A').p([[x0, 140], [x1, 140], [x1 - 22, 170], [x0 + 10, 170]]);
      h.col('#5B8CFF').p([[99, 140 - v.mast], [120, 132 - v.mast], [99, 124 - v.mast]]);
      h.col('rgba(30,27,36,.6)').rr(96, 140 - v.mast, 6, v.mast, 2);
    }
  },
  {
    id: 'house', name: 'House', color: '#F2B33D',
    p: r => ({ w: rnd(r, 90, 120), shed: rnd(r, 30, 55), chim: rnd(r, .15, .7), roof: rnd(r, 40, 56) }),
    draw(h, v) {
      const x0 = 30, x1 = 30 + v.w;
      h.rr(x0, 100, v.w, 80, 0).p([[x0 - 10, 102], [x0 + v.w / 2, 102 - v.roof], [x1 + 10, 102]])
       .rr(x0 + v.w * v.chim, 102 - v.roof * .9, 16, 40, 0)
       .rr(x1, 130, v.shed, 50, 0).p([[x1, 132], [x1, 118], [x1 + v.shed + 6, 132]]);
    },
    deco(h, v) {
      const x0 = 30;
      h.col('#D9433B').p([[x0 - 10, 102], [x0 + v.w / 2, 102 - v.roof], [x0 + v.w + 10, 102]]);
      h.col('#7A4A1E').rr(x0 + v.w * .55, 136, 22, 44, [8, 8, 0, 0]);
      h.col('#CDE6F4').rr(x0 + 14, 116, 24, 22, 3);
      h.col('rgba(30,27,36,.25)').rr(x0 + v.w, 130, v.shed, 6, 0);
    }
  },
  {
    id: 'tree', name: 'Tree', color: '#4FAF5A',
    p: r => ({ blobs: Array.from({ length: 4 }, () => [rnd(r, 50, 150), rnd(r, 40, 100), rnd(r, 22, 38)]), lean: rnd(r, -18, 18) }),
    draw(h, v) {
      h.p([[92, 186], [114, 186], [104 + v.lean, 100], [96 + v.lean, 100]]);
      v.blobs.forEach(([x, y, r]) => h.o(x, y, r));
      h.o(100 + v.lean * .5, 80, 34);
    },
    deco(h, v) {
      h.col('#8A5A2B').p([[92, 186], [114, 186], [104 + v.lean, 120], [96 + v.lean, 120]]);
      h.col('rgba(255,255,255,.18)');
      v.blobs.forEach(([x, y, r]) => h.o(x - r * .3, y - r * .3, r * .4));
    }
  },
  {
    id: 'cloud', name: 'Cloud', color: '#FFFFFF',
    p: r => ({ blobs: Array.from({ length: 5 }, (_, i) => [30 + i * 34 + rnd(r, -8, 8), rnd(r, 84, 116), rnd(r, 20, 40)]) }),
    draw(h, v) { v.blobs.forEach(([x, y, r]) => h.o(x, y, r)); h.rr(30, 100, 136, 26, 13); },
    deco(h, v) { h.col('#DDE6F2').rr(10, 116, 180, 40, 0); }
  },
  {
    id: 'icecream', name: 'Ice cream', color: '#F7A8C4',
    p: r => ({ s1: rnd(r, 26, 34), s2: rnd(r, 20, 28), off: rnd(r, 8, 20), drip: rnd(r, 12, 26) }),
    draw(h, v) {
      h.p([[70, 110], [130, 110], [100, 192]]).o(100, 100, v.s1).o(100 + v.off, 100 - v.s1 - v.s2 + 12, v.s2)
       .rr(76, 104, 10, v.drip + 10, 5);
    },
    deco(h, v) {
      h.col('#E0A84A').p([[70, 112], [130, 112], [100, 192]]);
      h.col('rgba(30,27,36,.25)').l([[78, 124], [110, 170]], 3).l([[100, 120], [118, 150]], 3).l([[122, 124], [92, 170]], 3);
      h.col('#C9F0E0').o(100 + v.off, 100 - v.s1 - v.s2 + 12, v.s2);
      h.col('#F7A8C4').rr(76, 108, 10, v.drip + 6, 5);
    }
  },
  {
    id: 'chair', name: 'Chair', color: '#B5733E',
    p: r => ({ back: rnd(r, 70, 100), seat: rnd(r, 60, 80), leg: rnd(r, 50, 70) }),
    draw(h, v) {
      const y = 180 - v.leg;
      h.rr(56, y - v.back, 14, v.back + 4, 4).rr(56, y, v.seat + 14, 14, 3)
       .rr(58, y + 10, 10, v.leg, 2).rr(56 + v.seat, y + 10, 10, v.leg, 2)
       .rr(70, y - v.back + 10, 8, 10, 2).rr(70, y - v.back * .5, 8, 10, 2);
    },
    deco(h, v) { h.col('rgba(255,255,255,.3)').rr(60, 180 - v.leg - v.back + 6, 4, v.back - 10, 2); }
  },
  {
    id: 'dog', name: 'Dog', color: '#D9A066',
    p: r => ({ head: rnd(r, 22, 28), tail: rnd(r, 22, 34), legs: rnd(r, 30, 42), snout: rnd(r, 14, 22) }),
    draw(h, v) {
      h.e(100, 112, 52, 28).o(46, 78, v.head).e(46 - v.head - v.snout * .4, 86, v.snout, 11)
       .e(56, 70, 10, 22, .4)
       .rr(60, 120, 14, v.legs + 10, 6).rr(80, 124, 14, v.legs + 6, 6).rr(120, 124, 14, v.legs + 6, 6).rr(138, 120, 14, v.legs + 10, 6)
       .q(148, 100, 160, 90, 156 + v.tail * .4, 100 - v.tail, 8);
    },
    deco(h, v) {
      h.col('#8A5A2B').e(56, 70, 10, 22, .4);
      h.col(INK).o(42, 72, 3.5).o(46 - v.head - v.snout * 1.3, 84, 5);
      h.col('rgba(255,255,255,.3)').e(100, 120, 34, 10);
    }
  },
  {
    id: 'note', name: 'Music note', color: '#9B6BFF',
    p: r => ({ stem: rnd(r, 110, 140), flag: rnd(r, 40, 60), head: rnd(r, 24, 30) }),
    draw(h, v) {
      h.e(70, 168, v.head, v.head * .7, -0.45).rr(70 + v.head - 9, 168 - v.stem, 10, v.stem, 3)
       .q(70 + v.head - 4, 168 - v.stem + 4, 70 + v.head + v.flag, 168 - v.stem + 30, 70 + v.head + v.flag * .7, 168 - v.stem + 70, 13);
    },
    deco(h, v) { h.col('rgba(255,255,255,.4)').e(62, 162, 8, 4, -0.45); }
  },
  {
    id: 'wateringcan', name: 'Watering can', color: '#4FA8D8',
    p: r => ({ spout: rnd(r, 44, 64), w: rnd(r, 80, 100), handle: rnd(r, 22, 32) }),
    draw(h, v) {
      h.rr(50, 90, v.w, 86, 10)
       .p([[50 + v.w - 4, 150], [50 + v.w - 4, 130], [50 + v.w + v.spout, 80], [50 + v.w + v.spout + 8, 88]])
       .e(50 + v.w + v.spout + 6, 82, 12, 7, -0.7)
       .ring(50 + 4, 112, v.handle, v.handle * 1.1, 10);
    },
    deco(h, v) { h.col('rgba(255,255,255,.45)').rr(60, 100, 8, 60, 4); h.col('rgba(30,27,36,.2)').rr(50, 90, v.w, 8, 0); }
  },
  {
    id: 'car', name: 'Car', color: '#E8443A',
    p: r => ({ cab: rnd(r, 60, 84), cabx: rnd(r, 30, 60), hood: rnd(r, 30, 42) }),
    draw(h, v) {
      h.rr(10, 104, 180, 44, [16, 22, 12, 12])
       .p([[v.cabx, 106], [v.cabx + 14, 106 - v.hood], [v.cabx + 14 + v.cab, 106 - v.hood], [v.cabx + 34 + v.cab, 106]])
       .o(52, 150, 20).o(150, 150, 20);
    },
    deco(h, v) {
      h.col('#CDE6F4').p([[v.cabx + 10, 104], [v.cabx + 20, 112 - v.hood], [v.cabx + 10 + v.cab, 112 - v.hood], [v.cabx + 26 + v.cab, 104]]);
      h.col(INK).o(52, 150, 20).o(150, 150, 20);
      h.col('#9AA3B2').o(52, 150, 9).o(150, 150, 9);
      h.col('#FFD23F').rr(176, 114, 12, 8, 3);
    }
  },
  {
    id: 'sneaker', name: 'Sneaker', color: '#FFFFFF',
    p: r => ({ heel: rnd(r, 60, 80), toe: rnd(r, 30, 42), len: rnd(r, 150, 175) }),
    draw(h, v) {
      h.rr(14, 156, v.len, 22, 10)
       .path(c => { c.moveTo(18, 160); c.lineTo(18, 160 - v.heel); c.lineTo(60, 160 - v.heel + 6); c.quadraticCurveTo(80, 130, 120, 128); c.quadraticCurveTo(14 + v.len, 128, 14 + v.len, 160 - v.toe * .2); c.lineTo(14 + v.len, 162); });
    },
    deco(h, v) {
      h.col('#E8603A').rr(14, 156, v.len, 22, 10);
      h.col('#5B8CFF').path(c => { c.moveTo(40, 150); c.quadraticCurveTo(90, 120, 130, 150); c.quadraticCurveTo(90, 136, 40, 156); });
      h.col('rgba(30,27,36,.35)'); for (let i = 0; i < 3; i++) h.l([[66 + i * 14, 140 - i * 4], [76 + i * 14, 150 - i * 4]], 3);
    }
  },
  {
    id: 'mitten', name: 'Mitten', color: '#D9433B',
    p: r => ({ w: rnd(r, 40, 50), thumb: rnd(r, 14, 20), ta: rnd(r, -.7, -.3) }),
    draw(h, v) { h.e(104, 96, v.w, 62).e(104 - v.w + 4, 108, v.thumb, 30, v.ta).rr(104 - v.w + 6, 150, v.w * 2 - 12, 34, 6); },
    deco(h, v) {
      h.col('#FFFFFF').rr(104 - v.w + 6, 150, v.w * 2 - 12, 34, 6);
      h.col('rgba(30,27,36,.18)'); for (let i = 0; i < 4; i++) h.rr(104 - v.w + 6, 154 + i * 8, v.w * 2 - 12, 3, 0);
      h.col('#FFFFFF').o(110, 80, 6).o(96, 104, 4).o(120, 116, 5);
    }
  },
  {
    id: 'axe', name: 'Axe', color: '#9AA3B2',
    p: r => ({ handle: rnd(r, 140, 170), blade: rnd(r, 40, 56) }),
    draw(h, v) {
      h.q(70, 190, 86, 110, 110, 190 - v.handle, 13)
       .path(c => { c.moveTo(100, 40); c.lineTo(126, 36); c.quadraticCurveTo(126 + v.blade, 30, 120 + v.blade, 74); c.quadraticCurveTo(140, 60, 118, 70); c.lineTo(104, 64); });
    },
    deco(h, v) { h.col('#B5733E').q(70, 190, 86, 110, 106, 70, 13); h.col('rgba(255,255,255,.6)').q(126 + v.blade * .6, 38, 128 + v.blade * .8, 52, 116 + v.blade, 66, 4); }
  },
  {
    id: 'spray', name: 'Spray bottle', color: '#2FB3A3',
    p: r => ({ body: rnd(r, 90, 110), nozzle: rnd(r, 26, 40), trig: rnd(r, 20, 30) }),
    draw(h, v) {
      h.rr(70, 180 - v.body, 60, v.body, 12).rr(88, 168 - v.body, 24, 16, 2)
       .p([[78, 168 - v.body], [126, 168 - v.body], [126, 140 - v.body], [72 - v.nozzle, 138 - v.body], [72 - v.nozzle, 150 - v.body], [78, 152 - v.body]])
       .q(84, 164 - v.body, 76, 172 - v.body + v.trig, 70, 176 - v.body + v.trig, 8);
    },
    deco(h, v) {
      h.col('#F4F1EA').p([[78, 168 - v.body], [126, 168 - v.body], [126, 140 - v.body], [72 - v.nozzle, 138 - v.body], [72 - v.nozzle, 150 - v.body], [78, 152 - v.body]]);
      h.col('rgba(255,255,255,.5)').rr(80, 196 - v.body, 8, v.body - 40, 4);
      h.col('#FFFFFF').rr(78, 220 - v.body, 44, 30, 4);
    }
  },
  {
    id: 'snake', name: 'Snake', color: '#7CC24E',
    p: r => ({ amp: rnd(r, 22, 34), waves: rnd(r, 1.2, 1.8), head: rnd(r, 14, 18) }),
    draw(h, v) {
      const pts = []; for (let i = 0; i <= 30; i++) { const t = i / 30; pts.push([20 + t * 150, 100 + Math.sin(t * Math.PI * 2 * v.waves) * v.amp]); }
      h.l(pts, 20); const end = pts[pts.length - 1]; h.e(end[0] + 10, end[1], v.head + 8, v.head, 0);
    },
    deco(h, v) {
      const pts = []; for (let i = 0; i <= 30; i++) { const t = i / 30; pts.push([20 + t * 150, 100 + Math.sin(t * Math.PI * 2 * v.waves) * v.amp]); }
      h.col('#F2D35B'); for (let i = 2; i < 28; i += 4) h.o(pts[i][0], pts[i][1], 4);
      const end = pts[pts.length - 1]; h.col(INK).o(end[0] + 16, end[1] - 5, 3);
    }
  },
  {
    id: 'rabbit', name: 'Rabbit', color: '#E6DED1',
    p: r => ({ ear: rnd(r, 40, 56), body: rnd(r, 46, 56), ea: rnd(r, .1, .5) }),
    draw(h, v) {
      h.e(110, 140, v.body, 40).o(60, 110, 26).o(110 + v.body - 2, 150, 12)
       .e(62, 110 - v.ear, 9, v.ear * .8, -v.ea).e(76, 110 - v.ear + 6, 9, v.ear * .75, v.ea * .6)
       .e(60, 172, 22, 8);
    },
    deco(h, v) {
      h.col('#F7A8C4').e(62, 110 - v.ear, 4, v.ear * .55, -v.ea);
      h.col(INK).o(50, 104, 3.5);
      h.col('#FFFFFF').o(110 + v.body - 2, 150, 10);
    }
  },
  {
    id: 'guitar', name: 'Guitar', color: '#F4A93B',
    p: r => ({ lower: rnd(r, 38, 46), upper: rnd(r, 26, 32), neck: rnd(r, 60, 80), cut: rnd(r, 12, 18) }),
    draw(h, v) {
      // electric-style body: offset horns break the symmetry
      h.o(100, 150, v.lower).o(92, 110, v.upper).e(118, 96, 10, v.cut + 8, .4)
       .rr(93, 110 - v.upper - v.neck, 14, v.neck + 20, 2).p([[90, 110 - v.upper - v.neck], [112, 110 - v.upper - v.neck], [118, 80 - v.upper - v.neck], [94, 86 - v.upper - v.neck]]);
    },
    deco(h, v) {
      h.col('#7A4A1E').rr(93, 110 - v.upper - v.neck, 14, v.neck + 30, 2);
      h.col('#FFFFFF').rr(84, 132, 32, 8, 3).rr(84, 150, 32, 8, 3);
      h.col('#F4F1EA').path(c => { c.moveTo(110, 140); c.quadraticCurveTo(140, 150, 128, 176); c.quadraticCurveTo(116, 170, 110, 160); });
    }
  },
  {
    id: 'pipe', name: 'Pipe', color: '#8A5A2B',
    p: r => ({ bowl: rnd(r, 48, 60), stem: rnd(r, 70, 100), lift: rnd(r, 10, 30) }),
    draw(h, v) {
      h.rr(40, 70, v.bowl, 70, [4, 4, 24, 24]).q(40 + v.bowl - 6, 124, 90 + v.stem * .4, 128, 40 + v.bowl + v.stem, 110 - v.lift, 12);
    },
    deco(h, v) { h.col('#3A3F4B').rr(44, 70, v.bowl - 8, 10, 3); h.col(INK).q(40 + v.bowl + v.stem * .7, 116 - v.lift * .5, 40 + v.bowl + v.stem * .85, 112 - v.lift, 40 + v.bowl + v.stem, 110 - v.lift, 12); }
  },
  {
    id: 'mushroom', name: 'Mushroom', color: '#F25C54',
    p: r => ({ cap: rnd(r, 50, 72), tilt: rnd(r, .15, .35), stem: rnd(r, 50, 70), bend: rnd(r, 10, 26) }),
    draw(h, v) {
      h.q(100, 180, 100 + v.bend, 180 - v.stem * .6, 96, 180 - v.stem, 26)
       .path(c => { c.save(); c.translate(96, 186 - v.stem); c.rotate(v.tilt); c.ellipse(0, 0, v.cap, v.cap * .75, 0, Math.PI, 0); c.closePath(); c.restore(); });
    },
    deco(h, v) {
      h.col('#FFF3E6').q(100, 180, 100 + v.bend, 180 - v.stem * .6, 96, 180 - v.stem, 26);
      h.col('#FFF3E6').path(c => { c.save(); c.translate(96, 186 - v.stem); c.rotate(v.tilt); [[-.4, -.4, .16], [.15, -.6, .2], [.5, -.25, .13], [-.15, -.15, .1]].forEach(([x, y, r]) => { c.moveTo(x * v.cap + r * v.cap, y * v.cap); c.arc(x * v.cap, y * v.cap, r * v.cap, 0, 7); }); c.restore(); });
    }
  },
  {
    id: 'fish', name: 'Fish', color: '#FF8A5B',
    p: r => ({ body: rnd(r, 52, 66), fin: rnd(r, 20, 34), tail: rnd(r, 30, 46), belly: rnd(r, 8, 18) }),
    draw(h, v) {
      h.path(c => { c.moveTo(30, 104); c.bezierCurveTo(50, 50, 130, 56, 150, 100); c.bezierCurveTo(130, 140 + v.belly, 50, 150, 30, 104); })
       .p([[144, 100], [150 + v.tail, 66], [140 + v.tail, 104], [156 + v.tail * .8, 132]])
       .path(c => { c.moveTo(66, 70); c.quadraticCurveTo(90, 60 - v.fin, 120, 70); });
    },
    deco(h, v) {
      h.col(INK).o(52, 96, 5);
      h.col('rgba(30,27,36,.3)').q(68, 82, 78, 104, 68, 124, 4);
      h.col('rgba(255,255,255,.35)').q(90, 90, 110, 84, 130, 94, 4);
    }
  }
];
