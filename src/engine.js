/**
 * replaceableParts Engine
 * A pure functional game engine for manufacturing simulation
 */

// ============================================================================
// PRNG - Mulberry32 (deterministic random number generator)
// ============================================================================

function createRNG(seed) {
  let currentSeed = seed;

  return {
    next() {
      currentSeed |= 0;
      currentSeed = currentSeed + 0x6D2B79F5 | 0;
      let t = Math.imul(currentSeed ^ currentSeed >>> 15, 1 | currentSeed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    },
    getCurrentSeed() {
      return currentSeed;
    }
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function getItemWeight(itemId, rules) {
  const material = rules.materials.find(m => m.id === itemId);
  return material ? material.weight : 1;
}

function getMaxStack(itemId, inventoryCapacity, rules) {
  const weight = getItemWeight(itemId, rules);
  return Math.floor(inventoryCapacity / weight);
}

// ============================================================================
// Grid Placement Utilities
// ============================================================================

function getStructureSize(spaceCost) {
  // spaceCost is always a perfect square (1, 4, 9, 16, etc.)
  return Math.sqrt(spaceCost);
}

function isWithinBounds(x, y, size, width, height) {
  return x >= 0 && y >= 0 && x + size <= width && y + size <= height;
}

function isColliding(x, y, size, placements) {
  // Check if the square from (x,y) to (x+size-1, y+size-1) overlaps any existing placement
  for (const placement of placements) {
    const pSize = placement.size;
    // Check for rectangle overlap
    const noOverlap =
      x + size <= placement.x ||      // New is fully left of existing
      placement.x + pSize <= x ||     // Existing is fully left of new
      y + size <= placement.y ||      // New is fully above existing
      placement.y + pSize <= y;       // Existing is fully above new

    if (!noOverlap) {
      return true; // Collision detected
    }
  }
  return false;
}

function canPlaceAt(state, x, y, size) {
  const { width, height, placements } = state.floorSpace;

  if (!isWithinBounds(x, y, size, width, height)) {
    return { valid: false, error: 'Position out of bounds' };
  }

  if (isColliding(x, y, size, placements)) {
    return { valid: false, error: 'Position collides with existing structure' };
  }

  return { valid: true, error: null };
}

function getNextExpansionChunk(state, rules) {
  const { width, height } = state.floorSpace;
  const { initialWidth, initialChunkSize, costPerCell } = rules.floorSpace;

  // Calculate current chunk size based on completed squares
  // Chunk doubles each time a perfect square is formed
  // Initial: 8x8, target 16x16, then 32x32, then 64x64, etc.
  let chunkSize = initialChunkSize;
  let targetSquare = initialWidth * 2; // First target: 16x16

  // Find the current target square based on completed squares
  while (width >= targetSquare && height >= targetSquare) {
    chunkSize *= 2;
    targetSquare *= 2;
  }

  // Determine expansion direction:
  // 1. Expand width until it reaches targetSquare
  // 2. Then expand height until it reaches targetSquare (forming a square)
  // 3. Repeat with doubled chunk size
  let expandWidth;
  if (width < targetSquare) {
    expandWidth = true;
  } else {
    expandWidth = false;
  }

  // Calculate new dimensions
  let newWidth = width;
  let newHeight = height;

  if (expandWidth) {
    newWidth = width + chunkSize;
  } else {
    newHeight = height + chunkSize;
  }

  const cellsAdded = chunkSize * chunkSize;
  const cost = cellsAdded * costPerCell;

  return {
    chunkSize,
    newWidth,
    newHeight,
    cellsAdded,
    cost,
    expandWidth
  };
}

// ============================================================================
// Energy Calculations
// ============================================================================

function calculateEnergy(state, rules) {
  const produced = state.generators.reduce((sum, g) => sum + g.energyOutput, 0);

  let consumed = 0;

  // Machine consumption only (research is checked separately)
  for (const machine of state.machines) {
    if (machine.enabled && machine.recipeId && machine.status !== 'blocked') {
      consumed += machine.energyConsumption;
    }
  }

  return { produced, consumed };
}

// ============================================================================
// Simulation Logic
// ============================================================================

function simulateTick(state, rules) {
  const newState = deepClone(state);
  const rng = createRNG(state.rngSeed);

  // Track items sold this tick for market recovery
  const soldThisTick = new Set();

  // 1. Energy Calculation
  const energy = calculateEnergy(newState, rules);
  newState.energy = energy;

  // If not enough energy, block machines (starting from last added)
  if (energy.consumed > energy.produced) {
    let deficit = energy.consumed - energy.produced;
    for (let i = newState.machines.length - 1; i >= 0 && deficit > 0; i--) {
      const machine = newState.machines[i];
      // Only block enabled machines that are not already blocked
      if (machine.enabled && machine.recipeId && machine.status !== 'blocked') {
        machine.status = 'blocked';
        deficit -= machine.energyConsumption;
      }
    }
    // Recalculate energy after blocking
    newState.energy = calculateEnergy(newState, rules);
  }

  // 2. Extraction Phase (respecting per-item limit)
  for (const node of newState.extractionNodes) {
    if (node.active) {
      const resourceId = node.resourceType;
      const currentAmount = newState.inventory[resourceId] || 0;
      const maxStack = getMaxStack(resourceId, newState.inventorySpace, rules);
      const spaceLeft = maxStack - currentAmount;
      const toAdd = Math.min(node.rate, spaceLeft);
      if (toAdd > 0) {
        newState.inventory[resourceId] = currentAmount + toAdd;
      }
      // Excess is wasted (not added)
    }
  }

  // 3. Machine Processing
  for (const machine of newState.machines) {
    if (!machine.enabled || !machine.recipeId || machine.status === 'blocked') {
      continue;
    }

    const recipe = rules.recipes.find(r => r.id === machine.recipeId);
    if (!recipe) {
      machine.status = 'idle';
      continue;
    }

    // Check if recipe is unlocked
    if (!newState.unlockedRecipes.includes(recipe.id)) {
      machine.status = 'idle';
      continue;
    }

    machine.status = 'working';

    // Pull Phase: Try to pull needed ingredients from inventory
    let canProgress = true;
    for (const [itemId, needed] of Object.entries(recipe.inputs)) {
      const inBuffer = machine.internalBuffer[itemId] || 0;
      const stillNeeded = needed - inBuffer;

      if (stillNeeded > 0) {
        const available = newState.inventory[itemId] || 0;
        const toPull = Math.min(stillNeeded, available);

        if (toPull > 0) {
          machine.internalBuffer[itemId] = inBuffer + toPull;
          newState.inventory[itemId] -= toPull;
        }

        if (machine.internalBuffer[itemId] < needed) {
          canProgress = false;
        }
      }
    }

    // Completion Check: If buffer matches recipe inputs, produce output
    let bufferComplete = true;
    for (const [itemId, needed] of Object.entries(recipe.inputs)) {
      if ((machine.internalBuffer[itemId] || 0) < needed) {
        bufferComplete = false;
        break;
      }
    }

    if (bufferComplete) {
      // First check if there's space for ALL outputs before consuming inputs
      let canProduce = true;
      for (const [itemId, quantity] of Object.entries(recipe.outputs)) {
        const currentAmount = newState.inventory[itemId] || 0;
        const maxStack = getMaxStack(itemId, newState.inventorySpace, rules);
        const spaceLeft = maxStack - currentAmount;
        if (spaceLeft < quantity) {
          canProduce = false;
          break;
        }
      }

      if (canProduce) {
        // Consume buffer
        for (const [itemId, needed] of Object.entries(recipe.inputs)) {
          machine.internalBuffer[itemId] -= needed;
          if (machine.internalBuffer[itemId] === 0) {
            delete machine.internalBuffer[itemId];
          }
        }

        // Add outputs to inventory
        for (const [itemId, quantity] of Object.entries(recipe.outputs)) {
          const currentAmount = newState.inventory[itemId] || 0;
          newState.inventory[itemId] = currentAmount + quantity;
        }
      }
      // If can't produce, buffer stays intact - machine waits for space
    }
  }

  // 4. Research Phase
  // Research runs if active AND there's enough spare energy after machines
  const spareEnergy = newState.energy.produced - newState.energy.consumed;
  if (newState.research.active && spareEnergy >= rules.research.energyCost) {
    const roll = rng.next();

    // Calculate discovery chance with proximity bonus
    let discoveryChance = rules.research.discoveryChance;

    // Find undiscovered recipes
    const undiscovered = rules.recipes.filter(r => !newState.discoveredRecipes.includes(r.id));

    if (undiscovered.length > 0 && roll < discoveryChance) {
      // Weight recipes by proximity (do we have their input materials?)
      const weighted = undiscovered.map(recipe => {
        let weight = 1;
        for (const itemId of Object.keys(recipe.inputs)) {
          if ((newState.inventory[itemId] || 0) > 0) {
            weight += rules.research.proximityWeight;
          }
        }
        return { recipe, weight };
      });

      // Weighted random selection
      const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
      let selection = rng.next() * totalWeight;

      for (const { recipe, weight } of weighted) {
        selection -= weight;
        if (selection <= 0) {
          newState.discoveredRecipes.push(recipe.id);
          break;
        }
      }
    }
  }

  // 5. Market Recovery (for items not sold this tick)
  for (const itemId of Object.keys(newState.marketPopularity)) {
    if (!soldThisTick.has(itemId)) {
      newState.marketPopularity[itemId] = Math.min(
        rules.market.maxPopularity,
        newState.marketPopularity[itemId] + rules.market.recoveryRate
      );
    }
  }

  // 6. Advance State
  newState.tick += 1;
  newState.rngSeed = rng.getCurrentSeed();

  return newState;
}

// ============================================================================
// Action Handlers
// ============================================================================

function addMachine(state, rules, payload) {
  const newState = deepClone(state);
  const { x, y } = payload;

  // Validate position is provided
  if (typeof x !== 'number' || typeof y !== 'number') {
    return { state: newState, error: 'Position (x, y) is required' };
  }

  const size = getStructureSize(rules.machines.baseSpace);

  // Check if position is valid and not colliding
  const placement = canPlaceAt(newState, x, y, size);
  if (!placement.valid) {
    return { state: newState, error: placement.error };
  }

  // Check if we have the required item in inventory
  const requiredItemId = rules.machines.itemId;
  const available = newState.inventory[requiredItemId] || 0;

  if (available < 1) {
    const material = rules.materials.find(m => m.id === requiredItemId);
    const name = material ? material.name : requiredItemId;
    return { state: newState, error: `Need 1 ${name} in inventory to deploy a machine` };
  }

  // Consume the item from inventory
  newState.inventory[requiredItemId] -= 1;
  if (newState.inventory[requiredItemId] === 0) {
    delete newState.inventory[requiredItemId];
  }

  const machineId = generateId();

  // Add to machines array
  newState.machines.push({
    id: machineId,
    recipeId: null,
    internalBuffer: {},
    status: 'idle',
    enabled: true,
    spaceUsed: rules.machines.baseSpace,
    energyConsumption: rules.machines.baseEnergy,
    x,
    y
  });

  // Add to floor placements
  newState.floorSpace.placements.push({
    id: machineId,
    x,
    y,
    size,
    type: 'machine'
  });

  return { state: newState, error: null };
}

function removeMachine(state, rules, payload) {
  const newState = deepClone(state);
  const { machineId } = payload;

  const machineIndex = newState.machines.findIndex(m => m.id === machineId);
  if (machineIndex === -1) {
    return { state: newState, error: 'Machine not found' };
  }

  const machine = newState.machines[machineIndex];

  // Return items in buffer to inventory
  for (const [itemId, quantity] of Object.entries(machine.internalBuffer)) {
    newState.inventory[itemId] = (newState.inventory[itemId] || 0) + quantity;
  }

  // Remove from machines array
  newState.machines.splice(machineIndex, 1);

  // Remove from floor placements
  const placementIndex = newState.floorSpace.placements.findIndex(p => p.id === machineId);
  if (placementIndex !== -1) {
    newState.floorSpace.placements.splice(placementIndex, 1);
  }

  return { state: newState, error: null };
}

function assignRecipe(state, rules, payload) {
  const newState = deepClone(state);
  const { machineId, recipeId } = payload;

  const machine = newState.machines.find(m => m.id === machineId);
  if (!machine) {
    return { state: newState, error: 'Machine not found' };
  }

  if (recipeId !== null) {
    const recipe = rules.recipes.find(r => r.id === recipeId);
    if (!recipe) {
      return { state: newState, error: 'Recipe not found' };
    }

    if (!newState.unlockedRecipes.includes(recipeId)) {
      return { state: newState, error: 'Recipe not unlocked' };
    }
  }

  // Return items in buffer to inventory when changing recipe
  for (const [itemId, quantity] of Object.entries(machine.internalBuffer)) {
    newState.inventory[itemId] = (newState.inventory[itemId] || 0) + quantity;
  }

  machine.recipeId = recipeId;
  machine.internalBuffer = {};
  machine.status = recipeId ? 'working' : 'idle';

  return { state: newState, error: null };
}

function addGenerator(state, rules, payload) {
  const newState = deepClone(state);
  const { generatorType, x, y } = payload;

  // Validate position is provided
  if (typeof x !== 'number' || typeof y !== 'number') {
    return { state: newState, error: 'Position (x, y) is required' };
  }

  const genConfig = rules.generators.types.find(g => g.id === generatorType);
  if (!genConfig) {
    return { state: newState, error: 'Generator type not found' };
  }

  const size = getStructureSize(genConfig.spaceCost);

  // Check if position is valid and not colliding
  const placement = canPlaceAt(newState, x, y, size);
  if (!placement.valid) {
    return { state: newState, error: placement.error };
  }

  // Check if we have the required item in inventory
  const requiredItemId = genConfig.itemId;
  const available = newState.inventory[requiredItemId] || 0;

  if (available < 1) {
    const material = rules.materials.find(m => m.id === requiredItemId);
    const name = material ? material.name : requiredItemId;
    return { state: newState, error: `Need 1 ${name} in inventory to deploy this generator` };
  }

  // Consume the item from inventory
  newState.inventory[requiredItemId] -= 1;
  if (newState.inventory[requiredItemId] === 0) {
    delete newState.inventory[requiredItemId];
  }

  const generatorId = generateId();

  // Add to generators array
  newState.generators.push({
    id: generatorId,
    type: generatorType,
    energyOutput: genConfig.energyOutput,
    spaceUsed: genConfig.spaceCost,
    x,
    y
  });

  // Add to floor placements
  newState.floorSpace.placements.push({
    id: generatorId,
    x,
    y,
    size,
    type: 'generator'
  });

  // Recalculate energy
  newState.energy = calculateEnergy(newState, rules);

  return { state: newState, error: null };
}

function removeGenerator(state, rules, payload) {
  const newState = deepClone(state);
  const { generatorId } = payload;

  const genIndex = newState.generators.findIndex(g => g.id === generatorId);
  if (genIndex === -1) {
    return { state: newState, error: 'Generator not found' };
  }

  // Remove from generators array
  newState.generators.splice(genIndex, 1);

  // Remove from floor placements
  const placementIndex = newState.floorSpace.placements.findIndex(p => p.id === generatorId);
  if (placementIndex !== -1) {
    newState.floorSpace.placements.splice(placementIndex, 1);
  }

  // Recalculate energy
  newState.energy = calculateEnergy(newState, rules);

  return { state: newState, error: null };
}

function buyFloorSpace(state, rules, payload) {
  const newState = deepClone(state);

  // Get the next expansion chunk based on current grid size
  const expansion = getNextExpansionChunk(newState, rules);

  if (newState.credits < expansion.cost) {
    return { state: newState, error: `Not enough credits (need ${expansion.cost})` };
  }

  newState.credits -= expansion.cost;
  newState.floorSpace.width = expansion.newWidth;
  newState.floorSpace.height = expansion.newHeight;

  return { state: newState, error: null };
}

function sellGoods(state, rules, payload) {
  const newState = deepClone(state);
  const { itemId, quantity } = payload;

  const available = newState.inventory[itemId] || 0;
  if (available < quantity) {
    return { state: newState, error: 'Not enough items in inventory' };
  }

  const material = rules.materials.find(m => m.id === itemId);
  if (!material) {
    return { state: newState, error: 'Item not found in materials list' };
  }

  // Get popularity multiplier (default to 1.0 if not tracked)
  const popularity = newState.marketPopularity[itemId] || 1.0;
  const pricePerUnit = material.basePrice * popularity;
  const totalCredits = Math.floor(pricePerUnit * quantity);

  newState.inventory[itemId] -= quantity;
  if (newState.inventory[itemId] === 0) {
    delete newState.inventory[itemId];
  }

  newState.credits += totalCredits;

  // Apply popularity decay
  if (!newState.marketPopularity[itemId]) {
    newState.marketPopularity[itemId] = rules.market.maxPopularity; // New items start at max
  }
  newState.marketPopularity[itemId] = Math.max(
    rules.market.minPopularity,
    newState.marketPopularity[itemId] - (rules.market.decayRate * quantity)
  );

  return { state: newState, error: null };
}

function toggleResearch(state, rules, payload) {
  const newState = deepClone(state);
  const { active } = payload;

  newState.research.active = active;

  // Recalculate energy
  newState.energy = calculateEnergy(newState, rules);

  return { state: newState, error: null };
}

function unlockRecipe(state, rules, payload) {
  const newState = deepClone(state);
  const { recipeId } = payload;

  if (!newState.discoveredRecipes.includes(recipeId)) {
    return { state: newState, error: 'Recipe not discovered yet' };
  }

  if (newState.unlockedRecipes.includes(recipeId)) {
    return { state: newState, error: 'Recipe already unlocked' };
  }

  newState.unlockedRecipes.push(recipeId);

  return { state: newState, error: null };
}

function unblockMachine(state, rules, payload) {
  const newState = deepClone(state);
  const { machineId } = payload;

  const machine = newState.machines.find(m => m.id === machineId);
  if (!machine) {
    return { state: newState, error: 'Machine not found' };
  }

  if (machine.status !== 'blocked') {
    return { state: newState, error: 'Machine is not blocked' };
  }

  // Set to working if it has a recipe, otherwise idle
  machine.status = machine.recipeId ? 'working' : 'idle';

  // Recalculate energy (this may cause it to be blocked again on next tick if still not enough energy)
  newState.energy = calculateEnergy(newState, rules);

  return { state: newState, error: null };
}

function toggleMachine(state, rules, payload) {
  const newState = deepClone(state);
  const { machineId } = payload;

  const machine = newState.machines.find(m => m.id === machineId);
  if (!machine) {
    return { state: newState, error: 'Machine not found' };
  }

  machine.enabled = !machine.enabled;

  // Recalculate energy
  newState.energy = calculateEnergy(newState, rules);

  return { state: newState, error: null };
}

function buyInventorySpace(state, rules, payload) {
  const newState = deepClone(state);
  const { amount } = payload;

  // Exponential cost: base * (growth ^ currentLevel)
  const currentLevel = Math.floor(newState.inventorySpace / rules.inventorySpace.upgradeAmount);
  const cost = Math.floor(
    rules.inventorySpace.baseCost * Math.pow(rules.inventorySpace.costGrowth, currentLevel)
  );

  if (newState.credits < cost) {
    return { state: newState, error: `Not enough credits (need ${cost})` };
  }

  newState.credits -= cost;
  newState.inventorySpace += rules.inventorySpace.upgradeAmount;

  return { state: newState, error: null };
}

// ============================================================================
// Main Engine Function
// ============================================================================

export function engine(state, rules, action) {
  switch (action.type) {
    case 'SIMULATE':
      return { state: simulateTick(state, rules), error: null };

    case 'ADD_MACHINE':
      return addMachine(state, rules, action.payload || {});

    case 'REMOVE_MACHINE':
      return removeMachine(state, rules, action.payload);

    case 'ASSIGN_RECIPE':
      return assignRecipe(state, rules, action.payload);

    case 'ADD_GENERATOR':
      return addGenerator(state, rules, action.payload);

    case 'REMOVE_GENERATOR':
      return removeGenerator(state, rules, action.payload);

    case 'BUY_FLOOR_SPACE':
      return buyFloorSpace(state, rules, action.payload);

    case 'SELL_GOODS':
      return sellGoods(state, rules, action.payload);

    case 'TOGGLE_RESEARCH':
      return toggleResearch(state, rules, action.payload);

    case 'UNLOCK_RECIPE':
      return unlockRecipe(state, rules, action.payload);

    case 'UNBLOCK_MACHINE':
      return unblockMachine(state, rules, action.payload);

    case 'TOGGLE_MACHINE':
      return toggleMachine(state, rules, action.payload);

    case 'BUY_INVENTORY_SPACE':
      return buyInventorySpace(state, rules, action.payload);

    default:
      return { state, error: `Unknown action type: ${action.type}` };
  }
}

// Export utilities for testing and frontend use
export {
  createRNG,
  calculateEnergy,
  deepClone,
  getItemWeight,
  getMaxStack,
  getStructureSize,
  canPlaceAt,
  getNextExpansionChunk
};
