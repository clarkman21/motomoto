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

export const TEST_MAP = {
  name: 'Test hills',
  // Start position in tiles (centre of the west road) and heading in degrees (0 = +x, screen down right; -90 = -y, screen up right).
  start: { x: 3, y: 26.5, headingDeg: -90 },
  rows: [
    '........................................',
    '........................................',
    '..##########o####o####################..',
    '..###########o########################..',
    '..##...............mm...............##..',
    '..##..t..t.....t...mm.....mmmmmmmmm.##..',
    '..##........t......mm..t..m22m33m22.##..',
    '..##...............mm.....m22m33m22.##..',
    '..##cccccccccccccccmm.....mmmmmmmmm.##..',
    '..##cccccccccccccccmm.....mmmmmmmmm.##..',
    '..o#...............mm...t.m33m22m44.##..',
    '..##..........t....mm.....m33m22m44.##..',
    '..##..t...t........mm.....mmmmmmmmm.##..',
    '..##...............mm...............##..',
    '..#o..........ccccc##ccccc..........##..',
    '..##...t......c66cc##c55cc....t.....==..',
    '..##........t.c66cc##c55cc..........##..',
    '..##..........ccccc##ccccc..t....t..##..',
    '..##..........ccccc##ccccc..........##..',
    '..#####o##############################..',
    '..#########o##########################..',
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
    '..##.....##...t....ww........t...t..##..',
    '..##..t..##.....t..ww...............##..',
    '..##.....##........ww...t...........##..',
    '..########=######################=####..',
    '..########=######################=####..',
    '........................................',
    '........................................',
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
