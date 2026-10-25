(function () {
  'use strict';

  var cfg = window.SURVEY_CONFIG;
  var labels = cfg.labels;
  var questions = cfg.questions;
  var total = questions.length;

  var screenCover = document.getElementById('screen-cover');
  var screenSurvey = document.getElementById('screen-survey');
  var screenFinal = document.getElementById('screen-final');
  var questionMount = document.getElementById('question-mount');
  var form = document.getElementById('survey');
  var giftToast = document.getElementById('gift-toast');

  /** @type {Record<string, string | string[]>} */
  var answers = {};
  var currentIndex = -1;
  var isSubmitting = false;

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function getLabel(key) {
    return labels[key] || '';
  }

  function getAnswer(id) {
    if (!(id in answers)) return '';
    var v = answers[id];
    if (Array.isArray(v)) return v;
    return typeof v === 'string' ? v : '';
  }

  function setAnswer(id, value) {
    answers[id] = value;
  }

  function trimText(value) {
    return String(value || '').trim();
  }

  function showScreen(name) {
    var map = [
      { el: screenCover, key: 'cover' },
      { el: screenSurvey, key: 'survey' },
      { el: screenFinal, key: 'final' }
    ];
    var activeEl = null;
    map.forEach(function (item) {
      var on = name === item.key;
      item.el.classList.toggle('active', on);
      item.el.setAttribute('aria-hidden', on ? 'false' : 'true');
      if (on) activeEl = item.el;
    });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo(0, 0);
    if (activeEl) activeEl.scrollTop = 0;
  }

  function progressMeta(index) {
    var n = index + 1;
    var pct = Math.round((n / total) * 100);
    return { n: n, pct: pct, width: ((n / total) * 100).toFixed(2) + '%' };
  }

  function parentValue(question) {
    var v = getAnswer(question.id);
    return Array.isArray(v) ? '' : trimText(v);
  }

  function followupLabel(fu, parentVal) {
    if (fu.label) return fu.label;
    if (fu.labelWhen && parentVal && fu.labelWhen[parentVal]) return fu.labelWhen[parentVal];
    if (fu.labelWhen && fu.labelWhen.__default__) return fu.labelWhen.__default__;
    return '';
  }

  function isFollowupVisible(fu, question) {
    var pv = parentValue(question);
    if (!pv) return false;
    if (fu.showWhenParentSelected) return true;
    if (fu.hideWhenParentValue && pv === fu.hideWhenParentValue) return false;
    if (fu.hideWhenParentValue && pv !== fu.hideWhenParentValue) return true;
    return false;
  }

  function renderQuestion(index) {
    var q = questions[index];
    var meta = progressMeta(index);
    var hintText = q.hint === null ? '' : q.hint || (q.hintKey ? getLabel(q.hintKey) : '');
    var isLast = index === total - 1;

    var html = '';
    html += '<section class="card" data-q-index="' + index + '">';
    html +=
      '<div class="progress-head"><span>' +
      escapeHtml(labels.questionOf + ' ' + meta.n + ' ' + labels.of + ' ' + total) +
      '</span><span>' +
      escapeHtml(String(meta.pct) + '%') +
      '</span></div>';
    html +=
      '<div class="progress"><div class="progress-fill" style="width:' +
      escapeHtml(meta.width) +
      '"></div></div>';
    html +=
      '<div class="qheading"><span class="qbadge" aria-hidden="true">' +
      escapeHtml(String(meta.n)) +
      '</span><h2>' +
      escapeHtml(q.title) +
      '</h2></div>';

    if (hintText) {
      html += '<p class="hint">' + escapeHtml(hintText) + '</p>';
    }

    if (q.type === 'text') {
      html +=
        '<textarea class="field" data-answer-id="' +
        escapeHtml(q.id) +
        '" aria-label="' +
        escapeHtml(q.title) +
        '" placeholder="' +
        escapeHtml(labels.placeholder) +
        '">' +
        escapeHtml(trimText(getAnswer(q.id))) +
        '</textarea>';
    }

    if (q.type === 'single') {
      html += '<div class="options">';
      q.options.forEach(function (opt) {
        var checked = parentValue(q) === opt ? ' checked' : '';
        html +=
          '<label class="option"><input type="radio" name="' +
          escapeHtml(q.id) +
          '" data-answer-id="' +
          escapeHtml(q.id) +
          '" value="' +
          escapeHtml(opt) +
          '"' +
          checked +
          ' />' +
          escapeHtml(opt) +
          '</label>';
      });
      html += '</div>';

      if (q.followups && q.followups.length) {
        var pv = parentValue(q);
        var anyVisible = q.followups.some(function (fu) {
          return isFollowupVisible(fu, q);
        });
        html += '<div class="followup"' + (anyVisible ? '' : ' hidden') + ' data-followup-root>';
        q.followups.forEach(function (fu) {
          var visible = isFollowupVisible(fu, q);
          html += '<div data-followup-id="' + escapeHtml(fu.id) + '"' + (visible ? '' : ' hidden') + '>';
          html += '<h3>' + escapeHtml(followupLabel(fu, pv)) + '</h3>';
          html +=
            '<textarea class="field" data-answer-id="' +
            escapeHtml(fu.id) +
            '" aria-label="' +
            escapeHtml(followupLabel(fu, pv)) +
            '" placeholder="' +
            escapeHtml(labels.placeholder) +
            '">' +
            escapeHtml(trimText(getAnswer(fu.id))) +
            '</textarea>';
          html += '</div>';
        });
        html += '</div>';
      }
    }

    if (q.type === 'multi') {
      var selected = getAnswer(q.id);
      if (!Array.isArray(selected)) selected = selected ? [selected] : [];
      html += '<div class="options">';
      q.options.forEach(function (opt) {
        var checked = selected.indexOf(opt) !== -1 ? ' checked' : '';
        html +=
          '<label class="option"><input type="checkbox" data-answer-id="' +
          escapeHtml(q.id) +
          '" value="' +
          escapeHtml(opt) +
          '"' +
          checked +
          ' />' +
          escapeHtml(opt) +
          '</label>';
      });
      html += '</div>';

      if (q.otherOption && q.otherFieldId) {
        var otherOn = selected.indexOf(q.otherOption) !== -1;
        html += '<div class="followup"' + (otherOn ? '' : ' hidden') + ' data-other-wrap>';
        html += '<h3>' + escapeHtml(q.otherOption) + '</h3>';
        html +=
          '<textarea class="field" data-answer-id="' +
          escapeHtml(q.otherFieldId) +
          '" aria-label="' +
          escapeHtml(q.otherOption) +
          '" placeholder="' +
          escapeHtml(labels.placeholder) +
          '">' +
          escapeHtml(trimText(getAnswer(q.otherFieldId))) +
          '</textarea>';
        html += '</div>';
      }
    }

    html += '<div class="error" role="alert"></div>';

    html += '<div class="actions">';
    html +=
      '<button type="button" class="btn secondary" data-action="back">' +
      escapeHtml(labels.back) +
      '</button>';
    html +=
      '<button type="button" class="btn" data-action="next">' +
      escapeHtml(isLast ? labels.submit : labels.next) +
      '</button>';
    html += '</div></section>';

    questionMount.innerHTML = html;
    bindQuestionEvents(q);
    screenSurvey.scrollTop = 0;
  }

  function bindQuestionEvents(q) {
    questionMount.querySelectorAll('[data-answer-id]').forEach(function (el) {
      var id = el.getAttribute('data-answer-id');
      if (el.type === 'radio') {
        el.addEventListener('change', function () {
          if (el.checked) {
            setAnswer(id, el.value);
            if (q.type === 'single') refreshFollowups(q);
            clearError();
          }
        });
      } else if (el.type === 'checkbox') {
        el.addEventListener('change', function () {
          handleMultiChange(q, el);
        });
      } else {
        el.addEventListener('input', function () {
          setAnswer(id, el.value);
          clearError();
        });
      }
    });

    questionMount.querySelector('[data-action="back"]').addEventListener('click', goBack);
    questionMount.querySelector('[data-action="next"]').addEventListener('click', goNext);
  }

  function handleMultiChange(q, el) {
    var selected = getAnswer(q.id);
    if (!Array.isArray(selected)) selected = [];
    var val = el.value;
    if (el.checked) {
      if (q.maxSelections && selected.length >= q.maxSelections) {
        el.checked = false;
        showError(
          q.maxSelections === 3 ? labels.errorMaxThree : labels.errorMaxTwo
        );
        return;
      }
      if (selected.indexOf(val) === -1) selected.push(val);
    } else {
      selected = selected.filter(function (x) {
        return x !== val;
      });
    }
    setAnswer(q.id, selected);
    refreshOtherField(q);
    clearError();
  }

  function refreshFollowups(q) {
    if (q.type !== 'single' || !q.followups) return;
    var root = questionMount.querySelector('[data-followup-root]');
    if (!root) return;
    var pv = parentValue(q);
    var any = false;
    q.followups.forEach(function (fu) {
      var block = root.querySelector('[data-followup-id="' + fu.id + '"]');
      if (!block) return;
      var vis = isFollowupVisible(fu, q);
      block.hidden = !vis;
      if (vis) {
        any = true;
        var h3 = block.querySelector('h3');
        if (h3) h3.textContent = followupLabel(fu, pv);
      }
    });
    root.hidden = !any;
  }

  function refreshOtherField(q) {
    if (!q.otherFieldId) return;
    var wrap = questionMount.querySelector('[data-other-wrap]');
    if (!wrap) return;
    var selected = getAnswer(q.id);
    if (!Array.isArray(selected)) selected = [];
    wrap.hidden = selected.indexOf(q.otherOption) === -1;
  }

  function clearError() {
    var err = questionMount.querySelector('.error');
    if (err) {
      err.textContent = '';
      err.classList.remove('visible');
    }
  }

  function showError(message) {
    var err = questionMount.querySelector('.error');
    if (!err) return;
    err.textContent = message;
    err.classList.add('visible');
  }

  function focusFirstInvalid(selector) {
    var el = questionMount.querySelector(selector);
    if (el) el.focus();
  }

  function validateCurrent() {
    var q = questions[currentIndex];
    clearError();

    if (q.type === 'text') {
      if (!trimText(getAnswer(q.id))) {
        showError(labels.errorRequired);
        focusFirstInvalid('[data-answer-id="' + q.id + '"]');
        return false;
      }
      return true;
    }

    if (q.type === 'single') {
      var pv = parentValue(q);
      if (!pv) {
        showError(labels.errorRequired);
        focusFirstInvalid('input[type="radio"]');
        return false;
      }
      if (q.followups) {
        for (var i = 0; i < q.followups.length; i++) {
          var fu = q.followups[i];
          if (!isFollowupVisible(fu, q)) continue;
          if (!trimText(getAnswer(fu.id))) {
            showError(labels.errorRequired);
            focusFirstInvalid('[data-answer-id="' + fu.id + '"]');
            return false;
          }
        }
      }
      return true;
    }

    if (q.type === 'multi') {
      var sel = getAnswer(q.id);
      if (!Array.isArray(sel) || sel.length === 0) {
        showError(labels.errorRequired);
        focusFirstInvalid('input[type="checkbox"]');
        return false;
      }
      if (q.otherOption && sel.indexOf(q.otherOption) !== -1 && !trimText(getAnswer(q.otherFieldId))) {
        showError(labels.errorOtherEmpty);
        focusFirstInvalid('[data-answer-id="' + q.otherFieldId + '"]');
        return false;
      }
      return true;
    }

    return true;
  }

  function setSubmitting(active) {
    isSubmitting = active;
    var nextBtn = questionMount.querySelector('[data-action="next"]');
    var backBtn = questionMount.querySelector('[data-action="back"]');
    if (nextBtn) {
      nextBtn.disabled = active;
      if (active) nextBtn.setAttribute('aria-busy', 'true');
      else nextBtn.removeAttribute('aria-busy');
    }
    if (backBtn) backBtn.disabled = active;
  }

  function goNext() {
    if (isSubmitting) return;
    if (!validateCurrent()) return;
    if (currentIndex === total - 1) {
      submitSurvey();
      return;
    }
    currentIndex += 1;
    renderQuestion(currentIndex);
  }

  function goBack() {
    if (currentIndex <= 0) {
      showScreen('cover');
      currentIndex = -1;
      return;
    }
    currentIndex -= 1;
    renderQuestion(currentIndex);
  }

  function startSurvey() {
    currentIndex = 0;
    showScreen('survey');
    renderQuestion(0);
  }

  /**
   * Отправка через Google Apps Script (no-cors): ответ opaque, сохранение в таблице
   * отдельно не подтверждается на клиенте.
   */
  function submitSurvey() {
    if (isSubmitting) return;

    for (var i = 0; i < total; i++) {
      var saved = currentIndex;
      currentIndex = i;
      if (!validateCurrent()) {
        currentIndex = saved;
        renderQuestion(currentIndex);
        return;
      }
    }
    currentIndex = total - 1;

    var submitUrl = trimText(cfg.submitUrl);
    if (!submitUrl) {
      showError(labels.errorSubmit);
      return;
    }

    var payload = collectExportPayload();
    clearError();
    setSubmitting(true);

    fetch(submitUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    })
      .then(function () {
        setSubmitting(false);
        showScreen('final');
      })
      .catch(function () {
        setSubmitting(false);
        showError(labels.errorSubmit);
      });
  }

  function collectExportPayload() {
    return {
      surveyVersion: cfg.surveyVersion,
      answers: JSON.parse(JSON.stringify(answers))
    };
  }

  window.submitSurvey = submitSurvey;
  window.collectSurveyPayload = collectExportPayload;

  function showGiftToast(message) {
    if (!giftToast) return;
    giftToast.textContent = message;
    giftToast.hidden = false;
    giftToast.classList.add('visible');
    window.setTimeout(function () {
      giftToast.classList.remove('visible');
      giftToast.hidden = true;
    }, 3200);
  }

  function onGiftClick() {
    var url = trimText(cfg.giftUrl);
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    showGiftToast(labels.giftEmptyMessage);
  }

  document.getElementById('btn-start').addEventListener('click', startSurvey);
  document.getElementById('btn-gift').addEventListener('click', onGiftClick);
  form.addEventListener('submit', function (e) {
    e.preventDefault();
  });

  showScreen('cover');
})();
