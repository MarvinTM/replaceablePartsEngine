import { engine, calculateTotalWeight, getItemWeight } from '../src/engine.js';
import { defaultRules } from '../src/defaultRules.js';
import { createInitialState } from '../src/initialState.js';

// ============================================================================
// Game State
// ============================================================================

let gameState = createInitialState();
const rules = defaultRules;
let autoSimulateInterval = null;
let tickLog = []; // Store log entries for each tick
const MAX_LOG_ENTRIES = 100;

// ============================================================================
// UI Update Functions
// ============================================================================

function showError(message) {
  const errorEl = document.getElementById('error');
  if (message) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    setTimeout(() => {
      errorEl.style.display = 'none';
    }, 3000);
  } else {
    errorEl.style.display = 'none';
  }
}

function dispatch(action) {
  const prevState = gameState;
  const result = engine(gameState, rules, action);
  if (result.error) {
    showError(result.error);
  } else {
    gameState = result.state;

    // Log tick events
    if (action.type === 'SIMULATE') {
      const logEntry = generateTickLog(prevState, gameState);
      tickLog.unshift(logEntry);
      if (tickLog.length > MAX_LOG_ENTRIES) {
        tickLog.pop();
      }
    }

    updateUI();
  }
}

function generateTickLog(prevState, newState) {
  const events = [];
  const tick = newState.tick;

  // Check extraction
  for (const node of newState.extractionNodes) {
    if (node.active) {
      const prevQty = prevState.inventory[node.resourceType] || 0;
      const newQty = newState.inventory[node.resourceType] || 0;
      const extracted = newQty - prevQty;
      const material = rules.materials.find(m => m.id === node.resourceType);
      const name = material ? material.name : node.resourceType;

      if (extracted > 0) {
        events.push(`Extracted ${extracted} ${name}`);
      } else if (prevQty >= newState.inventorySpace) {
        events.push(`${name} storage full (${newState.inventorySpace})`);
      }
    }
  }

  // Check production
  for (const [itemId, qty] of Object.entries(newState.inventory)) {
    const prevQty = prevState.inventory[itemId] || 0;
    const material = rules.materials.find(m => m.id === itemId);
    if (material && material.category !== 'raw') {
      const produced = qty - prevQty;
      if (produced > 0) {
        events.push(`Produced ${produced} ${material.name}`);
      }
    }
  }

  // Check research discoveries
  for (const recipeId of newState.discoveredRecipes) {
    if (!prevState.discoveredRecipes.includes(recipeId)) {
      events.push(`Discovered recipe: ${recipeId.replace(/_/g, ' ')}`);
    }
  }

  // Check blocked machines
  for (const machine of newState.machines) {
    const prevMachine = prevState.machines.find(m => m.id === machine.id);
    if (prevMachine && prevMachine.status !== 'blocked' && machine.status === 'blocked') {
      events.push(`Machine blocked (energy shortage)`);
    }
  }

  return { tick, events, timestamp: new Date().toLocaleTimeString() };
}

function updateUI() {
  updateStats();
  updateInventory();
  updateMachines();
  updateGenerators();
  updateResearch();
  updateExtractionNodes();
  updateSellDropdown();
  updateTickLog();
  updateInventorySpaceButton();
  updateMachineButton();
  populateGeneratorTypes();
}

function updateStats() {
  document.getElementById('tick').textContent = gameState.tick;
  document.getElementById('credits').textContent = gameState.credits;
  document.getElementById('energy').textContent =
    `${gameState.energy.consumed}/${gameState.energy.produced}`;
  document.getElementById('floorSpace').textContent =
    `${gameState.floorSpace.used}/${gameState.floorSpace.total}`;
  const totalWeight = calculateTotalWeight(gameState.inventory, rules);
  document.getElementById('inventorySpace').textContent =
    `${totalWeight}/${gameState.inventorySpace}`;
}

function formatItemRow(itemId, qty) {
  const material = rules.materials.find(m => m.id === itemId);
  const name = material ? material.name : itemId;
  const weight = material ? material.weight : 1;
  const totalItemWeight = weight * qty;
  const popularity = gameState.marketPopularity[itemId] || 1.0;
  const popPercent = Math.round((popularity / rules.market.maxPopularity) * 100);

  return `
    <div class="item-row">
      <span>${name} <span class="item-weight">(w:${weight})</span></span>
      <span>
        ${qty} <span class="item-total-weight">[${totalItemWeight}]</span>
        <span class="popularity-bar">
          <div class="popularity-fill" style="width: ${popPercent}%"></div>
        </span>
      </span>
    </div>
  `;
}

