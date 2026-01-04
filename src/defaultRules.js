/**
 * Default Rules Configuration
 * Classic manufacturing theme with weight-based inventory
 */

export const defaultRules = {
  // ============================================================================
  // Materials (with weight - raw=1, intermediate=2-4, final=5-10, equipment=15-30)
  // ============================================================================
  materials: [
    // Raw materials (from extraction nodes) - weight: 1
    { id: 'wood', name: 'Wood', basePrice: 2, category: 'raw', weight: 1 },
    { id: 'stone', name: 'Stone', basePrice: 2, category: 'raw', weight: 1 },
    { id: 'iron_ore', name: 'Iron Ore', basePrice: 3, category: 'raw', weight: 1 },
    { id: 'copper_ore', name: 'Copper Ore', basePrice: 3, category: 'raw', weight: 1 },
    { id: 'coal', name: 'Coal', basePrice: 2, category: 'raw', weight: 1 },
    { id: 'clay', name: 'Clay', basePrice: 2, category: 'raw', weight: 1 },
    { id: 'sand', name: 'Sand', basePrice: 1, category: 'raw', weight: 1 },

    // Intermediate products - weight: 2-4
    { id: 'planks', name: 'Planks', basePrice: 5, category: 'intermediate', weight: 2 },
    { id: 'charcoal', name: 'Charcoal', basePrice: 4, category: 'intermediate', weight: 1 },
    { id: 'stone_bricks', name: 'Stone Bricks', basePrice: 6, category: 'intermediate', weight: 3 },
    { id: 'gravel', name: 'Gravel', basePrice: 3, category: 'intermediate', weight: 1 },
    { id: 'iron_ingot', name: 'Iron Ingot', basePrice: 10, category: 'intermediate', weight: 3 },
    { id: 'copper_ingot', name: 'Copper Ingot', basePrice: 10, category: 'intermediate', weight: 3 },
    { id: 'bricks', name: 'Bricks', basePrice: 8, category: 'intermediate', weight: 3 },
    { id: 'glass', name: 'Glass', basePrice: 7, category: 'intermediate', weight: 2 },
    { id: 'iron_plate', name: 'Iron Plate', basePrice: 15, category: 'intermediate', weight: 4 },
    { id: 'iron_rod', name: 'Iron Rod', basePrice: 12, category: 'intermediate', weight: 2 },
    { id: 'iron_gear', name: 'Iron Gear', basePrice: 20, category: 'intermediate', weight: 3 },
    { id: 'copper_wire', name: 'Copper Wire', basePrice: 14, category: 'intermediate', weight: 1 },
    { id: 'copper_plate', name: 'Copper Plate', basePrice: 15, category: 'intermediate', weight: 4 },
    { id: 'wooden_beam', name: 'Wooden Beam', basePrice: 8, category: 'intermediate', weight: 3 },
    { id: 'wooden_crate', name: 'Wooden Crate', basePrice: 12, category: 'intermediate', weight: 4 },

    // Final goods - weight: 5-10
    { id: 'tool_handle', name: 'Tool Handle', basePrice: 25, category: 'final', weight: 5 },
    { id: 'basic_tools', name: 'Basic Tools', basePrice: 45, category: 'final', weight: 6 },
    { id: 'simple_motor', name: 'Simple Motor', basePrice: 40, category: 'final', weight: 8 },
    { id: 'window_frame', name: 'Window Frame', basePrice: 30, category: 'final', weight: 6 },
    { id: 'foundation_block', name: 'Foundation Block', basePrice: 35, category: 'final', weight: 10 },
    { id: 'reinforced_wall', name: 'Reinforced Wall', basePrice: 40, category: 'final', weight: 10 },
    { id: 'mechanical_arm', name: 'Mechanical Arm', basePrice: 80, category: 'final', weight: 12 },

    // Equipment (machines and generators as craftable items) - weight: 15-30
    { id: 'production_machine', name: 'Production Machine', basePrice: 100, category: 'equipment', weight: 20 },
    { id: 'manual_crank', name: 'Manual Crank', basePrice: 30, category: 'equipment', weight: 8 },
    { id: 'water_wheel', name: 'Water Wheel', basePrice: 80, category: 'equipment', weight: 15 },
    { id: 'steam_engine', name: 'Steam Engine', basePrice: 150, category: 'equipment', weight: 25 },
  ],

  // ============================================================================
  // Recipes
  // ============================================================================
  recipes: [
    // Tier 1: Raw to basic intermediate (8 recipes)
    {
      id: 'planks',
      inputs: { wood: 2 },
      outputs: { planks: 1 },
      energyRequired: 1,
      ticksToComplete: 1,
      tier: 1
    },
    {
      id: 'charcoal',
      inputs: { wood: 3 },
      outputs: { charcoal: 2 },
      energyRequired: 2,
      ticksToComplete: 1,
      tier: 1
    },
    {
      id: 'stone_bricks',
      inputs: { stone: 2 },
      outputs: { stone_bricks: 1 },
      energyRequired: 1,
      ticksToComplete: 1,
      tier: 1
    },
    {
      id: 'gravel',
      inputs: { stone: 1 },
      outputs: { gravel: 2 },
      energyRequired: 1,
      ticksToComplete: 1,
      tier: 1
    },
    {
      id: 'bricks',
      inputs: { clay: 2 },
      outputs: { bricks: 1 },
      energyRequired: 2,
      ticksToComplete: 1,
      tier: 1
    },
    {
      id: 'glass',
      inputs: { sand: 2 },
      outputs: { glass: 1 },
      energyRequired: 3,
      ticksToComplete: 1,
      tier: 1
    },
    {
      id: 'iron_ingot',
      inputs: { iron_ore: 2, coal: 1 },
      outputs: { iron_ingot: 1 },
      energyRequired: 3,
      ticksToComplete: 1,
      tier: 1
    },
    {
      id: 'copper_ingot',
      inputs: { copper_ore: 2, coal: 1 },
      outputs: { copper_ingot: 1 },
      energyRequired: 3,
      ticksToComplete: 1,
      tier: 1
    },

    // Tier 2: Intermediate processing (9 recipes)
    {
      id: 'iron_plate',
      inputs: { iron_ingot: 1 },
      outputs: { iron_plate: 1 },
      energyRequired: 2,
      ticksToComplete: 1,
      tier: 2
    },
    {
      id: 'iron_rod',
      inputs: { iron_ingot: 1 },
      outputs: { iron_rod: 2 },
      energyRequired: 2,
      ticksToComplete: 1,
      tier: 2
    },
    {
      id: 'iron_gear',
      inputs: { iron_ingot: 2 },
      outputs: { iron_gear: 1 },
      energyRequired: 3,
      ticksToComplete: 1,
      tier: 2
    },
    {
      id: 'copper_wire',
      inputs: { copper_ingot: 1 },
      outputs: { copper_wire: 3 },
      energyRequired: 2,
      ticksToComplete: 1,
      tier: 2
    },
    {
      id: 'copper_plate',
      inputs: { copper_ingot: 1 },
      outputs: { copper_plate: 1 },
      energyRequired: 2,
      ticksToComplete: 1,
      tier: 2
    },
    {
      id: 'wooden_beam',
      inputs: { planks: 2 },
      outputs: { wooden_beam: 1 },
      energyRequired: 1,
      ticksToComplete: 1,
      tier: 2
    },
    {
      id: 'wooden_crate',
      inputs: { planks: 4 },
      outputs: { wooden_crate: 1 },
      energyRequired: 2,
      ticksToComplete: 1,
      tier: 2
    },
    {
      id: 'iron_ingot_charcoal',
      inputs: { iron_ore: 2, charcoal: 1 },
      outputs: { iron_ingot: 1 },
      energyRequired: 2,
      ticksToComplete: 1,
      tier: 2
    },
    {
      id: 'copper_ingot_charcoal',
      inputs: { copper_ore: 2, charcoal: 1 },
      outputs: { copper_ingot: 1 },
      energyRequired: 2,
      ticksToComplete: 1,
      tier: 2
    },

    // Tier 3: Final goods (7 recipes)
    {
      id: 'tool_handle',
      inputs: { wooden_beam: 1, iron_rod: 1 },
      outputs: { tool_handle: 1 },
      energyRequired: 2,
      ticksToComplete: 1,
      tier: 3
    },
    {
      id: 'basic_tools',
      inputs: { tool_handle: 1, iron_plate: 2 },
      outputs: { basic_tools: 1 },
      energyRequired: 3,
      ticksToComplete: 1,
      tier: 3
    },
    {
      id: 'simple_motor',
      inputs: { copper_wire: 3, iron_plate: 1, iron_gear: 1 },
      outputs: { simple_motor: 1 },
      energyRequired: 4,
      ticksToComplete: 1,
      tier: 3
    },
    {
      id: 'window_frame',
      inputs: { glass: 2, wooden_beam: 1 },
      outputs: { window_frame: 1 },
      energyRequired: 2,
      ticksToComplete: 1,
      tier: 3
    },
    {
      id: 'foundation_block',
      inputs: { stone_bricks: 2, wooden_beam: 1 },
      outputs: { foundation_block: 1 },
      energyRequired: 3,
      ticksToComplete: 1,
      tier: 3
    },
    {
      id: 'reinforced_wall',
      inputs: { bricks: 2, iron_rod: 2 },
      outputs: { reinforced_wall: 1 },
      energyRequired: 3,
      ticksToComplete: 1,
      tier: 3
    },
    {
      id: 'mechanical_arm',
      inputs: { simple_motor: 1, iron_gear: 2, iron_plate: 1 },
      outputs: { mechanical_arm: 1 },
      energyRequired: 5,
      ticksToComplete: 2,
      tier: 3
    },

    // Tier 4: Equipment recipes (machines and generators)
    {
      id: 'production_machine',
      inputs: { iron_plate: 4, iron_gear: 3, wooden_beam: 2 },
      outputs: { production_machine: 1 },
      energyRequired: 6,
      ticksToComplete: 2,
      tier: 4
    },
    {
      id: 'manual_crank',
      inputs: { wood: 5, iron_rod: 2 },
      outputs: { manual_crank: 1 },
      energyRequired: 2,
      ticksToComplete: 1,
      tier: 4
    },
    {
      id: 'water_wheel',
      inputs: { wooden_beam: 4, iron_gear: 2, iron_rod: 3 },
      outputs: { water_wheel: 1 },
      energyRequired: 4,
      ticksToComplete: 2,
      tier: 4
    },
    {
      id: 'steam_engine',
      inputs: { iron_plate: 6, copper_plate: 3, iron_gear: 4, simple_motor: 1 },
      outputs: { steam_engine: 1 },
      energyRequired: 8,
      ticksToComplete: 3,
      tier: 4
    },
  ],

  // ============================================================================
  // Market Dynamics
  // ============================================================================
  market: {
    noveltyBonus: 2.0,       // New products sell at 200%
    decayRate: 0.05,         // 5% popularity drop per item sold
    recoveryRate: 0.02,      // 2% recovery per tick when not sold
    minPopularity: 0.5,      // Minimum 50% price
    maxPopularity: 2.0       // Maximum 200% price
  },

  // ============================================================================
  // Research Configuration
  // ============================================================================
  research: {
    energyCost: 3,           // Energy consumed per tick
    discoveryChance: 0.15,   // 15% chance per tick
    proximityWeight: 0.5     // +50% weight per matching inventory item
  },

  // ============================================================================
  // Machine Configuration (deployed from inventory)
  // ============================================================================
  machines: {
    itemId: 'production_machine',  // Item required to deploy a machine
    baseSpace: 4,                  // Floor space units per machine
    baseEnergy: 2                  // Energy consumption per tick
  },

  // ============================================================================
  // Generator Types (deployed from inventory)
  // ============================================================================
  generators: {
    types: [
      {
        id: 'manual_crank',
        itemId: 'manual_crank',    // Item required to deploy
        name: 'Manual Crank',
        energyOutput: 3,
        spaceCost: 1
      },
      {
        id: 'water_wheel',
        itemId: 'water_wheel',
        name: 'Water Wheel',
        energyOutput: 8,
        spaceCost: 4
      },
      {
        id: 'steam_engine',
        itemId: 'steam_engine',
        name: 'Steam Engine',
        energyOutput: 15,
        spaceCost: 6
      }
    ]
  },

  // ============================================================================
  // Floor Space
  // ============================================================================
  floorSpace: {
    costPerUnit: 10          // Credits per floor space unit
  },

  // ============================================================================
  // Inventory Space (total weight capacity)
  // ============================================================================
  inventorySpace: {
    baseCost: 50,            // Base cost for first upgrade
    costGrowth: 1.5,         // Exponential growth factor
    upgradeAmount: 50        // How much weight capacity each upgrade adds
  }
};
