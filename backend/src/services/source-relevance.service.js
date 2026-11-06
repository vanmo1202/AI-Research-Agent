// Deterministic lexical gate: no provider calls, no domain blacklist or LLM verdict.
// Phrase equivalences are shared terminology, not a special case for one research topic.
const aliases = [
    ['algorithmcomplexity', ['do phuc tap thuat toan', 'do phuc tap giai thuat', 'algorithmic complexity', 'algorithm complexity', 'computational complexity', 'algorithm analysis', 'phan tich thuat toan']],
    ['timecomplexity', ['do phuc tap thoi gian', 'time complexity']],
    ['spacecomplexity', ['do phuc tap khong gian', 'space complexity']],
    ['bigo', ['big o notation', 'big o', 'ky hieu o lon']],
    ['algorithm', ['thuat toan', 'giai thuat', 'algorithms']],
    ['springmass', ['con lac lo xo', 'mass spring system', 'spring mass system', 'mass spring', 'spring mass', 'spring oscillator', 'spring pendulum']],
    ['harmonicmotion', ['dao dong dieu hoa', 'simple harmonic motion', 'harmonic oscillations', 'harmonic oscillation', 'harmonic motion']],
    ['mechanicaloscillation', ['dao dong co hoc', 'mechanical oscillations', 'mechanical oscillation']],
    ['pendulum', ['con lac', 'pendulums']], ['spring', ['lo xo', 'springs']],
    ['physics', ['vat ly', 'physics']], ['hookelaw', ['dinh luat hooke', 'hooke s law', 'hooke law']],
    ['ai', ['tri tue nhan tao', 'artificial intelligence']],
    ['education', ['giao duc', 'education']], ['university', ['dai hoc', 'higher education', 'universities']],
    ['inventory', ['ton kho', 'inventory']], ['questionanswering', ['hoi dap', 'question answering']],
    ['document', ['tai lieu', 'documents']], ['database', ['co so du lieu', 'databases']],
    ['machinelearning', ['hoc may', 'machine learning']], ['retrieval', ['truy xuat', 'retrieval']],
    ['climatechange', ['bien doi khi hau', 'climate change']], ['renewableenergy', ['nang luong tai tao', 'renewable energy']],
    ['carbonpricing', ['thue carbon', 'thue cac bon', 'carbon tax', 'carbon pricing']],
    ['vietnam', ['viet nam', 'vietnam']], ['china', ['trung quoc', 'china']],
    ['programming', ['lap trinh', 'programming']],
    ['frenchrevolution', ['cach mang phap', 'french revolution']], ['history', ['lich su', 'history']],
    ['inflation', ['lam phat', 'inflation']], ['monetarypolicy', ['chinh sach tien te', 'monetary policy']],
    ['stockmarket', ['thi truong chung khoan', 'chung khoan', 'stock market', 'stock prices']],
    ['crudeoil', ['dau tho', 'crude oil', 'wti', 'brent']], ['foreignexchange', ['ngoai hoi', 'foreign exchange', 'eur usd']],
];
function fold(value) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}
const replacements = aliases.flatMap(([concept, terms]) => terms.map(term => [term, concept]))
    .sort((a, b) => b[0].length - a[0].length)
    .map(([phrase, concept]) => [new RegExp(`\\b${phrase}\\b`, 'g'), concept]);
function canonical(value) {
    let text = ` ${fold(value)} `;
    for (const [phrase, concept] of replacements) text = text.replace(phrase, concept);
    return text.trim();
}
// Generic research/task words are not topic anchors. Keep 2-letter subject words and numbers.
const stop = new Set(('the a an and or for of to in on with from by is are as at this that these those ' +
    'it has have was were be been updated text snippet title how what which why when where do does can should original research study studies source sources web content article original information public useful topic goal scope ' +
    'nghien cuu nguon noi dung bai viet thong tin cong khai chu de muc tieu pham vi tim hieu kiem tra ' +
    'ung dung phuong phap he thong quan ly phan tich danh gia loi ich han che co ban nang cao ly thuyet bai tap ' +
    'va cua cho ve voi tu den trong cac nhung mot la bang tieng viet english vietnamese help achieve requirements benefits limitations').split(/\s+/));