function updateInventory() {
  const container = document.getElementById('inventory');
  const items = Object.entries(gameState.inventory).filter(([, qty]) => qty > 0);

  if (items.length === 0) {
    container.innerHTML = '<em>Empty</em>';
    return;
  }

  // Separate items by category
  const rawItems = [];
  const intermediateItems = [];
  const finalItems = [];
  const equipmentItems = [];

  for (const [itemId, qty] of items) {
    const material = rules.materials.find(m => m.id === itemId);
    if (!material) {
      rawItems.push([itemId, qty]);
    } else if (material.category === 'raw') {
      rawItems.push([itemId, qty]);
    } else if (material.category === 'intermediate') {
      intermediateItems.push([itemId, qty]);
    } else if (material.category === 'final') {
      finalItems.push([itemId, qty]);
    } else if (material.category === 'equipment') {
      equipmentItems.push([itemId, qty]);
    }
  }

  let html = '';

  // Equipment first (machines, generators)
  if (equipmentItems.length > 0) {
    html += '<div class="inventory-section"><div class="section-label">Equipment</div>';
    html += equipmentItems.map(([id, qty]) => formatItemRow(id, qty)).join('');
    html += '</div>';
  }

  // Final goods
  if (finalItems.length > 0) {
    html += '<div class="inventory-section"><div class="section-label">Final Goods</div>';
    html += finalItems.map(([id, qty]) => formatItemRow(id, qty)).join('');
    html += '</div>';
  }

  // Intermediate goods
  if (intermediateItems.length > 0) {
    html += '<div class="inventory-section"><div class="section-label">Intermediate</div>';
    html += intermediateItems.map(([id, qty]) => formatItemRow(id, qty)).join('');
    html += '</div>';
  }

  // Raw materials last
  if (rawItems.length > 0) {
    html += '<div class="inventory-section"><div class="section-label">Raw Materials</div>';
    html += rawItems.map(([id, qty]) => formatItemRow(id, qty)).join('');
    html += '</div>';
  }

  container.innerHTML = html;
}

function formatRecipeRequirements(recipe) {
  if (!recipe) return '';

  const inputs = Object.entries(recipe.inputs).map(([id, qty]) => {
    const material = rules.materials.find(m => m.id === id);
    const name = material ? material.name : id;
    const available = gameState.inventory[id] || 0;
    const hasEnough = available >= qty;
    const colorClass = hasEnough ? 'has-material' : 'needs-material';
    return `<span class="${colorClass}">${qty}x ${name}</span>`;
  }).join(' + ');

  const outputs = Object.entries(recipe.outputs).map(([id, qty]) => {
    const material = rules.materials.find(m => m.id === id);
    const name = material ? material.name : id;
    return `${qty}x ${name}`;
  }).join(', ');

  return `<div class="recipe-requirements">${inputs} → ${outputs}</div>`;
}

function updateMachines() {
  const container = document.getElementById('machines');

  if (gameState.machines.length === 0) {
    container.innerHTML = '<em>No machines</em>';
    return;
  }

  container.innerHTML = gameState.machines.map((machine, index) => {
    const recipe = machine.recipeId
      ? rules.recipes.find(r => r.id === machine.recipeId)
      : null;
    const recipeName = recipe ? recipe.id.replace(/_/g, ' ') : 'None';

    // Build buffer display
    let bufferStr = '';
    if (Object.keys(machine.internalBuffer).length > 0) {
      bufferStr = Object.entries(machine.internalBuffer)
        .map(([id, qty]) => {
          const material = rules.materials.find(m => m.id === id);
          return `${material ? material.name : id}: ${qty}`;
        })
        .join(', ');
    }

    // Recipe options with requirements in tooltip
    const recipeOptions = gameState.unlockedRecipes.map(recipeId => {
      const r = rules.recipes.find(rr => rr.id === recipeId);
      const selected = machine.recipeId === recipeId ? 'selected' : '';
      const inputsStr = Object.entries(r.inputs).map(([id, qty]) => `${qty}x ${id}`).join(' + ');
      const outputsStr = Object.entries(r.outputs).map(([id, qty]) => `${qty}x ${id}`).join(', ');
      return `<option value="${recipeId}" ${selected} title="${inputsStr} → ${outputsStr}">${recipeId.replace(/_/g, ' ')}</option>`;
    }).join('');

    const unblockButton = machine.status === 'blocked'
      ? `<button onclick="window.unblockMachine('${machine.id}')" class="unblock-btn">Unblock</button>`
      : '';

    return `
      <div class="machine-card">
        <div class="machine-header">
          <strong>Machine #${index + 1}</strong>
          <span class="machine-status status-${machine.status}">${machine.status}</span>
          ${unblockButton}
        </div>
        <div>Recipe: ${recipeName}</div>
        ${recipe ? formatRecipeRequirements(recipe) : ''}
        ${bufferStr ? `<div class="buffer-display">Buffer: ${bufferStr}</div>` : ''}
        <div class="machine-controls">
          <select onchange="window.assignRecipe('${machine.id}', this.value)">
            <option value="">-- Select Recipe --</option>
            ${recipeOptions}
          </select>
          <button onclick="window.removeMachine('${machine.id}')">Remove</button>
        </div>
      </div>
    `;
  }).join('');
}

