// What you (the rider) say in a bubble over the moto: when you eat or drink, after a crash, and when a
// speed camera ("Maria") takes your photo. Funny, with Kigali words. No Phaser here.
// An entry is one line, or a list of lines that show one after the other.
//
// Words (a guess; to check with Alp): umuneke = a ripe banana (imineke: more than one); Inyambo = the
// long-horn cows of the old kings; gira inka = "may you have cows" (a good wish); muvandimwe = brother;
// akabanga = the Rwandan chili oil; nta kibazo = no problem; Mana yanjye = my God; afande = what you call a
// police officer; kabisa = totally; Rebero = a high hill in Kigali. "God spends the day in other
// countries, but he sleeps in Rwanda": an old Rwandan saying.

export const RIDER_LINES = {
  bananas: [
    'UMUNEKE! RWANDAN FUEL, KABISA!',
    'ONE BANANA, TWO MORE HILLS!',
    'BANANA POWER! VROOM VROOM!',
    'A MOTARI LIVES ON BANANAS AND HOPE.',
    ['THREE IMINEKE FOR 200?', 'THE BEST DEAL IN KIGALI!'],
  ],
  ikivuguto: [
    ['GLUG GLUG GLUG... AAAH!', 'NOW I AM STRONG LIKE AN INYAMBO!'],
    ['AAAH! THICK AND COLD!', 'NOW I CAN CLIMB REBERO!'],
    'GIRA INKA, MUVANDIMWE!',
    'IKIVUGUTO! MY GRANDMOTHER IS PROUD.',
    ['A MILK MOUSTACHE...', 'VERY SERIOUS. VERY HANDSOME.'],
  ],
  buffet: [
    ['ONE PLATE ONLY?', 'NO PROBLEM. I BUILD A MOUNTAIN!'],
    'RICE, BEANS, MATOKE... MORE BEANS!',
    'AKABANGA ON EVERYTHING!',
    'NOW I CAN RIDE UNTIL MIDNIGHT!',
  ],
  drink: [
    'WOOO! MY EYES ARE WIDE OPEN!',
    'ZOOM ZOOM ZOOM... ZOOM?',
    'I CAN HEAR COLOURS NOW.',
  ],
  crash: [
    'NTA KIBAZO! NTA KIBAZO!',
    'I MEANT TO DO THAT.',
    'THE ROAD MOVED!',
    'MANA YANJYE! MY MOTO!',
    'WHO PUT THAT THERE?!',
    'MY HELMET SAYS MURAKOZE.',
    'GRAVITY 1, MOTARI 0.',
    'A MOTARI NEVER DIES. HE RESTS.',
    ['GOD SLEEPS IN RWANDA...', 'AND TODAY HE WAKES UP FOR ME!'],
    'BUHORO BUHORO... NOW I UNDERSTAND.',
  ],
  slip: ['RED SOAP! RED SOAP!', 'MURRAM 1, MOTARI 0.', 'AYA! MURRAM, WHY?!'],
  officer: ['SORRY, AFANDE! SORRY!', 'AFANDE, I CAN EXPLAIN...'],
  camera: ['MARIA! WHY, MARIA?', 'MARIA TOOK MY PHOTO AGAIN...', 'NO SMILE, MARIA? NO DISCOUNT?', 'MARIA, YOU DO NOT LOVE ME.'],
};

/** A bag for each kind of line, so that a line does not come again before the others (see nextLines). */
export function createLineBags() {
  return {};
}

/** The next entry of a kind as a list of lines (the bag is shuffled, then used to the end). */
export function nextLines(bags, kind, rng = Math.random) {
  const all = RIDER_LINES[kind];
  if (!all?.length) return [];
  let bag = bags[kind];
  if (!bag?.length) {
    bag = bags[kind] = all.map((_, i) => i);
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }
  const entry = all[bag.pop()];
  return Array.isArray(entry) ? entry : [entry];
}
