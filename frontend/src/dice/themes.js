// Visual + material settings for each kind of die.
export const THEMES = {
  d6: {
    body: '#b0111d',
    ink: '#ebe5d8',
    glow: '#ff3b3b',
    pips: true,
    roughness: 0.18,
    clearcoat: 1,
  },
  d8: {
    body: '#0b6b63',
    ink: '#f5d77a',
    inkMetal: true,
    glow: '#2dd4bf',
    roughness: 0.22,
    clearcoat: 1,
  },
  d10: {
    body: '#c2410c',
    ink: '#fff4e0',
    glow: '#fb923c',
    roughness: 0.2,
    clearcoat: 1,
  },
  d12: {
    body: '#4c1d95',
    ink: '#f5d77a',
    inkMetal: true,
    glow: '#a78bfa',
    roughness: 0.2,
    clearcoat: 1,
  },
  d20: {
    body: '#0d1220',
    ink: '#f2c94c',
    inkMetal: true,
    glow: '#60a5fa',
    roughness: 0.25,
    clearcoat: 1,
  },
  nuke: {
    body: '#22b51c',
    ink: '#06140a',
    glow: '#39ff14',
    emissive: 0.22,
    roughness: 0.35,
    clearcoat: 0.6,
  },
  custom: {
    body: '#d4a537',
    ink: '#1b1205',
    bodyMetal: true,
    glow: '#fcd34d',
    roughness: 0.28,
    clearcoat: 0.8,
  },
};

export const themeForSides = (sides) => {
  if (sides === 500) return 'nuke';
  return (
    { 6: 'd6', 8: 'd8', 10: 'd10', 12: 'd12', 20: 'd20' }[sides] ?? 'custom'
  );
};