function updateGenerators() {
  const container = document.getElementById('generators');

  if (gameState.generators.length === 0) {
    container.innerHTML = '<em>No generators</em>';
    return;
  }

  container.innerHTML = gameState.generators.map(gen => {
    const genType = rules.generators.types.find(t => t.id === gen.type);
    const name = genType ? genType.name : gen.type;

    return `
      <div class="generator-card">
        <span>${name} (+${gen.energyOutput} energy)</span>
        <button onclick="window.removeGenerator('${gen.id}')">Remove</button>
      </div>
    `;
  }).join('');
}

function updateResearch() {
  const btn = document.getElementById('btnToggleResearch');
  const status = document.getElementById('researchStatus');
  const container = document.getElementById('discoveredRecipes');

  if (gameState.research.active) {
    btn.textContent = 'Disable Research';
    status.textContent = '(Active - using 5 energy)';
  } else {
    btn.textContent = 'Enable Research';
    status.textContent = '(Inactive - costs 5 energy)';
  }

  // Show discovered recipes grouped by status
  const discovered = gameState.discoveredRecipes;
  const unlocked = gameState.unlockedRecipes;

  if (discovered.length === 0) {
    container.innerHTML = '<em>None</em>';
    return;
  }

  container.innerHTML = discovered.map(recipeId => {
    const isUnlocked = unlocked.includes(recipeId);
    const recipe = rules.recipes.find(r => r.id === recipeId);
    const inputs = Object.entries(recipe.inputs).map(([id, qty]) => `${qty}x ${id}`).join(', ');
    const outputs = Object.entries(recipe.outputs).map(([id, qty]) => `${qty}x ${id}`).join(', ');

    if (isUnlocked) {
      return `<div class="recipe-item unlocked">${recipeId.replace(/_/g, ' ')} (unlocked)</div>`;
    } else {
      return `
        <div class="recipe-item discovered">
          ${recipeId.replace(/_/g, ' ')}
          <button onclick="window.unlockRecipe('${recipeId}')" style="margin-left: 10px; padding: 2px 8px; font-size: 0.8rem;">
            Unlock
          </button>
        </div>
      `;
    }
  }).join('');
}

function updateExtractionNodes() {
  const container = document.getElementById('extractionNodes');

  if (gameState.extractionNodes.length === 0) {
    container.innerHTML = '<em>No nodes</em>';
    return;
  }

  container.innerHTML = gameState.extractionNodes.map(node => {
    const material = rules.materials.find(m => m.id === node.resourceType);
    const name = material ? material.name : node.resourceType;

    return `
      <div class="extraction-node">
        <span>${name}</span>
        <span>+${node.rate}/tick</span>
      </div>
    `;
  }).join('');
}

function updateSellDropdown() {
  const select = document.getElementById('sellItem');
  const items = Object.entries(gameState.inventory).filter(([, qty]) => qty > 0);

  select.innerHTML = items.map(([itemId, qty]) => {
    const material = rules.materials.find(m => m.id === itemId);
    const name = material ? material.name : itemId;
    return `<option value="${itemId}">${name} (${qty})</option>`;
  }).join('');
}

function populateGeneratorTypes() {
  const select = document.getElementById('generatorType');
  select.innerHTML = rules.generators.types.map(gen => {
    const material = rules.materials.find(m => m.id === gen.itemId);
    const itemName = material ? material.name : gen.itemId;
    const available = gameState.inventory[gen.itemId] || 0;
    return `<option value="${gen.id}">${gen.name} (+${gen.energyOutput}E) - needs ${itemName} (have: ${available})</option>`;
  }).join('');
}

function updateMachineButton() {
  const btn = document.getElementById('btnAddMachine');
  if (!btn) return;

  const requiredItemId = rules.machines.itemId;
  const material = rules.materials.find(m => m.id === requiredItemId);
  const itemName = material ? material.name : requiredItemId;
  const available = gameState.inventory[requiredItemId] || 0;

  btn.textContent = `Deploy Machine (need ${itemName}, have: ${available})`;
  btn.disabled = available < 1;
}

function updateTickLog() {
  const container = document.getElementById('tickLog');
  if (!container) return;

  if (tickLog.length === 0) {
    container.innerHTML = '<em>No events yet</em>';
    return;
  }

  container.innerHTML = tickLog.slice(0, 20).map(entry => {
    if (entry.events.length === 0) {
      return `<div class="log-entry"><span class="log-tick">Tick ${entry.tick}</span> <span class="log-time">${entry.timestamp}</span><div class="log-events">No notable events</div></div>`;
    }
    return `
      <div class="log-entry">
        <span class="log-tick">Tick ${entry.tick}</span>
        <span class="log-time">${entry.timestamp}</span>
        <div class="log-events">${entry.events.map(e => `<div>• ${e}</div>`).join('')}</div>
      </div>
    `;
  }).join('');
}

