import { engine, getItemWeight, getMaxStack, getStructureSize, canPlaceAt, getNextExpansionChunk } from '../src/engine.js';
import { defaultRules } from '../src/defaultRules.js';
import { createInitialState } from '../src/initialState.js';

// ============================================================================
// Placement Mode State
// ============================================================================

let placementMode = null; // null or { type: 'machine' } or { type: 'generator', generatorType: 'manual_crank' }

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
      } else if (node.rate > 0 && extracted === 0) {
        const maxStack = getMaxStack(node.resourceType, newState.inventorySpace, rules);
        if (prevQty >= maxStack) {
          events.push(`${name} storage full (${maxStack} max)`);
        }
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
  updatePlacementTypeDropdown();
  updatePlacementStatus();
  renderFactoryGrid();
  updateExpansionInfo();
}

function updateStats() {
  document.getElementById('tick').textContent = gameState.tick;
  document.getElementById('credits').textContent = gameState.credits;
  document.getElementById('energy').textContent =
    `${gameState.energy.consumed}/${gameState.energy.produced}`;
  document.getElementById('floorSpace').textContent =
    `${gameState.floorSpace.width}x${gameState.floorSpace.height}`;
}

function formatItemRow(itemId, qty) {
  const material = rules.materials.find(m => m.id === itemId);
  const name = material ? material.name : itemId;
  const weight = material ? material.weight : 1;
  const maxStack = getMaxStack(itemId, gameState.inventorySpace, rules);
  const popularity = gameState.marketPopularity[itemId] || 1.0;
  const popPercent = Math.round((popularity / rules.market.maxPopularity) * 100);

  return `
    <div class="item-row">
      <span>${name} <span class="item-weight">(w:${weight})</span></span>
      <span>
        ${qty}/${maxStack}
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

    const toggleButton = `<button onclick="window.toggleMachine('${machine.id}')" class="toggle-btn">${machine.enabled ? 'Disable' : 'Enable'}</button>`;
    const enabledBadge = machine.enabled ? '' : '<span class="disabled-badge">OFF</span>';

    const posInfo = typeof machine.x === 'number' ? `(${machine.x}, ${machine.y})` : '';

    return `
      <div class="machine-card">
        <div class="machine-header">
          <strong>Machine #${index + 1}</strong> <small style="color: #888;">${posInfo}</small>
          ${enabledBadge}
          <span class="machine-status status-${machine.status}">${machine.status}</span>
          ${toggleButton}
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
    const posInfo = typeof gen.x === 'number' ? `(${gen.x}, ${gen.y})` : '';

    return `
      <div class="generator-card">
        <span>${name} (+${gen.energyOutput} energy) <small style="color: #888;">${posInfo}</small></span>
        <button onclick="window.removeGenerator('${gen.id}')">Remove</button>
      </div>
    `;
  }).join('');
}

function updateResearch() {
  const btn = document.getElementById('btnToggleResearch');
  const status = document.getElementById('researchStatus');
  const container = document.getElementById('discoveredRecipes');

  const energyCost = rules.research.energyCost;

  if (gameState.research.active) {
    btn.textContent = 'Disable Research';
    status.textContent = `(Active - using ${energyCost} energy)`;
  } else {
    btn.textContent = 'Enable Research';
    status.textContent = `(Inactive - costs ${energyCost} energy)`;
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
// Factory Floor Grid Functions
// ============================================================================

function getPlacementSize() {
  if (!placementMode) return 0;
  if (placementMode.type === 'machine') {
    return getStructureSize(rules.machines.baseSpace);
  } else if (placementMode.type === 'generator') {
    const genConfig = rules.generators.types.find(g => g.id === placementMode.generatorType);
    return genConfig ? getStructureSize(genConfig.spaceCost) : 0;
  }
  return 0;
}

function renderFactoryGrid() {
  const container = document.getElementById('factoryGrid');
  if (!container) return;

  const { width, height, placements } = gameState.floorSpace;

  // Set grid template
  container.style.gridTemplateColumns = `repeat(${width}, 30px)`;
  container.style.gridTemplateRows = `repeat(${height}, 30px)`;

  // Create a map of occupied cells for quick lookup
  const occupiedMap = new Map();
  for (const placement of placements) {
    for (let dx = 0; dx < placement.size; dx++) {
      for (let dy = 0; dy < placement.size; dy++) {
        const key = `${placement.x + dx},${placement.y + dy}`;
        occupiedMap.set(key, {
          ...placement,
          isOrigin: dx === 0 && dy === 0
        });
      }
    }
  }

  // Generate cells
  let html = '';
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const key = `${x},${y}`;
      const occupied = occupiedMap.get(key);

      let cellClass = 'grid-cell';
      let content = '';

      if (occupied) {
        cellClass += ` occupied ${occupied.type}`;
        if (occupied.isOrigin && occupied.size > 1) {
          // Show label on origin cell for multi-cell structures
          const label = occupied.type === 'machine' ? 'M' : 'G';
          content = `<span class="structure-overlay" style="width: ${occupied.size * 30 + (occupied.size - 1)}px; height: ${occupied.size * 30 + (occupied.size - 1)}px;">${label}</span>`;
        } else if (occupied.isOrigin && occupied.size === 1) {
          const label = occupied.type === 'machine' ? 'M' : 'G';
          content = `<span class="structure-overlay" style="width: 30px; height: 30px;">${label}</span>`;
        }
      }

      html += `<div class="${cellClass}" data-x="${x}" data-y="${y}">${content}</div>`;
    }
  }

  container.innerHTML = html;

  // Add click handlers
  container.querySelectorAll('.grid-cell').forEach(cell => {
    cell.addEventListener('click', handleGridClick);
    cell.addEventListener('mouseenter', handleGridHover);
    cell.addEventListener('mouseleave', handleGridLeave);
  });
}

