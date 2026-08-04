/**
 * SENTINEL — Cadastro de equipamento e caixa de sugestões.
 */

import { checkFileSize, createEquipment, readFileAsBase64, sendSuggestion } from '../actions.js';
import { FORM_CONFIG, periodicityFor } from '../config.js';
import { getByTag } from '../store.js';
import { addMonths, confirmDialog, el, formatBR, parseDate, toInputDate, toast } from '../utils.js';

export function renderDynamicForm() {
  const cat = el('reg-cat').value;
  const container = el('dynamic-fields');
  container.innerHTML = '';

  FORM_CONFIG[cat].forEach((field) => {
    const group = document.createElement('div');
    group.className = 'form-group';
    if (field.type === 'date') group.style.gridColumn = '1 / -1';

    const inputId = `input_${field.id}`;
    const label = document.createElement('label');
    label.className = 'form-label';
    label.setAttribute('for', inputId);
    label.textContent = field.required ? `${field.label} *` : field.label;

    let input;
    if (field.type === 'select') {
      input = document.createElement('select');
      input.className = 'form-input';
      if (field.blank) {
        const empty = document.createElement('option');
        empty.value = '';
        empty.textContent = '—';
        input.appendChild(empty);
      }
      field.options.forEach((opt) => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        input.appendChild(option);
      });
    } else {
      input = document.createElement('input');
      input.type = field.type;
      input.className = 'form-input';
      if (field.placeholder) input.placeholder = field.placeholder;
    }
    input.id = inputId;
    input.name = field.id;
    if (field.required) input.required = true;

    group.append(label, input);

    if (field.hint) {
      const hint = document.createElement('small');
      hint.className = 'field-hint';
      hint.id = `hint_${field.id}`;
      hint.textContent = field.hint;
      group.appendChild(hint);
    }
    container.appendChild(group);
  });

  // Periodicidade começa com o padrão da categoria, editável por equipamento.
  const periodInput = el('input_periodicidade');
  if (periodInput) {
    periodInput.value = periodicityFor(cat);
    periodInput.min = '1';
  }
  bindValidityCalculation();
}

/* ------------------------------------------------------------------ *
 * Validade calculada: data de certificação + periodicidade
 * ------------------------------------------------------------------ */

function refreshCalculatedValidity() {
  const certInput = el('input_cert_date');
  const periodInput = el('input_periodicidade');
  const dateInput = el('input_date');
  const hint = el('hint_date');
  if (!certInput || !periodInput || !dateInput) return;

  const next = addMonths(parseDate(certInput.value), Number(periodInput.value));

  // Não sobrescreve uma data digitada à mão.
  if (next && dateInput.dataset.touched !== 'true') {
    dateInput.value = toInputDate(next);
  }

  if (hint) {
    if (!next) {
      hint.textContent = '';
      hint.hidden = true;
      return;
    }
    hint.hidden = false;
    hint.textContent =
      dateInput.dataset.touched === 'true'
        ? `Pela periodicidade seria ${formatBR(next)} — a data acima foi ajustada manualmente.`
        : `Calculada: ${formatBR(parseDate(certInput.value))} + ${periodInput.value} meses.`;
  }
}

function bindValidityCalculation() {
  const dateInput = el('input_date');
  if (dateInput && !el('hint_date')) {
    const hint = document.createElement('small');
    hint.className = 'field-hint';
    hint.id = 'hint_date';
    hint.hidden = true;
    dateInput.parentElement.appendChild(hint);
  }

  el('input_cert_date')?.addEventListener('change', refreshCalculatedValidity);
  el('input_periodicidade')?.addEventListener('input', refreshCalculatedValidity);
  dateInput?.addEventListener('input', () => {
    dateInput.dataset.touched = 'true';
    refreshCalculatedValidity();
  });
}

function collect(cat) {
  const values = {};
  FORM_CONFIG[cat].forEach((f) => {
    values[f.id] = el(`input_${f.id}`)?.value.trim() ?? '';
  });
  return values;
}

