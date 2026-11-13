/*
 * LIGHT — Calculatrice de camouflage (logique reprise du prototype SafeElle, réécrite sans innerHTML).
 *  - calcule réellement (priorité des opérateurs, pourcentage, virgule), sans eval ;
 *  - code secret puis « = » : ouvre LIGHT (session de camouflage) ;
 *  - code leurre puis « = » : affiche un historique banal ;
 *  - Échap efface (c'est la page neutre : il n'y a rien à quitter).
 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var CAMO = window.LIGHT_CAMO;
  var OPS = '+-*/';
  var expr = '';
  var justEvaluated = false;
  var checking = false;

  function render(resultText) {
    $('expr').textContent = expr.replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−').replace(/\./g, ',');
    $('result').textContent = resultText !== undefined ? resultText : (lastNumber() || '0').replace(/\./g, ',');
  }
  function lastNumber() { var m = expr.match(/[\d.]+%?$/); return m ? m[0] : ''; }

  /** Évaluation sans eval : algorithme de la gare de triage (priorité × ÷ sur + −). */
  function evaluate(s) {
    var tokens = s.match(/(\d+\.?\d*|\.\d+)%?|[+\-*/]/g);
    if (!tokens) return null;
    var out = [], ops = [], prec = { '+': 1, '-': 1, '*': 2, '/': 2 }, expectNum = true;
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (expectNum) {
        if (t === '-') { out.push(0); ops.push('-'); continue; }
        if (OPS.indexOf(t) >= 0) return null;
        out.push(t.slice(-1) === '%' ? parseFloat(t) / 100 : parseFloat(t));
        expectNum = false;
      } else {
        while (ops.length && prec[ops[ops.length - 1]] >= prec[t]) out.push(ops.pop());
        ops.push(t); expectNum = true;
      }
    }
    if (expectNum) ops.pop();
    while (ops.length) out.push(ops.pop());
    var st = [];
    for (var j = 0; j < out.length; j++) {
      var x = out[j];
      if (typeof x === 'number') { st.push(x); continue; }
      var b = st.pop(), a = st.pop();
      if (a === undefined || b === undefined) return null;
      st.push(x === '+' ? a + b : x === '-' ? a - b : x === '*' ? a * b : a / b);
    }
    var r = st.pop();
    return Number.isFinite(r) ? r : null;
  }
  function fmt(n) { return n === null ? 'Erreur' : String(Math.round(n * 1e10) / 1e10).replace('.', ','); }

  function press(k) {
    if (k === 'C') { expr = ''; justEvaluated = false; return render(); }
    if (k === 'back') { expr = expr.slice(0, -1); return render(); }
    if (k === '=') {
      // Tout calcul peut être le calcul secret choisi par la personne : comparaison d'empreintes (asynchrone).
      if (expr.length >= 4 && !checking && CAMO && CAMO.isConfigured()) {
        var typed = expr;
        checking = true;
        CAMO.checkCode(typed).then(function (r) {
          checking = false;
          if (r === 'secret') unlock();
          else if (r === 'decoy') openDecoy();
        }).catch(function () { checking = false; });
      }
      var r = evaluate(expr);
      expr = r === null ? '' : String(Math.round(r * 1e10) / 1e10);
      justEvaluated = true;
      $('expr').textContent = '';
      $('result').textContent = fmt(r);
      return;
    }
    if (k === '%') { if (/\d$/.test(expr)) expr += '%'; return render(); }
    if (OPS.indexOf(k) >= 0) {
      justEvaluated = false;
      if (expr === '' && k !== '-') return;
      if (/[+\-*/]$/.test(expr)) expr = expr.slice(0, -1);
      expr += k; return render();
    }
    if (justEvaluated) { expr = ''; justEvaluated = false; }
    if (k === '.' && expr.split(/[+\-*/]/).pop().indexOf('.') >= 0) return;
    if (expr.length > 24) return;
    expr += k; render();
  }

  /** Code secret : ouvre LIGHT sans ajouter d'entrée d'historique. */
  function unlock() {
    expr = ''; render('0');
    CAMO.openSession();
    window.location.replace('index.html');
  }

  function openDecoy() {
    var list = $('decoy-list');
    while (list.firstChild) list.removeChild(list.firstChild);
    [['125 + 340', '465'], ['2 500 × 3', '7 500'], ['15 000 − 4 750', '10 250'], ['1 200 ÷ 4', '300']].forEach(function (l) {
      var li = document.createElement('li');
      var a = document.createElement('span'); a.textContent = l[0];
      var b = document.createElement('span'); b.textContent = '= ' + l[1];
      li.appendChild(a); li.appendChild(b); list.appendChild(li);
    });
    $('calc').hidden = true; $('decoy').hidden = false;
  }
  $('decoy-back').addEventListener('click', function () { $('decoy').hidden = true; $('calc').hidden = false; expr = ''; render('0'); });

  $('keys').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button[data-k]') : null;
    if (b) press(b.dataset.k);
  });
  document.addEventListener('keydown', function (e) {
    if ($('calc').hidden) return;
    var map = { Enter: '=', '=': '=', Backspace: 'back', Escape: 'C', Delete: 'C', ',': '.' };
    var k = map[e.key] || e.key;
    if (/^[0-9.+\-*/%=]$/.test(k) || k === 'back' || k === 'C') { e.preventDefault(); press(k); }
  });

  /* Notification camouflée (dans la page uniquement) après l'envoi d'un message de démonstration. */
  function showNotif(n) {
    $('notif-ic').textContent = n.icon;
    $('notif-app').textContent = n.app;
    $('notif-txt').textContent = n.text;
    var el = $('notif');
    el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 4500);
  }
  if (CAMO) {
    // Arriver sur la calculatrice ferme toujours la session (verrouillage).
    var pending = CAMO.takeNotif();
    CAMO.closeSession();
    if (pending) setTimeout(function () { showNotif(pending); }, 700);
    CAMO.ensureCodes().catch(function () { /* Web Crypto indisponible */ });
  }
  window.LIGHT_CALC = { evaluate: evaluate, fmt: fmt };
  render();
})();