function handleGridClick(event) {
  const cell = event.currentTarget;
  const x = parseInt(cell.dataset.x);
  const y = parseInt(cell.dataset.y);

  if (!placementMode) {
    // Maybe show info about what's there?
    return;
  }

  const size = getPlacementSize();
  const placement = canPlaceAt(gameState, x, y, size);

  if (!placement.valid) {
    showError(placement.error);
    return;
  }

  // Dispatch the appropriate action
  if (placementMode.type === 'machine') {
    dispatch({
      type: 'ADD_MACHINE',
      payload: { x, y }
    });
  } else if (placementMode.type === 'generator') {
    dispatch({
      type: 'ADD_GENERATOR',
      payload: { generatorType: placementMode.generatorType, x, y }
    });
  }

  // Keep placement mode active for quick multi-placement
}

function handleGridHover(event) {
  if (!placementMode) return;

  const cell = event.currentTarget;
  const x = parseInt(cell.dataset.x);
  const y = parseInt(cell.dataset.y);
  const size = getPlacementSize();

  // Highlight the cells that would be occupied
  const container = document.getElementById('factoryGrid');
  const placement = canPlaceAt(gameState, x, y, size);
  const isValid = placement.valid;

  for (let dx = 0; dx < size; dx++) {
    for (let dy = 0; dy < size; dy++) {
      const targetCell = container.querySelector(`[data-x="${x + dx}"][data-y="${y + dy}"]`);
      if (targetCell) {
        targetCell.classList.add(isValid ? 'preview' : 'preview-invalid');
      }
    }
  }
}

function handleGridLeave(event) {
  // Remove all preview highlights
  const container = document.getElementById('factoryGrid');
  container.querySelectorAll('.preview, .preview-invalid').forEach(cell => {
    cell.classList.remove('preview', 'preview-invalid');
  });
}

function updatePlacementTypeDropdown() {
  const select = document.getElementById('placementType');
  if (!select) return;

  let options = '<option value="">-- Select Structure --</option>';

  // Machine option
  const machineItem = rules.machines.itemId;
  const machineAvailable = gameState.inventory[machineItem] || 0;
  const machineSize = getStructureSize(rules.machines.baseSpace);
  const machineMaterial = rules.materials.find(m => m.id === machineItem);
  const machineName = machineMaterial ? machineMaterial.name : machineItem;
  options += `<option value="machine" ${machineAvailable < 1 ? 'disabled' : ''}>
    ${machineName} (${machineSize}x${machineSize}) - have: ${machineAvailable}
  </option>`;

  // Generator options
  for (const gen of rules.generators.types) {
    const genAvailable = gameState.inventory[gen.itemId] || 0;
    const genSize = getStructureSize(gen.spaceCost);
    options += `<option value="generator:${gen.id}" ${genAvailable < 1 ? 'disabled' : ''}>
      ${gen.name} (${genSize}x${genSize}, +${gen.energyOutput}E) - have: ${genAvailable}
    </option>`;
  }

  select.innerHTML = options;
}

function updatePlacementStatus() {
  const status = document.getElementById('placementStatus');
  const cancelBtn = document.getElementById('btnCancelPlacement');
  if (!status) return;

  if (placementMode) {
    let name = '';
    if (placementMode.type === 'machine') {
      name = 'Production Machine';
    } else if (placementMode.type === 'generator') {
      const gen = rules.generators.types.find(g => g.id === placementMode.generatorType);
      name = gen ? gen.name : placementMode.generatorType;
    }
    status.textContent = `Click grid to place: ${name}`;
    status.classList.remove('inactive');
    if (cancelBtn) cancelBtn.style.display = 'inline-block';
  } else {
    status.textContent = 'Select a structure to place';
    status.classList.add('inactive');
    if (cancelBtn) cancelBtn.style.display = 'none';
  }
}

function updateExpansionInfo() {
  const info = document.getElementById('expansionInfo');
  const btn = document.getElementById('btnExpandGrid');
  if (!info || !btn) return;

  const expansion = getNextExpansionChunk(gameState, rules);
  const { width, height } = gameState.floorSpace;

  info.innerHTML = `
    Current: ${width}x${height} (${width * height} cells)<br>
    Next expansion: +${expansion.chunkSize}x${expansion.chunkSize} chunk
    → ${expansion.newWidth}x${expansion.newHeight}
  `;

  btn.textContent = `Expand Grid (${expansion.cost} cr)`;
  btn.disabled = gameState.credits < expansion.cost;
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

window.toggleMachine = function(machineId) {
  dispatch({
    type: 'TOGGLE_MACHINE',
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
  placementMode = null;
  updateUI();
});

// Placement type selector
document.getElementById('placementType').addEventListener('change', (e) => {
  const value = e.target.value;
  if (!value) {
    placementMode = null;
  } else if (value === 'machine') {
    placementMode = { type: 'machine' };
  } else if (value.startsWith('generator:')) {
    const generatorType = value.split(':')[1];
    placementMode = { type: 'generator', generatorType };
  }
  updatePlacementStatus();
});

// Cancel placement button
document.getElementById('btnCancelPlacement').addEventListener('click', () => {
  placementMode = null;
  document.getElementById('placementType').value = '';
  updatePlacementStatus();
});

// Grid expansion button
document.getElementById('btnExpandGrid').addEventListener('click', () => {
  dispatch({ type: 'BUY_FLOOR_SPACE', payload: {} });
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

updateUI();
console.log('replaceableParts Engine initialized');
console.log('Initial state:', gameState);
console.log('Rules:', rules);
