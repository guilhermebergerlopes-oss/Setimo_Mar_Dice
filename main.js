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

OBR.onReady(() => {
  OBR.action.setWidth(400);
  OBR.action.setHeight(500);

  OBR.broadcast.onMessage(ROLL_CHANNEL, (event) => {
    OBR.notification.show(event.data, "SUCCESS");
  });

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
    });
  }
  }

  rollButton.addEventListener("click", async () => {
    const poolSize = parseInt(document.getElementById("dicePool").value);

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
  });

  const clearButton = document.getElementById("clearButton");

  clearButton.addEventListener("click", () => {
    currentRolls = [];
    resultsDiv.innerHTML = ""; 
  });
});