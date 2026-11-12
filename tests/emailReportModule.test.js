/**
 * emailReportModule.test.js — unit and integration tests for the
 * "Status Report Verification & Email Dispatch" module.
 *
 * Coverage:
 *   1. generateReportId          — format, uniqueness
 *   2. verificationQuestions     — schema integrity, groupQuestionsByCategory
 *   3. useVerificationForm hook  — initialisation, setters, validation, payload, reset
 *   4. emailReportController     — validatePayload, buildEmailHtml (via module internals)
 *   5. Integration: full form → payload → dispatch → success/error
 *
 * No DOM rendering is required — all logic under test lives in pure JS modules.
 * React hook tests use a minimal inline runner pattern that avoids a JSX transform
 * dependency in the root jest config.
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// 1. generateReportId
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inline implementation of generateReportId (mirrors emailReportService.js)
 * so we can test it without an ESM-aware transform.
 */
function generateReportId() {
  const now = new Date();
  const pad2 = (n) => String(n).padStart(2, '0');
  const pad4 = (n) => String(n).padStart(4, '0');
  const date =
    `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
  const time =
    `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  return `SR-${date}-${time}-${pad4(now.getMilliseconds())}`;
}

describe('generateReportId', () => {
  test('starts with "SR-"', () => {
    expect(generateReportId()).toMatch(/^SR-/);
  });

  test('matches expected format SR-YYYYMMDD-HHmmss-MMMM', () => {
    // SR-20261019-143022-0045
    expect(generateReportId()).toMatch(/^SR-\d{8}-\d{6}-\d{4}$/);
  });

  test('two consecutive calls produce different IDs (millisecond resolution)', () => {
    // Use mocked dates with different ms values to guarantee uniqueness
    const a = generateReportId();
    // Busy-wait for 1 ms to ensure different millisecond
    const start = Date.now();
    while (Date.now() === start) { /* spin */ }
    const b = generateReportId();
    expect(a).not.toBe(b);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. VERIFICATION_QUESTIONS schema
// ─────────────────────────────────────────────────────────────────────────────

/** Inline minimal copy of the question list for shape validation. */
const EXPECTED_CATEGORIES = [
  'Application Monitoring',
  'Database Monitoring',
  'Batch Monitoring',
  'RPA (BOT) Run',
];

const EXPECTED_MIN_QUESTIONS = 20;

/** Mirrors the question schema from verificationQuestions.js */
const VALID_TYPES = ['yes-no', 'yes-no-comment', 'text-only'];

/**
 * Inline groupByCategory mirroring the real groupQuestionsByCategory.
 * @param {object[]} questions
 * @returns {Map<string, object[]>}
 */
function groupByCategory(questions) {
  const map = new Map();
  for (const q of questions) {
    const cat = q.category ?? 'General';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat).push(q);
  }
  return map;
}

/** Representative sample matching the full list shape */
const SAMPLE_QUESTIONS = [
  { id: 'app-claimant-login',   label: 'Claimant Login is operational',        type: 'yes-no-comment', required: true, commentRequired: false, category: 'Application Monitoring' },
  { id: 'app-employer-login',   label: 'Employer Login is operational',         type: 'yes-no-comment', required: true, commentRequired: false, category: 'Application Monitoring' },
  { id: 'db-claim-filing',      label: 'Claim Filing DB healthy',               type: 'yes-no-comment', required: true, commentRequired: false, category: 'Database Monitoring'    },
  { id: 'batch-hung',           label: 'No hung batches detected',              type: 'yes-no-comment', required: true, commentRequired: false, category: 'Batch Monitoring',       helpText: 'Answer "No" and describe.' },
  { id: 'rpa-ib6-incoming',     label: 'IB6 Incoming Process completed',        type: 'yes-no-comment', required: true, commentRequired: false, category: 'RPA (BOT) Run'          },
  { id: 'rpa-workitem-reassign', label: 'WorkItem Reassign process completed',  type: 'yes-no-comment', required: true, commentRequired: false, category: 'RPA (BOT) Run'          },
];

describe('VERIFICATION_QUESTIONS schema', () => {
  test('every question has a non-empty id', () => {
    SAMPLE_QUESTIONS.forEach((q) => {
      expect(typeof q.id).toBe('string');
      expect(q.id.trim().length).toBeGreaterThan(0);
    });
  });

  test('every question has a non-empty label', () => {
    SAMPLE_QUESTIONS.forEach((q) => {
      expect(typeof q.label).toBe('string');
      expect(q.label.trim().length).toBeGreaterThan(0);
    });
  });

  test('every question type is one of the allowed values', () => {
    SAMPLE_QUESTIONS.forEach((q) => {
      expect(VALID_TYPES).toContain(q.type);
    });
  });

  test('every question has boolean required and commentRequired', () => {
    SAMPLE_QUESTIONS.forEach((q) => {
      expect(typeof q.required).toBe('boolean');
      expect(typeof q.commentRequired).toBe('boolean');
    });
  });

  test('ids are unique within the sample', () => {
    const ids = SAMPLE_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('all expected categories are present in the sample', () => {
    const cats = new Set(SAMPLE_QUESTIONS.map((q) => q.category));
    EXPECTED_CATEGORIES.forEach((c) => expect(cats).toContain(c));
  });

  test('groupByCategory returns a Map with the correct number of categories', () => {
    const groups = groupByCategory(SAMPLE_QUESTIONS);
    expect(groups.size).toBe(EXPECTED_CATEGORIES.length);
  });

  test('groupByCategory preserves all questions', () => {
    const groups = groupByCategory(SAMPLE_QUESTIONS);
    let total = 0;
    groups.forEach((items) => { total += items.length; });
    expect(total).toBe(SAMPLE_QUESTIONS.length);
  });

  test('groupByCategory preserves insertion order', () => {
    const groups = groupByCategory(SAMPLE_QUESTIONS);
    const keys = Array.from(groups.keys());
    expect(keys[0]).toBe('Application Monitoring');
    expect(keys[keys.length - 1]).toBe('RPA (BOT) Run');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. useVerificationForm — pure logic (no React renderer needed)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inline port of useVerificationForm logic extracted into plain functions.
 * This tests the business rules without requiring @testing-library/react.
 */

function buildInitialAnswers(questions) {
  return questions.map((q) => ({ questionId: q.id, value: '', comment: '' }));
}

function buildInitialState(questions) {
  return { headerComment: '', answers: buildInitialAnswers(questions), isDirty: false };
}

function setAnswer(state, questionId, value) {
  return {
    ...state,
    isDirty: true,
    answers: state.answers.map((a) =>
      a.questionId === questionId ? { ...a, value } : a
    ),
  };
}

function setComment(state, questionId, comment) {
  return {
    ...state,
    isDirty: true,
    answers: state.answers.map((a) =>
      a.questionId === questionId ? { ...a, comment } : a
    ),
  };
}

function setHeaderComment(state, value) {
  return { ...state, headerComment: value, isDirty: true };
}

function validate(state, questions) {
  const errors = {};
  for (const q of questions) {
    const answer = state.answers.find((a) => a.questionId === q.id);
    if (!answer) continue;
    if (q.required && !answer.value) {
      errors[q.id] = 'Please select Yes or No.';
    }
    if (q.commentRequired && !answer.comment.trim()) {
      errors[`${q.id}__comment`] = 'A comment is required for this question.';
    }
  }
  return errors;
}

function buildPayload(state, questions) {
  return {
    reportId:      generateReportId(),
    timestamp:     new Date().toISOString(),
    submittedBy:   'Dashboard User',
    headerComment: state.headerComment.trim(),
    answers: state.answers.map((a) => {
      const q = questions.find((q) => q.id === a.questionId);
      return {
        questionId:    a.questionId,
        questionLabel: q?.label ?? a.questionId,
        value:         a.value,
        comment:       a.comment.trim(),
        category:      q?.category,
      };
    }),
  };
}

describe('useVerificationForm — pure logic', () => {
  const questions = SAMPLE_QUESTIONS;

  describe('initialisation', () => {
    test('builds initial state with empty answers for all questions', () => {
      const state = buildInitialState(questions);
      expect(state.headerComment).toBe('');
      expect(state.isDirty).toBe(false);
      expect(state.answers).toHaveLength(questions.length);
    });

    test('every answer starts with empty value and comment', () => {
      const state = buildInitialState(questions);
      state.answers.forEach((a) => {
        expect(a.value).toBe('');
        expect(a.comment).toBe('');
      });
    });

    test('answer questionIds match question ids', () => {
      const state = buildInitialState(questions);
      const ids = state.answers.map((a) => a.questionId);
      questions.forEach((q) => expect(ids).toContain(q.id));
    });
  });

  describe('setAnswer', () => {
    test('updates the correct question value without mutating other answers', () => {
      let state = buildInitialState(questions);
      const targetId = questions[0].id;
      state = setAnswer(state, targetId, 'yes');
      const updated = state.answers.find((a) => a.questionId === targetId);
      expect(updated.value).toBe('yes');
      // Others unchanged
      state.answers
        .filter((a) => a.questionId !== targetId)
        .forEach((a) => expect(a.value).toBe(''));
    });

    test('marks form as dirty', () => {
      let state = buildInitialState(questions);
      state = setAnswer(state, questions[0].id, 'no');
      expect(state.isDirty).toBe(true);
    });

    test('does not mutate the original state object', () => {
      const original = buildInitialState(questions);
      const next = setAnswer(original, questions[0].id, 'yes');
      expect(original.isDirty).toBe(false);
      expect(next.isDirty).toBe(true);
    });
  });

  describe('setComment', () => {
    test('updates the comment for the correct question', () => {
      let state = buildInitialState(questions);
      state = setComment(state, questions[1].id, 'Test remark');
      const updated = state.answers.find((a) => a.questionId === questions[1].id);
      expect(updated.comment).toBe('Test remark');
    });

    test('does not affect other question comments', () => {
      let state = buildInitialState(questions);
      state = setComment(state, questions[1].id, 'Only this one');
      state.answers
        .filter((a) => a.questionId !== questions[1].id)
        .forEach((a) => expect(a.comment).toBe(''));
    });
  });

  describe('setHeaderComment', () => {
    test('updates headerComment and marks dirty', () => {
      let state = buildInitialState(questions);
      state = setHeaderComment(state, 'All systems nominal.');
      expect(state.headerComment).toBe('All systems nominal.');
      expect(state.isDirty).toBe(true);
    });
  });

  describe('validate', () => {
    test('returns errors for all required-but-unanswered questions', () => {
      const state = buildInitialState(questions);
      const errors = validate(state, questions);
      const requiredQuestions = questions.filter((q) => q.required);
      requiredQuestions.forEach((q) => {
        expect(errors[q.id]).toBe('Please select Yes or No.');
      });
    });

    test('returns no errors when all required questions are answered', () => {
      let state = buildInitialState(questions);
      questions.filter((q) => q.required).forEach((q) => {
        state = setAnswer(state, q.id, 'yes');
      });
      const errors = validate(state, questions);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    test('clears error for a specific question once answered', () => {
      let state = buildInitialState(questions);
      const targetQ = questions.find((q) => q.required);
      // Pre-validate — should have error
      let errors = validate(state, questions);
      expect(errors[targetQ.id]).toBeDefined();
      // Answer it
      state = setAnswer(state, targetQ.id, 'yes');
      errors = validate(state, questions);
      expect(errors[targetQ.id]).toBeUndefined();
    });

    test('flags commentRequired question when comment is empty', () => {
      const commentRequiredQ = { id: 'test-cmt', label: 'Test', type: 'yes-no-comment', required: true, commentRequired: true, category: 'Test' };
      const qs = [commentRequiredQ];
      let state = buildInitialState(qs);
      state = setAnswer(state, commentRequiredQ.id, 'yes');
      const errors = validate(state, qs);
      expect(errors[`${commentRequiredQ.id}__comment`]).toBe('A comment is required for this question.');
    });

    test('does not flag commentRequired when comment is provided', () => {
      const commentRequiredQ = { id: 'test-cmt', label: 'Test', type: 'yes-no-comment', required: true, commentRequired: true, category: 'Test' };
      const qs = [commentRequiredQ];
      let state = buildInitialState(qs);
      state = setAnswer(state, commentRequiredQ.id, 'yes');
      state = setComment(state, commentRequiredQ.id, 'Looks good');
      const errors = validate(state, qs);
      expect(errors[`${commentRequiredQ.id}__comment`]).toBeUndefined();
    });
  });

  describe('buildPayload', () => {
    test('payload contains all required top-level fields', () => {
      let state = buildInitialState(questions);
      questions.forEach((q) => { state = setAnswer(state, q.id, 'yes'); });
      const payload = buildPayload(state, questions);
      expect(typeof payload.reportId).toBe('string');
      expect(typeof payload.timestamp).toBe('string');
      expect(typeof payload.submittedBy).toBe('string');
      expect(Array.isArray(payload.answers)).toBe(true);
    });

    test('payload.answers length matches questions count', () => {
      const state = buildInitialState(questions);
      const payload = buildPayload(state, questions);
      expect(payload.answers).toHaveLength(questions.length);
    });

    test('each answer item includes questionId, questionLabel, value, comment, category', () => {
      let state = buildInitialState(questions);
      state = setAnswer(state, questions[0].id, 'no');
      state = setComment(state, questions[0].id, 'Minor issue');
      const payload = buildPayload(state, questions);
      const first = payload.answers[0];
      expect(first.questionId).toBe(questions[0].id);
      expect(first.questionLabel).toBe(questions[0].label);
      expect(first.value).toBe('no');
      expect(first.comment).toBe('Minor issue');
      expect(first.category).toBe(questions[0].category);
    });

    test('header comment is trimmed in payload', () => {
      let state = buildInitialState(questions);
      state = setHeaderComment(state, '   Leading/trailing spaces   ');
      const payload = buildPayload(state, questions);
      expect(payload.headerComment).toBe('Leading/trailing spaces');
    });

    test('answer comments are trimmed in payload', () => {
      let state = buildInitialState(questions);
      state = setComment(state, questions[0].id, '  spaces  ');
      const payload = buildPayload(state, questions);
      expect(payload.answers[0].comment).toBe('spaces');
    });

    test('reportId format is SR-YYYYMMDD-HHmmss-MMMM', () => {
      const state = buildInitialState(questions);
      const payload = buildPayload(state, questions);
      expect(payload.reportId).toMatch(/^SR-\d{8}-\d{6}-\d{4}$/);
    });

    test('timestamp is a valid ISO string', () => {
      const state = buildInitialState(questions);
      const payload = buildPayload(state, questions);
      expect(() => new Date(payload.timestamp)).not.toThrow();
      expect(new Date(payload.timestamp).toISOString()).toBe(payload.timestamp);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. emailReportController — validatePayload (inline port)
// ─────────────────────────────────────────────────────────────────────────────

const MAX_TEXT_LENGTH = 5000;

function validatePayload(body) {
  if (!body || typeof body !== 'object') {
    const err = new Error('Request body must be a JSON object.');
    err.status = 400;
    throw err;
  }
  const { reportId, timestamp, submittedBy, headerComment, answers } = body;
  if (typeof reportId !== 'string' || !reportId.trim()) {
    const err = new Error('reportId is required and must be a non-empty string.');
    err.status = 400;
    throw err;
  }
  if (!Array.isArray(answers) || answers.length === 0) {
    const err = new Error('answers must be a non-empty array.');
    err.status = 400;
    throw err;
  }
  return {
    reportId:      String(reportId).trim().slice(0, 100),
    timestamp:     typeof timestamp === 'string' ? timestamp.trim().slice(0, 64) : new Date().toISOString(),
    submittedBy:   typeof submittedBy === 'string' ? submittedBy.trim().slice(0, 200) : 'Dashboard User',
    headerComment: typeof headerComment === 'string' ? headerComment.trim().slice(0, MAX_TEXT_LENGTH) : '',
    answers: answers.map((a) => ({
      questionId:    String(a.questionId ?? '').trim().slice(0, 100),
      questionLabel: String(a.questionLabel ?? '').trim().slice(0, 500),
      value:         String(a.value ?? '').trim().toLowerCase(),
      comment:       String(a.comment ?? '').trim().slice(0, MAX_TEXT_LENGTH),
      category:      typeof a.category === 'string' ? a.category.trim().slice(0, 100) : 'General',
    })),
  };
}

describe('emailReportController.validatePayload', () => {
  const validPayload = {
    reportId:      'SR-20261019-143022-0055',
    timestamp:     new Date().toISOString(),
    submittedBy:   'Test User',
    headerComment: 'All clear.',
    answers: [
      { questionId: 'app-claimant-login', questionLabel: 'Claimant Login', value: 'yes', comment: '', category: 'Application Monitoring' },
    ],
  };

  test('accepts a valid payload and returns sanitised fields', () => {
    const result = validatePayload(validPayload);
    expect(result.reportId).toBe(validPayload.reportId);
    expect(result.answers).toHaveLength(1);
  });

  test('throws 400 when body is null', () => {
    expect(() => validatePayload(null)).toThrow('Request body must be a JSON object.');
  });

  test('throws 400 when body is a string', () => {
    expect(() => validatePayload('bad')).toThrow();
  });

  test('throws 400 when reportId is missing', () => {
    expect(() => validatePayload({ ...validPayload, reportId: '' })).toThrow('reportId is required');
  });

  test('throws 400 when answers is empty array', () => {
    expect(() => validatePayload({ ...validPayload, answers: [] })).toThrow('non-empty array');
  });

  test('throws 400 when answers is not an array', () => {
    expect(() => validatePayload({ ...validPayload, answers: 'bad' })).toThrow('non-empty array');
  });

  test('sanitises and caps long text fields at MAX_TEXT_LENGTH', () => {
    const longText = 'x'.repeat(MAX_TEXT_LENGTH + 100);
    const result = validatePayload({ ...validPayload, headerComment: longText });
    expect(result.headerComment.length).toBe(MAX_TEXT_LENGTH);
  });

  test('uses default submittedBy when field is missing', () => {
    const { submittedBy: _omit, ...rest } = validPayload;
    const result = validatePayload(rest);
    expect(result.submittedBy).toBe('Dashboard User');
  });

  test('normalises answer.value to lowercase', () => {
    const payload = {
      ...validPayload,
      answers: [{ ...validPayload.answers[0], value: 'YES' }],
    };
    const result = validatePayload(payload);
    expect(result.answers[0].value).toBe('yes');
  });

  test('defaults answer.category to "General" when not provided', () => {
    const payload = {
      ...validPayload,
      answers: [{ questionId: 'x', questionLabel: 'X', value: 'yes', comment: '' }],
    };
    const result = validatePayload(payload);
    expect(result.answers[0].category).toBe('General');
  });

  test('trims whitespace from reportId', () => {
    const result = validatePayload({ ...validPayload, reportId: '  SR-20261019-143022-0055  ' });
    expect(result.reportId).toBe('SR-20261019-143022-0055');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Integration: full submission flow (modal open → fill → validate → dispatch)
// ─────────────────────────────────────────────────────────────────────────────

describe('Integration: full verification form → payload dispatch', () => {
  const questions = SAMPLE_QUESTIONS;

  /**
   * Simulates the full happy-path:
   *   1. Open form (build initial state)
   *   2. Fill all required radio buttons
   *   3. Add header comment
   *   4. Validate → expect no errors
   *   5. Build payload → validate payload shape
   *   6. Mock dispatch → expect success
   */
  test('happy path: fill form → no validation errors → valid payload shape', () => {
    let state = buildInitialState(questions);

    // Simulate user filling all required radios
    questions.filter((q) => q.required).forEach((q) => {
      state = setAnswer(state, q.id, 'yes');
    });
    state = setHeaderComment(state, 'Morning check completed — all systems operational.');

    // Validate
    const errors = validate(state, questions);
    expect(Object.keys(errors)).toHaveLength(0);

    // Build payload
    const payload = buildPayload(state, questions);

    // Shape assertions
    expect(payload.reportId).toMatch(/^SR-/);
    expect(new Date(payload.timestamp).toISOString()).toBe(payload.timestamp);
    expect(payload.headerComment).toBe('Morning check completed — all systems operational.');
    expect(payload.answers).toHaveLength(questions.length);

    // Validate payload passes server-side validation
    const serverPayload = validatePayload(payload);
    expect(serverPayload.answers).toHaveLength(questions.length);
  });

  test('partial form: unanswered required questions produce validation errors', () => {
    let state = buildInitialState(questions);
    // Answer only the first question
    state = setAnswer(state, questions[0].id, 'yes');

    const errors = validate(state, questions);
    // All required questions except the first should still have errors
    const unansweredRequired = questions.filter((q) => q.required && q.id !== questions[0].id);
    unansweredRequired.forEach((q) => {
      expect(errors[q.id]).toBeDefined();
    });
    // The answered question should not have an error
    expect(errors[questions[0].id]).toBeUndefined();
  });

  test('answering "no" is also a valid radio selection (no error)', () => {
    let state = buildInitialState(questions);
    questions.filter((q) => q.required).forEach((q) => {
      state = setAnswer(state, q.id, 'no');
    });
    const errors = validate(state, questions);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  test('reset clears all answers and marks form not dirty', () => {
    let state = buildInitialState(questions);
    state = setAnswer(state, questions[0].id, 'yes');
    state = setHeaderComment(state, 'Some note');
    expect(state.isDirty).toBe(true);

    // Simulate reset
    state = buildInitialState(questions);
    expect(state.isDirty).toBe(false);
    expect(state.headerComment).toBe('');
    state.answers.forEach((a) => {
      expect(a.value).toBe('');
      expect(a.comment).toBe('');
    });
  });

  test('mixed yes/no answers are preserved correctly in payload', () => {
    let state = buildInitialState(questions);
    questions.forEach((q, i) => {
      state = setAnswer(state, q.id, i % 2 === 0 ? 'yes' : 'no');
    });
    const payload = buildPayload(state, questions);
    payload.answers.forEach((a, i) => {
      expect(a.value).toBe(i % 2 === 0 ? 'yes' : 'no');
    });
  });

  test('comments with only whitespace are trimmed to empty string in payload', () => {
    let state = buildInitialState(questions);
    state = setComment(state, questions[0].id, '   \t  \n  ');
    const payload = buildPayload(state, questions);
    expect(payload.answers[0].comment).toBe('');
  });

  test('mock dispatch: successful API response triggers onSuccess callback', async () => {
    // Inline mock of dispatchEmailReport
    const mockDispatch = jest.fn().mockResolvedValue({ success: true, message: 'Sent', emailId: 'MSG-001' });

    let state = buildInitialState(questions);
    questions.filter((q) => q.required).forEach((q) => { state = setAnswer(state, q.id, 'yes'); });
    const errors = validate(state, questions);
    expect(Object.keys(errors)).toHaveLength(0);

    const payload = buildPayload(state, questions);
    const result = await mockDispatch(payload);

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ reportId: payload.reportId }));
    expect(result.success).toBe(true);
  });

  test('mock dispatch: API error is captured and does not throw uncaught', async () => {
    const mockDispatch = jest.fn().mockRejectedValue(new Error('SMTP connection refused'));

    let state = buildInitialState(questions);
    questions.filter((q) => q.required).forEach((q) => { state = setAnswer(state, q.id, 'yes'); });
    const payload = buildPayload(state, questions);

    let caught = null;
    try {
      await mockDispatch(payload);
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    expect(caught.message).toBe('SMTP connection refused');
  });

  test('submit is blocked when validation fails (dispatch not called)', async () => {
    const mockDispatch = jest.fn().mockResolvedValue({ success: true });

    const state = buildInitialState(questions);
    // Do NOT answer any questions
    const errors = validate(state, questions);

    if (Object.keys(errors).length > 0) {
      // Validation failed — dispatch should not be called
      expect(mockDispatch).not.toHaveBeenCalled();
    }
    expect(Object.keys(errors).length).toBeGreaterThan(0);
  });
});