function validate(cat, values) {
  const errors = [];
  if (!values.tag) errors.push('A TAG é obrigatória.');

  const validity = parseDate(values.date);
  const certified = parseDate(values.cert_date);
  if (values.date && !validity) errors.push('Data de validade inválida.');
  if (values.cert_date && !certified) errors.push('Data de certificação inválida.');
  if (validity && certified && validity < certified) {
    errors.push('A validade não pode ser anterior à data de certificação.');
  }
  if (values.periodicidade && Number(values.periodicidade) <= 0) {
    errors.push('A periodicidade deve ser maior que zero.');
  }
  return errors;
}

async function handleSave() {
  const button = el('btn-save-cloud');
  const cat = el('reg-cat').value;
  const values = collect(cat);

  const errors = validate(cat, values);
  if (errors.length) {
    toast(errors[0], 'error', 7000);
    return;
  }

  // A versão anterior não avisava sobre TAG repetida: um cadastro duplicado
  // ficava indistinguível de uma renovação de certificado.
  const existing = getByTag(values.tag);
  if (existing) {
    const proceed = await confirmDialog({
      title: 'TAG já cadastrada',
      message:
        `Já existe um equipamento com a TAG ${values.tag} (vencimento ${existing.dateLabel || 'sem data'}). ` +
        'Continuar registra este envio como uma nova certificação no histórico da mesma TAG.',
      items: [`${existing.tag} — ${existing.equip || 'sem descrição'}`],
      confirmText: 'Registrar como renovação',
    });
    if (!proceed) return;
  }

  if (values.result && values.result.toUpperCase() === 'REPROVADO') {
    const proceed = await confirmDialog({
      title: 'Certificado reprovado',
      message:
        'Com resultado REPROVADO o equipamento fica marcado como VENCIDO mesmo dentro do prazo, ' +
        'e sai de circulação nos relatórios. Confirma o registro?',
      confirmText: 'Registrar reprovação',
      danger: true,
    });
    if (!proceed) return;
  }

  const fd = new FormData();
  fd.append('action', 'create');
  fd.append('cat', cat);
  FORM_CONFIG[cat].forEach((f) => {
    const raw = values[f.id];
    if (f.type === 'date') {
      // O <input type="date"> devolve "aaaa-mm-dd"; convertemos direto para
      // dd/mm/aaaa sem passar por new Date(iso), que desloca o dia no fuso.
      fd.append(f.id, raw ? formatBR(parseDate(raw)) : '');
    } else {
      fd.append(f.id, raw);
    }
  });

  const fileInput = el('reg-file');
  const file = fileInput?.files?.[0];
  if (file) {
    try {
      checkFileSize(file);
      fd.append('fileData', await readFileAsBase64(file));
      fd.append('fileName', file.name);
      fd.append('mimeType', file.type);
    } catch (error) {
      toast(error.message, 'error', 8000);
      return;
    }
  }

  button.disabled = true;
  const saved = await createEquipment(fd, values.tag);
  button.disabled = false;
  if (!saved) return;

  const keep = await confirmDialog({
    title: 'Equipamento salvo',
    message: 'Deseja manter os dados no formulário para cadastrar um equipamento parecido?',
    confirmText: 'Manter dados',
    cancelText: 'Limpar formulário',
  });
  if (!keep) {
    renderDynamicForm();
    if (fileInput) fileInput.value = '';
  }
}

async function handleSuggestion() {
  const name = el('sug-name').value.trim();
  const type = el('sug-type').value;
  const msg = el('sug-msg').value.trim();
  if (!msg) {
    toast('Descreva a sugestão antes de enviar.', 'warn');
    return;
  }
  const sent = await sendSuggestion(type, name ? `[${name}] ${msg}` : msg);
  if (sent) {
    el('sug-msg').value = '';
    el('sug-name').value = '';
  }
}

export function bindRegister() {
  el('reg-cat')?.addEventListener('change', renderDynamicForm);
  el('btn-save-cloud')?.addEventListener('click', handleSave);
  el('btn-send-suggestion')?.addEventListener('click', handleSuggestion);
  renderDynamicForm();
}
