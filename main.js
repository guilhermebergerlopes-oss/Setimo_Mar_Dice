import './style.css'
import OBR from "@owlbear-rodeo/sdk";

function rollDice(poolSize, isExploding) {
  let rolls = [];
  for (let i = 0; i < poolSize; i++) {
    let roll = Math.floor(Math.random() * 10) + 1;
    rolls.push(roll);
    while (isExploding && roll === 10) {
      roll = Math.floor(Math.random() * 10) + 1;
      rolls.push(roll);
    }
  }
  return rolls;
}

function calculateRaises(diceArray, t1, t2) {
  let currentDice = [...diceArray].sort((a, b) => b - a);
  let groups = [];
  let totalRaises = 0;

  function findSubsetSum(arr, goal, current = [], index = 0) {
    let sum = current.reduce((a, b) => a + b, 0);
    if (sum === goal) return current;
    if (sum > goal || index >= arr.length) return null;

    let include = findSubsetSum(arr, goal, [...current, arr[index]], index + 1);
    if (include) return include;
    return findSubsetSum(arr, goal, current, index + 1);
  }

  function extractGroups(target, raiseValue) {
    for (let goal = target; goal <= target + 9; goal++) {
      let found = true;
      while (found && currentDice.length > 0) {
        let subset = findSubsetSum(currentDice, goal);
        if (subset) {
          groups.push({ dice: subset, raises: raiseValue, sum: goal });
          totalRaises += raiseValue;
          for (let val of subset) {
            currentDice.splice(currentDice.indexOf(val), 1);
          }
        } else {
          found = false;
        }
      }
    }
  }

  if (t2 !== null) {
    extractGroups(t2, 2);
  }
  extractGroups(t1, 1);

  return { groups, totalRaises, unused: currentDice };
}

const ROLL_CHANNEL = "setimo-mar/rolagem";

const LOG_METADATA_ID = "setimo-mar/roll-log";

