// Swap puzzles, one per day (day 1 = 13 Nov 2026). Each: four groups [difficulty y/g/b/p, category, four words],
// and `mix`: the swaps that scramble the solved board (so the best possible solve is mix.length swaps).
// Every word must be unique in its puzzle, and no row may already be solved after mixing.
window.SWAP_PUZZLES = [
  { groups: [
    ['y', 'Chess pieces', 'KING', 'ROOK', 'BISHOP', 'PAWN'],
    ['g', '___ball', 'FOOT', 'SNOW', 'EYE', 'MEAT'],
    ['b', 'Card games', 'SNAP', 'POKER', 'BRIDGE', 'RUMMY'],
    ['p', 'Hidden animals', 'SCATTER', 'BEARD', 'PANTRY', 'DOGMA']],
    mix: [['KING', 'SNAP'], ['FOOT', 'BEARD'], ['BRIDGE', 'PAWN'], ['EYE', 'DOGMA']] },
  { groups: [
    ['y', 'Things with keys', 'PIANO', 'MAP', 'KEYBOARD', 'LOCK'],
    ['g', 'Things with shells', 'EGG', 'SNAIL', 'TURTLE', 'PEANUT'],
    ['b', '___house', 'GREEN', 'LIGHT', 'DOG', 'TREE'],
    ['p', '___nut', 'DOUGH', 'CHEST', 'HAZEL', 'BUTTER']],
    mix: [['MAP', 'TREE'], ['PEANUT', 'CHEST'], ['LOCK', 'EGG'], ['DOG', 'BUTTER']] },
  { groups: [
    ['y', 'Shades of blue', 'NAVY', 'TEAL', 'COBALT', 'AZURE'],
    ['g', 'Boats', 'CANOE', 'YACHT', 'FERRY', 'LINER'],
    ['b', 'Anagrams of animals', 'LOINS', 'FLOW', 'SHORE', 'SNEAK'],
    ['p', '___wash', 'MOUTH', 'CAR', 'WHITE', 'HOG']],
    mix: [['NAVY', 'LINER'], ['SHORE', 'FERRY'], ['TEAL', 'WHITE'], ['FLOW', 'CAR']] },
  { groups: [
    ['y', 'Pasta', 'PENNE', 'FUSILLI', 'RAVIOLI', 'ORZO'],
    ['g', 'Things you can beat', 'EGGS', 'DRUM', 'RECORD', 'TRAFFIC'],
    ['b', 'Famous bears', 'PADDINGTON', 'BALOO', 'YOGI', 'POOH'],
    ['p', 'Hidden numbers', 'OFTEN', 'CANINE', 'WEIGHT', 'STONE']],
    mix: [['ORZO', 'YOGI'], ['EGGS', 'STONE'], ['DRUM', 'BALOO'], ['RAVIOLI', 'OFTEN']] },
  { groups: [
    ['y', 'Kinds of settlement', 'VILLAGE', 'BOROUGH', 'CITY', 'TOWN'],
    ['g', 'Board games', 'RISK', 'CLUEDO', 'OPERATION', 'MONOPOLY'],
    ['b', '___board', 'SURF', 'KEY', 'CUP', 'SKATE'],
    ['p', 'Shakespeare plays', 'HAMLET', 'OTHELLO', 'MACBETH', 'TEMPEST']],
    mix: [['HAMLET', 'TOWN'], ['OTHELLO', 'RISK'], ['CUP', 'MONOPOLY'], ['SKATE', 'CITY']] },
  { groups: [
    ['y', 'Yellow things', 'BANANA', 'LEMON', 'CUSTARD', 'CANARY'],
    ['g', 'Birds', 'WREN', 'FINCH', 'EAGLE', 'OWL'],
    ['b', 'Fast', 'RAPID', 'QUICK', 'BRISK', 'SWIFT'],
    ['p', 'Batman characters', 'JOKER', 'RIDDLER', 'ROBIN', 'PENGUIN']],
    mix: [['CANARY', 'OWL'], ['SWIFT', 'EAGLE'], ['ROBIN', 'WREN'], ['PENGUIN', 'LEMON']] },
  { groups: [
    ['y', 'Weather', 'HAIL', 'SLEET', 'FOG', 'MIST'],
    ['g', '___storm', 'BRAIN', 'FIRE', 'SAND', 'BARN'],
    ['b', 'Greetings', 'HELLO', 'HOWDY', 'CHEERS', 'ALOHA'],
    ['p', 'NBA teams', 'THUNDER', 'HEAT', 'MAGIC', 'JAZZ']],
    mix: [['HAIL', 'BRAIN'], ['THUNDER', 'MIST'], ['HEAT', 'SLEET'], ['CHEERS', 'FIRE']] },
  { groups: [
    ['y', 'Coffee', 'LATTE', 'MOCHA', 'ESPRESSO', 'AMERICANO'],
    ['g', 'Shades of brown', 'TAN', 'UMBER', 'SEPIA', 'TAUPE'],
    ['b', 'Things with a crown', 'TOOTH', 'HAT', 'TREE', 'KING'],
    ['p', 'Hidden body parts', 'EARTH', 'CHINA', 'SHIPMENT', 'CARMEN']],
    mix: [['MOCHA', 'TAN'], ['TREE', 'SEPIA'], ['EARTH', 'HAT'], ['LATTE', 'CHINA']] },
  { groups: [
    ['y', 'Instruments', 'DRUM', 'HARP', 'FLUTE', 'TUBA'],
    ['g', 'Things with a string', 'KITE', 'YOYO', 'PUPPET', 'BOW'],
    ['b', '___fish', 'SWORD', 'STAR', 'CAT', 'JELLY'],
    ['p', 'Things you pick', 'TEAM', 'LOCK', 'NOSE', 'FIGHT']],
    mix: [['HARP', 'BOW'], ['STAR', 'TEAM'], ['DRUM', 'JELLY'], ['KITE', 'NOSE']] },
  { groups: [
    ['y', 'Fonts', 'ARIAL', 'HELVETICA', 'GARAMOND', 'FUTURA'],
    ['g', 'In space', 'COMET', 'NEBULA', 'QUASAR', 'PULSAR'],
    ['b', 'Car models', 'FIESTA', 'CIVIC', 'BEETLE', 'MINI'],
    ['p', 'Hidden "car"', 'SCARF', 'CARPET', 'OSCAR', 'CARROT']],
    mix: [['FUTURA', 'COMET'], ['MINI', 'OSCAR'], ['CIVIC', 'CARROT'], ['ARIAL', 'NEBULA']] }
];