const specificConcepts = new Set(aliases.map(a => a[0]).filter(c => !['ai', 'document', 'history', 'physics', 'education', 'spring', 'pendulum'].includes(c)));
function tokenize(value) { return value.split(' ').filter(w => w && !stop.has(w)); }
function words(value) { return tokenize(canonical(value)); }
function profile(input) {
    const core = [...new Set(words(`${input.topic || ''} ${input.scope || ''}`))];
    return { core, goal: [...new Set(words(input.goal))] };
}
// Directional concept hierarchy: a specific subtopic supports a broad question,
// but a broad parent alone does not prove evidence for the narrower question.
const narrower = { algorithmcomplexity: ['timecomplexity', 'spacecomplexity', 'bigo'] };
function match(text, context) {
    const normalized = canonical(text);
    const terms = tokenize(normalized), found = new Set(terms);
    const matches = context.core.filter(w => found.has(w) || (narrower[w] || []).some(child => found.has(child)));
    const goal = context.goal.filter(w => found.has(w));
    const phrase = context.core.some((w, i) => i + 1 < context.core.length &&
        (` ${normalized} `).includes(` ${w} ${context.core[i + 1]} `));
    const strong = matches.some(w => specificConcepts.has(w));
    // A subject phrase, a distinctive concept, or enough independent subject terms.
    const required = Math.min(2, context.core.length);
    const goalSupport = context.core.length === 1 && !specificConcepts.has(context.core[0]) && goal.length >= 2;
    const relevant = goalSupport || (matches.length > 0 && (strong || phrase || matches.length >= required));
    return { relevant, matches, goalMatches: goal, terms: new Set(terms.filter(w => w.length >= 2 && /[\p{L}]/u.test(w))).size,
        specific: terms.some(w => specificConcepts.has(w)),
        score: context.core.length ? Math.max(matches.length / context.core.length, goalSupport ? 0.5 : 0) : 0 };
}
function evaluateSource(input, source, { phase = 'content', context = profile(input) } = {}) {
    if (!context.core.length) return { accepted: true, status: 'uncertain', reason: 'INSUFFICIENT_TOPIC_ANCHORS', score: 0 };
    const title = source.title || '';
    const snippet = source.snippet || '';
    const body = source.original_content ?? source.content ?? '';
    const metadata = match(`${title} ${snippet}`, context);
    // Query/goal agreement is diagnostic only; a drifting query cannot rescue a bad body.
    const queryAgreement = match(source.query || '', context);
    const diagnostics = { queryScore: queryAgreement.score, goalMatches: match(`${title} ${snippet} ${body}`, context).goalMatches.length };
    const content = match(body, context);
    const translated = match(source.contentVi || source.display_content_vi || '', context);
    // A substantial off-topic body cannot be rescued by a topical title or query.
    const substantive = content.terms >= 4 || content.specific;
    if (body && substantive && !content.relevant) return { accepted: false, status: 'rejected', reason: 'CONTENT_OFF_TOPIC', score: content.score };
    if (content.relevant || translated.relevant) return { accepted: true, status: 'relevant', reason: 'TOPIC_CONTENT_MATCH', ...diagnostics, score: Math.max(content.score, translated.score) };
    if (phase === 'metadata' && !body) {
        // Short/ambiguous metadata needs a bounded content fetch, not a paid classifier.
        if (!metadata.relevant && metadata.specific && metadata.terms >= 4) return { accepted: false, status: 'rejected', reason: 'METADATA_OFF_TOPIC', score: metadata.score };
        return { accepted: true, status: 'uncertain', reason: 'NEEDS_CONTENT', score: metadata.score };
    }
    if (metadata.relevant) return { accepted: true, status: 'uncertain', reason: 'METADATA_ONLY', score: metadata.score };
    // Thin records are uncertain, not proof of irrelevance. Production evidence still requires a positive chunk score.
    if (!substantive && metadata.terms < 4) return { accepted: true, status: 'uncertain', reason: 'INSUFFICIENT_SOURCE_TEXT', score: 0 };
    return { accepted: false, status: 'rejected', reason: 'NO_TOPIC_MATCH', score: 0 };
}
function eligibleSources(input, sources) {
    const context = profile(input);
    return sources.filter(source => evaluateSource(input, source, { context }).accepted);
}
function anchorQuery(input, query) {
    const raw = String(query || '').trim();
    // Preserve valid bilingual plans. Replace drift rather than appending its wrong-domain terms.
    const subject = profile({ topic: input.topic });
    const scope = profile({ topic: input.scope });
    if (!subject.core.length && !scope.core.length) return raw;
    if (match(raw, subject).relevant) {
        if (!scope.core.length || match(raw, scope).relevant) return raw;
        return `${raw} ${input.scope}`.slice(0, 1400);
    }
    return [...new Set([input.topic, input.scope, input.goal].filter(Boolean))].join(' ').slice(0, 1400);
}
function anchorPlan(input, plan) {
    const subject = profile({ topic: input.topic });
    return { ...plan, searchQueries: plan.searchQueries.map(item => {
        let query = anchorQuery(input, item.query);
        const question = plan.researchQuestions.find(q => q.id === item.questionId);
        if (!match(item.query, subject).relevant && question && match(question.question, subject).relevant)
            query = anchorQuery(input, `${question.question} ${input.goal || ''}`);
        return { ...item, query };
    }) };
}
module.exports = { fold, canonical, words, profile, match, evaluateSource, eligibleSources, anchorQuery, anchorPlan };

// FTS candidate expansion is local; scoring and citation checks remain authoritative.
module.exports.searchTerms = function searchTerms(query) {
    const concepts = new Set(words(query));
    const expanded = aliases.filter(([concept]) => concepts.has(concept)).flatMap(([, terms]) => terms);
    const original = String(query || '').normalize('NFKC').match(/[\p{L}\p{N}]{2,}/gu) || [];
    return [...new Set([...expanded, ...original])].slice(0, 32);
};