function renderLog(logArray) {
  const container = document.getElementById("log-container");
  if (!container) return;

  if (!logArray || logArray.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text); opacity: 0.6; margin-top: 20px;">
      Nenhuma rolagem registrada ainda.
    </p>`;
    return;
  }

  container.innerHTML = [...logArray].reverse().map(entry => `
    <div class="log-entry">
      <div class="log-header">
        <span>${entry.playerName}</span>
        <span class="log-time">${entry.time}</span>
      </div>
      <div class="log-action">${entry.actionText}</div>
      <div class="log-raises">${entry.raisesText}</div>
      <div class="log-dice">[ ${entry.rollsText} ]</div>
    </div>
  `).join("");
}

async function addRollToLog(playerName, actionText, raisesText, rollsArray) {
  const metadata = await OBR.room.getMetadata();
  let currentLog = metadata[LOG_METADATA_ID] || [];

  const newEntry = {
    playerName,
    actionText,
    raisesText,
    rollsText: rollsArray.join(", "),
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  currentLog.push(newEntry);

  if (currentLog.length > 50) {
    currentLog.shift();
  }

  await OBR.room.setMetadata({ [LOG_METADATA_ID]: currentLog });
}


OBR.onReady(() => {
  OBR.action.setWidth(450);
  OBR.action.setHeight(500);

  OBR.room.getMetadata().then(metadata => {
    if (metadata) { 
      renderLog(metadata[LOG_METADATA_ID]);
    }
  });

  OBR.room.onMetadataChange((metadata) => {
    if (metadata) {
      renderLog(metadata[LOG_METADATA_ID]);
    }
  });

  const atributos = ["Vigor", "Finesse", "Determinação", "Argúcia", "Panache"];
  const pericias = ["Arte da Guerra", "Armas", "Atletismo", "Atuar", "Briga", "Cavalgar", "Convencer", "Empatia", "Erudição", "Esconder", "Furto", "Intimidar", "Mirar", "Navegar", "Observar", "Seduzir"];

  OBR.broadcast.onMessage(ROLL_CHANNEL, (event) => {
    OBR.notification.show(event.data, "SUCCESS");
  });

  function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const targetId = btn.getAttribute('data-target');
        document.getElementById(targetId).classList.add('active');
      });
    });
  }

  function initFicha() {
    const atributosContainer = document.getElementById('atributos-container');
    const periciasContainer = document.getElementById('pericias-container');

    const getSavedFicha = () => JSON.parse(localStorage.getItem('setimoMarFicha') || '{}');
    const saveFicha = (trait, value) => {
      const ficha = getSavedFicha();
      ficha[trait] = value;
      localStorage.setItem('setimoMarFicha', JSON.stringify(ficha));
    };

    const createCirclesHtml = (currentVal, maxVal = 5) => {
      let circlesHtml = '';
      for (let i = 1; i <= maxVal; i++) {
        const isFilled = i <= currentVal ? 'filled' : '';
        circlesHtml += `<div class="circle-rating ${isFilled}" data-value="${i}"></div>`;
      }
      return circlesHtml;
    };

    const renderTraitList = (items, container, defaultVal) => {
      const savedData = getSavedFicha();

      items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'trait-row';
        
        const startVal = savedData[item] !== undefined ? savedData[item] : defaultVal;

        row.innerHTML = `
          <span class="trait-label">${item}</span>
          <div class="circles-container" data-trait-name="${item}">
            ${createCirclesHtml(startVal)}
            <span class="clear-trait" title="Zerar" style="cursor:pointer; margin-left: 8px; font-size: 14px; color: var(--accent, #9b1c1c); user-select: none;">✖</span>
          </div>
        `;
        
        const circles = row.querySelectorAll('.circle-rating');
        const clearBtn = row.querySelector('.clear-trait');

        circles.forEach(circle => {
          circle.addEventListener('click', (e) => {
            const clickedValue = parseInt(e.target.dataset.value);
            const parentContainer = e.target.closest('.circles-container');
            const allCirclesInRow = parentContainer.querySelectorAll('.circle-rating');
            
            allCirclesInRow.forEach(c => {
              const circleVal = parseInt(c.dataset.value);
              if (circleVal <= clickedValue) {
                c.classList.add('filled');
              } else {
                c.classList.remove('filled');
              }
            });

            saveFicha(item, clickedValue);
          });
        });

        clearBtn.addEventListener('click', (e) => {
           const parentContainer = e.target.closest('.circles-container');
           const allCirclesInRow = parentContainer.querySelectorAll('.circle-rating');
           allCirclesInRow.forEach(c => c.classList.remove('filled'));

           saveFicha(item, 0);
        });

        container.appendChild(row);
      });
    };

    renderTraitList(atributos, atributosContainer, 2);
    renderTraitList(pericias, periciasContainer, 0);
  }

  function initEspiral() {
    const track = document.getElementById('espiral-track');
    const resetBtn = document.getElementById('resetWounds');
    let html = '';

    const totalWounds = 20;
    const centerX = 90;
    const centerY = 90;
    
    let angle = -Math.PI / 2; 
    let radius = 75;     
    const radiusStep = 2.4;
    const arcLength = 20;

    for (let i = 1; i <= totalWounds; i++) {
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      const isDramatic = i % 5 === 0;
      const dramaticId = isDramatic ? i / 5 : '';

      const contentHtml = isDramatic 
        ? `<span class="wound-star">&#10041;</span><span style="font-size:10px; position:absolute;">${dramaticId}</span>` 
        : `<div class="wound-dot">${i}</div>`;

      html += `
        <div class="espiral-item" 
             style="left: ${x}px; top: ${y}px;" 
             data-wound-value="${i}">
          ${contentHtml}
        </div>
      `;
      
      radius -= radiusStep;
      angle += arcLength / radius;
    }
    
    track.innerHTML = html;

    const spiralItems = track.querySelectorAll('.espiral-item');

    const savedWounds = parseInt(localStorage.getItem('setimoMarWounds') || '0');
    spiralItems.forEach(si => {
      if (parseInt(si.dataset.woundValue) <= savedWounds) {
        si.classList.add('filled');
      }
    });

    const explodingDiceCheck = document.getElementById("explodingDice");
    if (explodingDiceCheck && savedWounds >= 15) {
      explodingDiceCheck.checked = true;
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        spiralItems.forEach(si => si.classList.remove('filled'));

        if (explodingDiceCheck) {
          explodingDiceCheck.checked = false; 
        }

        localStorage.setItem('setimoMarWounds', 0);
        console.log("Ferimentos zerados!");
      });
    }

    spiralItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const currentTarget = e.target.closest('.espiral-item');
        const clickedValue = parseInt(currentTarget.dataset.woundValue);
        
        spiralItems.forEach(si => {
          const val = parseInt(si.dataset.woundValue);
          if (val <= clickedValue) {
            si.classList.add('filled');
          } else {
            si.classList.remove('filled');
          }
        });

        if (explodingDiceCheck && clickedValue >= 15) {
          explodingDiceCheck.checked = true;
        }

        localStorage.setItem('setimoMarWounds', clickedValue);
      });
    });
  }

  function initRollTab() {
    const attrSelect = document.getElementById('rollAttribute');
    const skillSelect = document.getElementById('rollSkill');

    atributos.forEach(attr => {
      const opt = document.createElement('option');
      opt.value = attr;
      opt.textContent = attr;
      attrSelect.appendChild(opt);
    });

    const optNoneSkill = document.createElement('option');
    optNoneSkill.value = "Nenhuma";
    optNoneSkill.textContent = "- Nenhuma -";
    skillSelect.appendChild(optNoneSkill);

    const optNoneAttr = document.createElement('option');
    optNoneAttr.value = "Nenhum";
    optNoneAttr.textContent = "- Nenhum -";
    attrSelect.appendChild(optNoneAttr);

    pericias.forEach(pericia => {
      const opt = document.createElement('option');
      opt.value = pericia;
      opt.textContent = pericia;
      skillSelect.appendChild(opt);
    });
  }

  function getTraitValue(traitName) {
    if (traitName === "Nenhuma") return 0;
    const container = document.querySelector(`.circles-container[data-trait-name="${traitName}"]`);
    if (!container) return 0;
    return container.querySelectorAll('.circle-rating.filled').length;
  }

  initTabs();
  initFicha();
  initEspiral();
  initRollTab();

  const rollButton = document.getElementById("rollButton");
  const resultsDiv = document.getElementById("results");

  let currentRolls = [];
  let rollConfig = {
    isExploding: true,
    isDangerPoint: false,
    hasDoubleRaise: false
  };

  function updateDisplay() {
    let target1 = rollConfig.isDangerPoint ? 15 : 10;
    let target2 = rollConfig.hasDoubleRaise ? (rollConfig.isDangerPoint ? 20 : 15) : null;
    
    const { groups, totalRaises, unused } = calculateRaises(currentRolls, target1, target2);
    
    let htmlOutput = `<strong>Total de Apostas: <span style="font-size: 18px; color: #d84315;">${totalRaises}</span></strong><br><br>`;

    const renderDie = (val) => `<span class="die-btn" data-value="${val}">${val}</span>`;

    groups.forEach((group, index) => {
      const cssClass = group.raises === 2 ? "raise-group double" : "raise-group";
      const label = group.raises === 2 ? "(2 Apostas)" : "(1 Aposta)";
      const diceHtml = group.dice.map(renderDie).join(" + ");
      htmlOutput += `<div class="${cssClass}">Grupo ${index + 1}: [${diceHtml}] = ${group.sum} <br> <em>${label}</em></div>`;
    });
    
    const unusedHtml = unused.map(renderDie).join(" ");
    htmlOutput += `<div style="margin-top: 10px; color: #666;"><em>Resultados não utilizados: ${unusedHtml || "Nenhum"}</em></div>`;

    if (currentRolls.length > 0) {
      htmlOutput += `<button id="rerollButton" class="reroll-btn">Rerolar Selecionados</button>`;
    }

    resultsDiv.innerHTML = htmlOutput;

    const dieButtons = resultsDiv.querySelectorAll('.die-btn');
    dieButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('selected');
      });
    });

  const rerollBtn = document.getElementById('rerollButton');
  if (rerollBtn) {
    rerollBtn.addEventListener('click', async () => {
      const selectedElements = resultsDiv.querySelectorAll('.die-btn.selected');
      if (selectedElements.length === 0) return;

      const valuesToReroll = Array.from(selectedElements).map(el => parseInt(el.dataset.value));

      valuesToReroll.forEach(val => {
        const index = currentRolls.indexOf(val);
        if (index > -1) {
          currentRolls.splice(index, 1);
        }
      });

      const newRolls = rollDice(valuesToReroll.length, rollConfig.isExploding);
      currentRolls.push(...newRolls);

      updateDisplay();

      let t1 = rollConfig.isDangerPoint ? 15 : 10;
      let t2 = rollConfig.hasDoubleRaise ? (rollConfig.isDangerPoint ? 20 : 15) : null;

      const { totalRaises } = calculateRaises(currentRolls, t1, t2);

      const playerName = await OBR.player.getName();
      const apostaTexto = totalRaises === 1 ? "1 Aposta" : `${totalRaises} Apostas`;

      const msgReroll = `${playerName} rerolou ${valuesToReroll.length} dados e agora tem ${apostaTexto}!\nNovos resultados: [${newRolls.join(", ")}]`;

      OBR.notification.show(msgReroll, "DEFAULT");
      OBR.broadcast.sendMessage(ROLL_CHANNEL, msgReroll);

      const actionText = `Rerolou ${valuesToReroll.length} dados`;
      await addRollToLog(playerName, actionText, apostaTexto, currentRolls);

    });
  }
  }

  rollButton.addEventListener("click", async () => {

    const attrName = document.getElementById("rollAttribute").value;
    const skillName = document.getElementById("rollSkill").value;
    const bonus = parseInt(document.getElementById("rollBonus").value) || 0;

    const attrVal = getTraitValue(attrName);
    const skillVal = getTraitValue(skillName);

    const poolSize = attrVal + skillVal + bonus;

    if (poolSize <= 0) {
      OBR.notification.show("A parada de dados precisa ser de pelo menos 1 dado.", "WARNING");
      return;
    }

    rollConfig.isExploding = document.getElementById("explodingDice").checked;
    rollConfig.isDangerPoint = document.getElementById("dangerPoint").checked;
    rollConfig.hasDoubleRaise = document.getElementById("doubleRaiseAdvantage").checked;

    currentRolls = rollDice(poolSize, rollConfig.isExploding);

    let t1 = rollConfig.isDangerPoint ? 15 : 10;
    let t2 = rollConfig.hasDoubleRaise ? (rollConfig.isDangerPoint ? 20 : 15) : null;

    const { totalRaises } = calculateRaises(currentRolls, t1, t2);

    updateDisplay();

    const playerName = await OBR.player.getName();

    const apostaTexto = totalRaises === 1 ? "1 Aposta" : `${totalRaises} Apostas`;
    const dangerText = rollConfig.isDangerPoint ? " (Com Ponto de Perigo)" : "";
    
    const message = `${playerName} rolou ${poolSize}d10${dangerText} e conseguiu ${apostaTexto}!\nDados: [${currentRolls.join(", ")}]`;

    OBR.notification.show(message, "SUCCESS");

    OBR.broadcast.sendMessage(ROLL_CHANNEL, message);

    const actionText = `Rolou ${poolSize}d10${dangerText}`;
    await addRollToLog(playerName, actionText, apostaTexto, currentRolls);

  });

  const clearButton = document.getElementById("clearButton");

  clearButton.addEventListener("click", () => {
    currentRolls = [];
    resultsDiv.innerHTML = ""; 
  });

  const clearLogButtonGm = document.getElementById("clearLogButtonGm");
  if (clearLogButtonGm) {
    clearLogButtonGm.addEventListener("click", async () => {
      const role = await OBR.player.getRole();
      if (role === "GM") {
        if (window.confirm("Tem certeza que deseja apagar todo o histórico de rolagens?")) {
          await OBR.room.setMetadata({ [LOG_METADATA_ID]: [] });
          OBR.notification.show("Log de rolagens limpo.", "SUCCESS");
        }
      } else {
        OBR.notification.show("Apenas o GM pode limpar o log da mesa.", "WARNING");
      }
    });
  }

});