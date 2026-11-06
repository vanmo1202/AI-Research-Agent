const { db, fail } = require("./common");
const TURN = Object.freeze({
  search_calls: 2,
  llm_calls: 3,
  input_bytes: 60000,
  output_tokens: 5000,
  page_fetches: 4,
});
function cap(name, fallback, ceiling) {
  const value =
    process.env[name] === undefined ? fallback : Number(process.env[name]);
  if (!Number.isSafeInteger(value) || value < 1)
    throw fail("Cấu hình ngân sách Auto Chat không hợp lệ.", 503);
  return Math.min(value, ceiling);
}
function limits() {
  return {
    turn: TURN,
    user: {
      search_calls: cap("AUTO_CHAT_DAILY_SEARCH_LIMIT", 20, 100),
      llm_calls: cap("AUTO_CHAT_DAILY_GEMINI_LIMIT", 30, 100),
      input_bytes: 600000,
      output_tokens: 50000,
      page_fetches: 80,
    },
    global: {
      search_calls: cap("AUTO_CHAT_GLOBAL_SEARCH_LIMIT", 200, 1000),
      llm_calls: cap("AUTO_CHAT_GLOBAL_GEMINI_LIMIT", 300, 1000),
      input_bytes: 6000000,
      output_tokens: 500000,
      page_fetches: 800,
    },
  };
}
function budget(session, turn, signal) {
  const bound = limits();
  const check = () => signal.throwIfAborted();
  async function reserve(metric, units = 1, extra = {}) {
    check();
    const charges = { [metric]: units, ...extra };
    for (const [key, value] of Object.entries(charges))
      if (!(key in TURN) || !Number.isSafeInteger(value) || value < 0)
        throw fail("Invalid budget reservation", 500);
    const day = new Date().toISOString().slice(0, 10);
    await db.transaction(async (tx) => {
      check();
      const lease = await tx.get(
        "SELECT id FROM chat_sessions WHERE id=? AND owner_id=? AND active_token=? AND busy_until>?",
        [session.id, session.owner_id, turn, Date.now()],
      );
      if (!lease)
        throw fail("Lượt chat đã hết hạn. Hãy kiểm tra lịch sử.", 409);
      await tx.run(
        "INSERT OR IGNORE INTO chat_turn_usage(chat_id,turn_id) VALUES(?,?)",
        [session.id, turn],
      );
      const rows = [
        {
          table: "chat_turn_usage",
          where: "chat_id=? AND turn_id=?",
          args: [session.id, turn],
          max: bound.turn,
        },
      ];
      for (const [subject, max] of [
        [`user:${session.owner_id}`, bound.user],
        ["global", bound.global],
      ]) {
        await tx.run(
          "INSERT OR IGNORE INTO chat_daily_usage(subject,day) VALUES(?,?)",
          [subject, day],
        );
        rows.push({
          table: "chat_daily_usage",
          where: "subject=? AND day=?",
          args: [subject, day],
          max,
        });
      }
      for (const row of rows) {
        const used = await tx.get(
          `SELECT * FROM ${row.table} WHERE ${row.where}`,
          row.args,
        );
        for (const [key, value] of Object.entries(charges))
          if (used[key] + value > row.max[key])
            throw fail(
              "Đã đạt ngân sách Auto Chat. Vui lòng thử lại sau hoặc tắt Internet.",
              429,
              "AUTO_CHAT_BUDGET_EXCEEDED",
            );
      }
      for (const row of rows)
        await tx.run(
          `UPDATE ${row.table} SET ${Object.keys(charges)
            .map((key) => `${key}=${key}+?`)
            .join(",")} WHERE ${row.where}`,
          [...Object.values(charges), ...row.args],
        );
    });
  }
  return {
    check,
    reserve,
    signal,
    usage: () =>
      db.get(
        "SELECT search_calls,llm_calls,input_bytes,output_tokens,page_fetches FROM chat_turn_usage WHERE chat_id=? AND turn_id=?",
        [session.id, turn],
      ),
  };
}
module.exports = { budget, limits };
