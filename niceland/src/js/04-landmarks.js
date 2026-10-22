/**
 * Landmarks
 *
 * Hand-set heights and materials for landmarks such as Hallgrímskirkja, Harpa and Perlan.
 *
 * State and constants: LANDMARKS
 */

// w wall colour, r roof colour (only used where no aerial colour), h height, rs roof shape, tw tower {at:'N'|'S'|'E'|'W', s:size, h:height, sp:spire height}
const LANDMARKS = {
  'Alþingishúsið': { w: [104, 102, 98], r: [52, 54, 58], h: 11, rs: 'hip', rp: 0.45 },
  'Dómkirkjan': {
    w: [238, 236, 228],
    r: [56, 58, 62],
    h: 8,
    rs: 'gable',
    rp: 0.8,
    tw: { at: 'W', s: 4.2, h: 12, sp: 6 }
  },
  'Fríkirkjan í Reykjavík': {
    w: [244, 242, 236],
    h: 9,
    rs: 'gable',
    rp: 0.9,
    tw: { at: 'W', s: 4.6, h: 15, sp: 10 }
  },
  'Landakotskirkja': {
    w: [178, 178, 172],
    r: [96, 100, 106],
    h: 15,
    rs: 'gable',
    rp: 0.9,
    tw: { at: 'N', s: 8, h: 31 }
  },
  'Stjórnarráð Íslands': { w: [240, 238, 232], r: [46, 48, 52], h: 8, rs: 'gable', rp: 0.75 },
  'Menntaskólinn í Reykjavík': { w: [244, 242, 234], r: [52, 54, 58], h: 10, rs: 'gable', rp: 0.7 },
  'Kvennaskólinn í Reykjavík (Aðalbygging)': { w: [236, 224, 196], h: 10 },
  'Þjóðleikhúsið': { w: [84, 86, 88], r: [70, 72, 76], h: 18, rs: 'hip', rp: 0.35, glassless: 1 },
  'Safnahúsið': { w: [236, 232, 222], r: [52, 54, 58], h: 13, rs: 'hip', rp: 0.4 },
  'Ráðhús Reykjavíkur': { w: [206, 206, 202], r: [104, 112, 96], h: 11, rs: 'flat', glass: 1 },
  'Hótel Borg': { w: [236, 230, 212], h: 20, rs: 'flat' },
  'Iðnó': { w: [242, 240, 234], h: 8 },
  'Hafnarhúsið': { w: [224, 222, 216], rs: 'flat' },
  'Listasafn Íslands': { w: [236, 234, 228] },
  'Sundhöll Reykjavíkur': { w: [238, 236, 230], h: 12, rs: 'flat' },
  'Listasafn Einars Jónssonar': { w: [210, 206, 196], h: 11, rs: 'flat' },
  'Norræna húsið': { w: [244, 244, 240], r: [52, 86, 138], rs: 'mono', h: 7 },
  'Kjarvalsstaðir': { w: [196, 194, 188], rs: 'flat', h: 7, glass: 1 },
  'Laugardalshöll': { w: [236, 236, 232], rs: 'flat', h: 15 },
  'Háteigskirkja': { w: [246, 246, 242], h: 9, tw: { at: 'W', s: 5, h: 14, sp: 12 } },
  'Neskirkja': { w: [214, 214, 208], rs: 'mono', h: 10 },
  'Langholtskirkja': { w: [222, 222, 218], h: 12 },
  'Seltjarnarneskirkja': { w: [232, 232, 228], h: 9 },
  'Kópavogskirkja': { w: [238, 238, 234], h: 14, rs: 'gable', rp: 1.2 },
  'Gróttuviti': { w: [246, 246, 242], r: [176, 52, 44] },
  'Bessastaðir': { w: [244, 242, 236], r: [170, 48, 40], h: 9, rs: 'gable', rp: 0.8 },
  'Bessastaðakirkja': {
    w: [244, 242, 236],
    r: [170, 48, 40],
    h: 8,
    rs: 'gable',
    rp: 0.9,
    tw: { at: 'W', s: 4.5, h: 13, sp: 5 }
  },
  'Turninn': { w: [72, 92, 112], glass: 1, rs: 'flat', onlyTall: 1 },
  'Akureyrarkirkja': { w: [226, 226, 220], r: [70, 74, 80], h: 16, rs: 'gable', rp: 0.8 },
  'Menningarhúsið Hof': { w: [66, 66, 66], rs: 'flat' },
  'Ráðhús Akureyrar': { w: [232, 230, 224], rs: 'flat' },
  'Viðeyjarstofa': { w: [236, 232, 222], r: [52, 54, 58], h: 8, rs: 'gable', rp: 0.8 },
  'Viðeyjarkirkja': { w: [236, 232, 222], r: [52, 54, 58], h: 6, rs: 'gable', rp: 0.9 },
  'Höfði': { w: [244, 242, 236], r: [70, 74, 82], h: 9, rs: 'gable', rp: 0.8 }
};
