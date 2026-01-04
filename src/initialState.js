/**
 * Initial Game State
 * Starting configuration with pre-defined extraction nodes and one generator
 */

export const initialState = {
  tick: 0,
  rngSeed: 12345,
  credits: 500,

  // Triad Constraints
  floorSpace: {
    total: 50,
    used: 1  // Starting generator uses 1 space
  },

  energy: {
    produced: 3,  // From starting manual crank
    consumed: 0
  },

  // Inventory space is now total weight capacity
  inventorySpace: 100,

  // Inventory starts empty - will be filled by extraction nodes
  inventory: {},

  // No machines initially (must be manufactured)
  machines: [],

  // Start with one manual crank generator for basic operation
  generators: [
    {
      id: 'starter_crank',
      type: 'manual_crank',
      energyOutput: 3,
      spaceUsed: 1
    }
  ],

  // Pre-defined extraction nodes (active from start)
  extractionNodes: [
    {
      id: 'node_wood_1',
      resourceType: 'wood',
      rate: 2,
      active: true
    },
    {
      id: 'node_stone_1',
      resourceType: 'stone',
      rate: 2,
      active: true
    },
    {
      id: 'node_iron_ore_1',
      resourceType: 'iron_ore',
      rate: 1,
      active: true
    },
    {
      id: 'node_copper_ore_1',
      resourceType: 'copper_ore',
      rate: 1,
      active: true
    },
    {
      id: 'node_coal_1',
      resourceType: 'coal',
      rate: 2,
      active: true
    },
    {
      id: 'node_clay_1',
      resourceType: 'clay',
      rate: 1,
      active: true
    },
    {
      id: 'node_sand_1',
      resourceType: 'sand',
      rate: 1,
      active: true
    }
  ],

  // Start with basic Tier 1 recipes + equipment recipes discovered and unlocked
  discoveredRecipes: [
    // Tier 1
    'planks',
    'charcoal',
    'stone_bricks',
    'gravel',
    'bricks',
    'glass',
    'iron_ingot',
    'copper_ingot',
    // Equipment (so player can build machines and generators from start)
    'production_machine',
    'manual_crank',
    'water_wheel',
    'steam_engine'
  ],

  unlockedRecipes: [
    // Tier 1
    'planks',
    'charcoal',
    'stone_bricks',
    'gravel',
    'bricks',
    'glass',
    'iron_ingot',
    'copper_ingot',
    // Equipment
    'production_machine',
    'manual_crank',
    'water_wheel',
    'steam_engine'
  ],

  // Research starts inactive
  research: {
    active: false,
    energyConsumption: 5
  },

  // Market popularity (empty = all at default 1.0)
  marketPopularity: {}
};

/**
 * Create a fresh copy of the initial state
 * Use this to start a new game
 */
export function createInitialState(customSeed = null) {
  const state = JSON.parse(JSON.stringify(initialState));
  if (customSeed !== null) {
    state.rngSeed = customSeed;
  }
  return state;
}