function updateInventorySpaceButton() {
  const btn = document.getElementById('btnBuyInventorySpace');
  if (!btn) return;

  const currentLevel = Math.floor(gameState.inventorySpace / rules.inventorySpace.upgradeAmount);
  const cost = Math.floor(
    rules.inventorySpace.baseCost * Math.pow(rules.inventorySpace.costGrowth, currentLevel)
  );
  btn.textContent = `Expand Storage +${rules.inventorySpace.upgradeAmount} (${cost} cr)`;
}

// ============================================================================
// Global Action Functions (called from HTML)
// ============================================================================

window.assignRecipe = function(machineId, recipeId) {
  dispatch({
    type: 'ASSIGN_RECIPE',
    payload: { machineId, recipeId: recipeId || null }
  });
};

window.removeMachine = function(machineId) {
  dispatch({
    type: 'REMOVE_MACHINE',
    payload: { machineId }
  });
};

window.removeGenerator = function(generatorId) {
  dispatch({
    type: 'REMOVE_GENERATOR',
    payload: { generatorId }
  });
};

window.unlockRecipe = function(recipeId) {
  dispatch({
    type: 'UNLOCK_RECIPE',
    payload: { recipeId }
  });
};

window.unblockMachine = function(machineId) {
  dispatch({
    type: 'UNBLOCK_MACHINE',
    payload: { machineId }
  });
};

// ============================================================================
// Event Listeners
// ============================================================================

document.getElementById('btnSimulate').addEventListener('click', () => {
  dispatch({ type: 'SIMULATE' });
});

document.getElementById('btnSimulate10').addEventListener('click', () => {
  for (let i = 0; i < 10; i++) {
    dispatch({ type: 'SIMULATE' });
  }
});

document.getElementById('btnReset').addEventListener('click', () => {
  gameState = createInitialState();
  tickLog = [];
  updateUI();
});

document.getElementById('btnAddMachine').addEventListener('click', () => {
  dispatch({ type: 'ADD_MACHINE', payload: {} });
});

document.getElementById('btnAddGenerator').addEventListener('click', () => {
  const generatorType = document.getElementById('generatorType').value;
  dispatch({ type: 'ADD_GENERATOR', payload: { generatorType } });
});

document.getElementById('btnToggleResearch').addEventListener('click', () => {
  dispatch({
    type: 'TOGGLE_RESEARCH',
    payload: { active: !gameState.research.active }
  });
});

document.getElementById('btnSell').addEventListener('click', () => {
  const itemId = document.getElementById('sellItem').value;
  if (itemId) {
    dispatch({ type: 'SELL_GOODS', payload: { itemId, quantity: 1 } });
  }
});

document.getElementById('btnSellAll').addEventListener('click', () => {
  const itemId = document.getElementById('sellItem').value;
  const qty = gameState.inventory[itemId] || 0;
  if (itemId && qty > 0) {
    dispatch({ type: 'SELL_GOODS', payload: { itemId, quantity: qty } });
  }
});

document.getElementById('btnBuySpace10').addEventListener('click', () => {
  dispatch({ type: 'BUY_FLOOR_SPACE', payload: { amount: 10 } });
});

document.getElementById('btnBuySpace50').addEventListener('click', () => {
  dispatch({ type: 'BUY_FLOOR_SPACE', payload: { amount: 50 } });
});

document.getElementById('btnBuyInventorySpace').addEventListener('click', () => {
  dispatch({ type: 'BUY_INVENTORY_SPACE', payload: {} });
});

document.getElementById('autoSimulate').addEventListener('change', (e) => {
  if (e.target.checked) {
    const speed = parseInt(document.getElementById('autoSpeed').value);
    autoSimulateInterval = setInterval(() => {
      dispatch({ type: 'SIMULATE' });
    }, speed);
  } else {
    clearInterval(autoSimulateInterval);
    autoSimulateInterval = null;
  }
});

document.getElementById('autoSpeed').addEventListener('change', (e) => {
  if (document.getElementById('autoSimulate').checked) {
    clearInterval(autoSimulateInterval);
    const speed = parseInt(e.target.value);
    autoSimulateInterval = setInterval(() => {
      dispatch({ type: 'SIMULATE' });
    }, speed);
  }
});

// ============================================================================
// Initialize
// ============================================================================

populateGeneratorTypes();
updateUI();
console.log('Replaceable Parts Engine initialized');
console.log('Initial state:', gameState);
console.log('Rules:', rules);
