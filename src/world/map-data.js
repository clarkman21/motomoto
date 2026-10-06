// Test map for milestone 1 ("Ride feel"). It is not a real Kigali district.
// It has hills, gentle and steep ramps, all surfaces, potholes, speed bumps,
// a roundabout and buildings, so you can feel each mechanic.
//
// Edit the ASCII below to change the map. One character is one 4 m tile.
// x goes right along a row, y goes down the rows.
//
// Legend
//   .  grass verge            #  tarmac
//   c  cobblestone            m  murram, dry
//   w  murram, wet            o  pothole (on tarmac)
//   =  speed bump (on tarmac) t  tree (solid)
//   M  roundabout monument    2-9  building, height in levels (solid)
//   F  fuel station (solid)   S  Ampersand swap station (solid)

export const TEST_MAP = {
  name: 'Test hills',
  // Start position in tiles (centre of the west road) and heading in degrees (0 = +x, screen down right; -90 = -y, screen up right).
  start: { x: 3, y: 26.5, headingDeg: -90 },
  rows: [
    '........................................',
    '........................................',
    '..##########o####o#########=######=###..',
    '..###########o#############=######=###..',
    '..##...............mm...............##..',
    '..##..t..t.....t...mm.....mmmmmmmmm.##..',
    '..##........t......mm..t..m22m33m22.##..',
    '..##...............mm.....m22m33m22.##..',
    '..##cccccccccccccccmm.....mmmmmmmmm.##..',
    '..##cccccccccccccccmm.....mmmmmmmmm.##..',
    '..o#...............mm...t.m33m22m44.##..',
    '..##FF........t....mm.....m33m22m44.##..',
    '..##..t...t........mm.....mmmmmmmmm.##..',
    '..##...............mm.............SS##..',
    '..#o..........ccccc##ccccc..........##..',
    '..##...t......c66cc##c55cc....t.....==..',
    '..##........t.c66cc##c55cc..........##..',
    '..##..........ccccc==ccccc..t....t..##..',
    '..##..........ccccc##ccccc..........##..',
    '..#####o###############=##############..',
    '..#########o###########=##############..',
    '..##.....##...ccccc##ccccc..........##..',
    '..##.....##...c44cc##c77cc..wwwwwww.##..',
    '..o#.....##...c44cc##c77cc..wwwwwww.##..',
    '..##.t...##...ccccc##ccccc..wwwwwww.##..',
    '..##.....##...ccccc##ccccc..wwwwwwww##..',
    '..##.....##...t....ww.......wwwwwwww##..',
    '..##...######......ww.......wwwwwww.##..',
    '..##...##..##......ww.......wwwwwww.##..',
    '..######.MM.##mmmmmww..t....wwwwwww.##..',
    '..######.MM.##mmmmmww...............##..',
    '..##...##..##......ww...............##..',
    '..##...######......ww....t..........##..',
    '..##.....==...t....ww........t...t..##..',
    '..##..t..##.....t..ww...............##..',
    '..##.....##........ww...t...........##..',
    '..########=######################=####..',
    '..########=######################=####..',
    '........................................',
    '........................................',
  ],
  // Places for jobs and stations, in tiles (x, y = a point on the road). Cargo jobs start at 'market' places.
  places: [
    { id: 'market', name: 'Market', x: 29.5, y: 8.5, tags: ['market'] },
    { id: 'marketGate', name: 'Market gate', x: 30.5, y: 3, tags: ['market'] },
    { id: 'square', name: 'City square', x: 17.5, y: 17.5, tags: [] },
    { id: 'offices', name: 'City offices', x: 24.5, y: 24.5, tags: [] },
    { id: 'roundabout', name: 'Roundabout', x: 12.5, y: 30, tags: [] },
    { id: 'cobbleLane', name: 'Cobble lane', x: 10.5, y: 9, tags: [] },
    { id: 'wetYard', name: 'Wet yard', x: 31.5, y: 25.5, tags: [] },
    { id: 'southRoad', name: 'South road', x: 16.5, y: 37, tags: [] },
    { id: 'westRoad', name: 'West road', x: 3, y: 6.5, tags: [] },
    { id: 'eastHill', name: 'East hill road', x: 33.5, y: 20, tags: [] },
    { id: 'fuel', name: 'Fuel station', x: 3, y: 11.5, tags: ['fuel'] },
    { id: 'swap', name: 'Ampersand swap station', x: 37, y: 13.5, tags: ['swap'] },
  ],
  // Speed limit zones (tiles, x0 <= x < x1). Outside a zone, LAW.defaultLimitKmh applies.
  zones: [
    { name: 'Market', x0: 24, y0: 2, x1: 38, y1: 14, limitKmh: 30 },
    { name: 'City centre', x0: 13, y0: 13, x1: 27, y1: 27, limitKmh: 40 },
    { name: 'East ramp', x0: 27, y0: 17, x1: 36, y1: 22, limitKmh: 40 },
    { name: 'Roundabout', x0: 4, y0: 23, x1: 17, y1: 36, limitKmh: 40 },
  ],
  // Speed cameras (tiles). Each one stands beside a road.
  cameras: [
    { x: 31, y: 1.8 }, // north road, market zone (30)
    { x: 30, y: 21.2 }, // bottom of the steep east ramp (40)
    { x: 4.2, y: 32 }, // west road, open road (60)
    { x: 21.2, y: 16 }, // city centre (40)
  ],
  // Speed limit signs (tiles) at zone entries.
  signs: [
    { x: 23.8, y: 1.8, limitKmh: 30 },
    { x: 38.2, y: 14.4, limitKmh: 30 },
    { x: 13.2, y: 18.6, limitKmh: 40 },
    { x: 18.6, y: 12.8, limitKmh: 40 },
    { x: 21.4, y: 27.2, limitKmh: 40 },
    { x: 35.8, y: 18.6, limitKmh: 40 },
    { x: 6.6, y: 28.6, limitKmh: 40 },
    { x: 11.4, y: 35.4, limitKmh: 40 },
  ],
  // Hills are plateaus with ramps. Heights are in levels (1 level = WORLD.levelMetres).
  // x0..x1 and y0..y1 are the plateau edges in tile corners (vertices).
  // run = tiles of ramp per level on each side. 1 = steep (37% grade), 2 = gentle (19%).
  hills: [
    {
      name: 'Central plateau',
      x0: 14, y0: 14, x1: 26, y1: 26,
      level: 4,
      run: { west: 2, east: 1, north: 1.5, south: 2 },
    },
    {
      name: 'South road hump',
      x0: 23, y0: 33, x1: 27, y1: 40,
      level: 2,
      run: { west: 2, east: 2, north: 1, south: 1 },
    },
  ],
};
