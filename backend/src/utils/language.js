// Conservative local heuristics. Unknown text is never a reason to expose originals.
const VI = new Set('và là của các trong một những được cho với không này có về để từ khi đã sẽ nghiên cứu nội dung nguồn bằng chứng thông tin tiếng việt'.split(' '));
const EN = new Set('the and is are was were a an of to for with this that in on from by as not it be or which can has have original english content title snippet source article'.split(' '));
function detectSourceLanguage({ title = '', snippet = '', content = '' } = {}) {
    const text = [title, snippet, content].join(' ').normalize('NFC').toLowerCase().slice(0, 20000);
    const words = text.match(/\p{L}+/gu) || [];
    if (!words.length) return 'unknown';
    const vi = words.filter(word => VI.has(word)).length;
    const en = words.filter(word => EN.has(word)).length;
    const marked = words.filter(word => /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/.test(word)).length;
    if (marked >= 2 && vi + marked > en * 1.2) return 'vi';
    if (en >= 2 && en > vi) return 'en';
    if (marked && vi >= 1 && en === 0) return 'vi';
    return 'unknown';
}
module.exports = { detectSourceLanguage };
